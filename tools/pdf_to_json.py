"""
將保險題庫 PDF 抽成 JSON，供 Admin 後台「匯入 JSON」功能直接上傳。

使用：
    python tools/pdf_to_json.py path/to/input.pdf [output.json]

若 output 省略，輸出檔名會是 input.json（同目錄）。

依賴：
    pip install pdfplumber

輸出格式：
    [
      {
        "source_number": 20,
        "category": "外幣保險",
        "difficulty": "medium",
        "question": "題幹文字",
        "question_part2": "",
        "option_1": "...", "option_2": "...", "option_3": "...", "option_4": "...",
        "answer": 3,
        "explanation": ""
      },
      ...
    ]
"""
import sys
import re
import json
import os
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print('缺少依賴：pip install pdfplumber', file=sys.stderr)
    sys.exit(1)


# ------- 清理文字（移除 CJK 字之間的多餘空白、換行） -------
_CJK = r'\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF'


def clean_text(s: str) -> str:
    if not s:
        return ''
    out = re.sub(r'[\r\n\t]+', ' ', s)
    out = re.sub(r' {2,}', ' ', out)
    cjk_pair = re.compile(f'([{_CJK}])\\s+([{_CJK}])')
    out = cjk_pair.sub(r'\1\2', out)
    out = cjk_pair.sub(r'\1\2', out)
    return out.strip()


# ------- 從題幹文字抽 (1)(2)(3)(4) 四個選項 -------
_OPT_MARKERS = [
    ['(1)', '(2)', '(3)', '(4)'],
    ['（1）', '（2）', '（3）', '（4）'],
    ['①', '②', '③', '④'],
    ['(A)', '(B)', '(C)', '(D)'],
    ['（A）', '（B）', '（C）', '（D）'],
    ['A.', 'B.', 'C.', 'D.'],
    ['A、', 'B、', 'C、', 'D、'],
]


def extract_options(text: str):
    for m in _OPT_MARKERS:
        i1 = text.find(m[0])
        if i1 == -1:
            continue
        i2 = text.find(m[1], i1 + len(m[0]))
        if i2 == -1:
            continue
        i3 = text.find(m[2], i2 + len(m[1]))
        if i3 == -1:
            continue
        i4 = text.find(m[3], i3 + len(m[2]))
        if i4 == -1:
            continue
        tail = text[i4 + len(m[3]):]
        # 只有句末標點才視為 option 邊界，避免 option 內部斷行/逗號被誤切
        enders = ['。', '？', '！']
        end_idx = len(tail)
        for e in enders:
            idx = tail.find(e)
            if 0 < idx < end_idx:
                end_idx = idx
        return {
            'q': text[:i1].strip(),
            'qp2': tail[end_idx:].lstrip('。，、；：？！ \n\t').strip(),
            'o1': text[i1 + len(m[0]):i2].strip(),
            'o2': text[i2 + len(m[1]):i3].strip(),
            'o3': text[i3 + len(m[2]):i4].strip(),
            'o4': tail[:end_idx].strip().rstrip('。'),
        }
    return None


# ------- 判斷科目 -------
_SUBJECT_KEYWORDS = {
    '保險實務': '保險實務',
    '保險法規': '保險法規',
    '共同科目': '共同科目',
    '外幣': '外幣保險',
    '投資型': '投資型保險',
    '人身保險': '人身保險',
    '財產保險': '產物保險',
    '產物保險': '產物保險',
}


def detect_subject(text: str) -> str:
    if not text:
        return ''
    t = re.sub(r'\s+', '', text)
    for kw, label in _SUBJECT_KEYWORDS.items():
        if kw in t:
            return label
    return ''


def split_cells(row):
    """表格 row 常有空欄（因為 PDF 表格 span），把 None/空字串合併成 [題號, 答案, 題幹]。"""
    cells = [c for c in row if c is not None and str(c).strip() != '']
    return cells


def parse_question_cell(cell_text: str, answer: int):
    """從題幹 cell 抽題幹 + 4 個選項 + 【解析】。"""
    body = (cell_text or '').strip()

    # 抽【解析】/ 【解說】/ 【說明】
    explanation = ''
    exp_match = re.search(r'【\s*(?:解說|解析|說明|註解|註)\s*】\s*[:：]?\s*(.*)$', body, re.DOTALL)
    if exp_match:
        explanation = exp_match.group(1).strip()
        body = body[:exp_match.start()].strip()

    opts = extract_options(body)
    if not opts:
        return None

    return {
        'question': clean_text(opts['q']),
        'question_part2': clean_text(opts['qp2']),
        'option_1': clean_text(opts['o1']),
        'option_2': clean_text(opts['o2']),
        'option_3': clean_text(opts['o3']),
        'option_4': clean_text(opts['o4']),
        'answer': answer,
        'explanation': clean_text(explanation),
    }


def parse_pdf(pdf_path: Path, default_category: str):
    """
    兩階段解析：
      Pass 1: 掃全部 row，組合出 logical questions（合併跨 row 的續行）
      Pass 2: 對每個 logical question 抽選項；失敗者放入 failures 供後台手動補
    """
    current_subject = None
    stats = {'total_rows': 0, 'header_rows': 0, 'subject_rows': 0,
             'no_options': 0, 'bad_answer': 0, 'pushed': 0, 'merged_continuation': 0}
    failures = []  # 供後台手動處理

    # 蒐集 logical questions：每個 item = {num, ans, body, subject}
    logical = []

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    stats['total_rows'] += 1

                    # 判斷欄位：表格一律是 [題號, 答案, 題幹...] 三欄（可能中間有多餘空 cell）
                    # 把 None → ''、統一成字串
                    cols = [('' if c is None else str(c)).strip() for c in row]

                    # 去掉連續空欄（保留欄位相對位置）
                    # 先用非空欄判斷這 row 的結構：
                    non_empty_idx = [i for i, c in enumerate(cols) if c]
                    if not non_empty_idx:
                        continue

                    # 第一個非空欄的文字
                    first = cols[non_empty_idx[0]]
                    num_match = re.match(r'^\*?(\d+)$', first)

                    if num_match and len(non_empty_idx) >= 2:
                        # 這 row 有題號 → 新題開始
                        num = int(num_match.group(1))
                        # 第二個非空欄為答案
                        ans_raw = cols[non_empty_idx[1]]
                        if not re.match(r'^[1-4]$', ans_raw):
                            stats['bad_answer'] += 1
                            body_text = ' '.join(cols[i] for i in non_empty_idx[2:])
                            failures.append({
                                'source_number': num,
                                'category': default_category,
                                'reason': f'bad_answer (got "{ans_raw}")',
                                'raw_body': body_text,
                            })
                            continue
                        # 剩餘欄位為題幹
                        body = ' '.join(cols[i] for i in non_empty_idx[2:])
                        logical.append({
                            'num': num,
                            'ans': int(ans_raw),
                            'body': body,
                            'subject': current_subject,
                        })
                    else:
                        # 沒題號 → 可能是續行 or header/subject row
                        joined = ' '.join(cols[i] for i in non_empty_idx)

                        # Header: 「題號 答案 題目內容」標題列（僅略過，不從中推測科目；
                        # 避免整份 PDF 都被強制歸到同一個 auto-detect 分類，改由 default_category 決定）
                        if re.search(r'題\s*號', joined) and re.search(r'答\s*案', joined):
                            stats['header_rows'] += 1
                            continue

                        # Subject row（題庫標題、精選、科目名）— 僅統計不改 category
                        # 單份 PDF 通常就是一個題庫來源，category 一律用 default_category（檔名）
                        if any(k in joined for k in ['精選題庫', '題庫', '新增題目']):
                            stats['subject_rows'] += 1
                            continue

                        # 否則視為前一題續行
                        if logical:
                            logical[-1]['body'] += ' ' + joined
                            stats['merged_continuation'] += 1
                        # 若還沒有任何題（檔頭），當作 subject candidate
                        elif detect_subject(joined):
                            current_subject = detect_subject(joined)

    # Pass 2: 對每個 logical 抽選項
    questions = []
    for item in logical:
        parsed = parse_question_cell(item['body'], item['ans'])
        if not parsed:
            stats['no_options'] += 1
            failures.append({
                'source_number': item['num'],
                'category': item['subject'] or default_category,
                'reason': 'no_options (找不到四個選項標記，可能 PDF 原文標記錯誤或選項格式特殊)',
                'raw_body': item['body'],
            })
            continue
        questions.append({
            'source_number': item['num'],
            'category': item['subject'] or default_category,
            'difficulty': 'medium',
            **parsed,
        })
        stats['pushed'] += 1

    return questions, failures, stats


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f'檔案不存在：{pdf_path}', file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) > 2:
        output = Path(sys.argv[2])
    else:
        # 預設輸出到 PDF 同目錄的 json/ 子資料夾，保持原始目錄整潔
        json_dir = pdf_path.parent / 'json'
        json_dir.mkdir(exist_ok=True)
        output = json_dir / (pdf_path.stem + '.json')
    default_category = pdf_path.stem

    questions, failures, stats = parse_pdf(pdf_path, default_category)

    bundle = {'questions': questions, 'failures': failures}
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(bundle, f, ensure_ascii=False, indent=2)

    print(f'已抽出 {len(questions)} 題、{len(failures)} 筆失敗紀錄 → {output}', file=sys.stderr)
    print(f'統計：{stats}', file=sys.stderr)

    from collections import Counter
    cats = Counter(q['category'] for q in questions)
    print(f'各分類題數：{dict(cats)}', file=sys.stderr)


if __name__ == '__main__':
    main()
