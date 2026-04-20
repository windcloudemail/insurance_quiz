import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as mammoth from 'mammoth';
import Tesseract from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// 清理 PDF/docx 抽出的文字：把視覺排版產生的多餘空格與換行壓掉，
// 但保留英文字母、數字邊界的空白。規則：
//   - 所有 \n \r \t → 空白
//   - 連續空白 → 單一空白
//   - CJK 字（含全形標點、全形英數）彼此相鄰時夾的空白全部移除
function cleanText(s) {
    if (!s) return s || '';
    let out = s.replace(/[\r\n\t]+/g, ' ');
    out = out.replace(/ {2,}/g, ' ');
    const cjkPair = /([\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF])\s+([\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF])/g;
    out = out.replace(cjkPair, '$1$2');
    out = out.replace(cjkPair, '$1$2');
    return out.trim();
}

export async function parseDocument(file) {
    const fileType = file.type;

    if (fileType === 'application/pdf') {
        return await parsePDF(file);
    } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')
    ) {
        return await parseDOCX(file);
    } else if (fileType.startsWith('image/')) {
        return await parseImage(file);
    } else {
        throw new Error('不支援的檔案格式，請上傳 PDF、DOCX 或圖片檔');
    }
}

async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';

    // 以 y 座標變化重建行結構；同行 items 直接串（CJK 文字不需空白），換行時 \n
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        let lastY = null;
        let pageText = '';

        for (const item of textContent.items) {
            if (!item.str) continue;
            const y = item.transform[5];
            if (lastY !== null && Math.abs(lastY - y) > 2) {
                pageText += '\n';
            }
            pageText += item.str;
            lastY = y;
        }

        fullText += pageText + '\n\n';
    }

    return extractQuestions(fullText);
}

async function parseDOCX(file) {
    const arrayBuffer = await file.arrayBuffer();

    // 公會/同業題庫多為「題號 | 答案 | 題目內容」三欄表格；
    // 先走 HTML 解析保留表格結構，失敗再退回純文字 regex。
    try {
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
        const fromTable = extractFromTableHtml(html);
        if (fromTable.length > 0) return fromTable;
    } catch (e) {
        console.warn('[parseDOCX] HTML 解析失敗，改用純文字解析', e);
    }

    const { value: text } = await mammoth.extractRawText({ arrayBuffer });
    return extractQuestions(text);
}

async function parseImage(file) {
    const { data: { text } } = await Tesseract.recognize(file, 'chi_tra', {
        logger: m => console.log(m)
    });

    // Cleanup OCR noise spacing but PRESERVE newlines since the parser needs them
    let cleaned = text.replace(/[ \t\r]+/g, (match, offset, str) => {
        const prev = str[offset - 1];
        const next = str[offset + match.length];
        if (prev && next && /[a-zA-Z0-9]/.test(prev) && /[a-zA-Z0-9]/.test(next)) {
            return ' ';
        }
        return '';
    }).trim();

    return extractQuestions(cleaned);
}

// ============================================================
// HTML 表格解析（主要 docx 題庫路徑）
// ============================================================

function cellText(cell) {
    let out = '';
    const walk = (node) => {
        if (node.nodeType === 3) {
            out += node.textContent;
        } else if (node.nodeName === 'BR') {
            out += '\n';
        } else if (node.nodeName === 'P' || node.nodeName === 'DIV') {
            if (out && !out.endsWith('\n')) out += '\n';
            for (const child of node.childNodes) walk(child);
            if (!out.endsWith('\n')) out += '\n';
        } else {
            for (const child of node.childNodes) walk(child);
        }
    };
    for (const child of cell.childNodes) walk(child);
    return out.replace(/\n{3,}/g, '\n\n').trim();
}

function detectSubject(text) {
    const t = text.replace(/\s+/g, '');
    if (/保險實務/.test(t)) return '保險實務';
    if (/保險法規/.test(t)) return '保險法規';
    if (/共同科目/.test(t)) return '共同科目';
    if (/外幣/.test(t)) return '外幣保險';
    if (/投資型/.test(t)) return '投資型保險';
    if (/人身保險/.test(t)) return '人身保險';
    if (/產物保險|財產保險/.test(t)) return '產物保險';
    // 取題庫標題前 30 字當分類名
    return text.replace(/\s+/g, ' ').trim().slice(0, 30) || '題庫匯入';
}

function extractFromTableHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tables = doc.querySelectorAll('table');
    const results = [];
    let currentSubject = null;

    for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
            const cells = row.querySelectorAll('td, th');
            if (cells.length < 3) continue;

            const c0 = cellText(cells[0]);
            const c1 = cellText(cells[1]);
            const c2 = cellText(cells[2]);

            // 表頭列（題號/答案/...）：第三欄若是科目名稱先吃進去，再跳過
            if (/題\s*號/.test(c0) && /答\s*案/.test(c1)) {
                if (c2 && !/題\s*目\s*內\s*容/.test(c2) && /精選題庫|題庫|新增題目|實務|法規|共同科目|外幣|投資型/.test(c2)) {
                    currentSubject = detectSubject(c2);
                }
                continue;
            }

            // 非題目列（題號欄非純數字）：檢查第三欄是否為科目標題
            if (!/^\d+$/.test(c0.trim())) {
                if (/精選題庫|題庫|新增題目|實務|法規|共同科目|外幣|投資型/.test(c2)) {
                    currentSubject = detectSubject(c2);
                }
                continue;
            }

            // 答案必須是 1-4
            const ansRaw = c1.trim();
            if (!/^[1-4]$/.test(ansRaw)) continue;

            const parsed = parseQuestionCell(c2);
            if (!parsed) continue;

            results.push({
                source_number: parseInt(c0.trim(), 10) || null,
                category: currentSubject || '題庫匯入',
                difficulty: 'medium',
                question: cleanText(parsed.question),
                question_part2: cleanText(parsed.question_part2 || ''),
                option_1: cleanText(parsed.o1),
                option_2: cleanText(parsed.o2),
                option_3: cleanText(parsed.o3),
                option_4: cleanText(parsed.o4),
                answer: parseInt(ansRaw, 10),
                explanation: cleanText(parsed.explanation || ''),
            });
        }
    }

    return results;
}

function parseQuestionCell(text) {
    let body = text.trim();

    // 抽解析 / 解說 / 說明
    let explanation = '';
    const expMatch = body.match(/【\s*(?:解說|解析|說明|註解|註)\s*】\s*[:：]?\s*([\s\S]*)$/);
    if (expMatch) {
        explanation = expMatch[1].trim();
        body = body.substring(0, expMatch.index).trim();
    }

    const opts = extractOptions(body);
    if (!opts) return null;

    return {
        question: opts.q,
        question_part2: opts.qp2,
        o1: opts.o1,
        o2: opts.o2,
        o3: opts.o3,
        o4: opts.o4,
        explanation,
    };
}

function extractOptions(text) {
    const markersList = [
        ['(1)', '(2)', '(3)', '(4)'],
        ['（1）', '（2）', '（3）', '（4）'],
        ['①', '②', '③', '④'],
        ['(A)', '(B)', '(C)', '(D)'],
        ['（A）', '（B）', '（C）', '（D）'],
        ['A.', 'B.', 'C.', 'D.'],
        ['A、', 'B、', 'C、', 'D、'],
        ['Ａ', 'Ｂ', 'Ｃ', 'Ｄ'],
    ];

    for (const m of markersList) {
        const i1 = text.indexOf(m[0]);
        if (i1 === -1) continue;
        const i2 = text.indexOf(m[1], i1 + m[0].length);
        if (i2 === -1) continue;
        const i3 = text.indexOf(m[2], i2 + m[1].length);
        if (i3 === -1) continue;
        const i4 = text.indexOf(m[3], i3 + m[2].length);
        if (i4 === -1) continue;

        // 避開 Ａ 被括號包住的情形（例：(Ａ) 前綴）
        if (m[0] === 'Ａ' && i1 > 0 && /[(（]/.test(text[i1 - 1])) continue;

        const tail = text.substring(i4 + m[3].length);
        // 僅句末標點視為 option 邊界：避免 option 內部換行 / 逗號被誤切
        const enders = ['。', '？', '！'];
        let endIdx = tail.length;
        for (const e of enders) {
            const idx = tail.indexOf(e);
            if (idx > 0 && idx < endIdx) endIdx = idx;
        }

        let o4 = tail.substring(0, endIdx).trim();
        let qp2 = tail.substring(endIdx).replace(/^[。，、；：？！\s]+/, '').trim();

        return {
            q: text.substring(0, i1).trim(),
            qp2,
            o1: text.substring(i1 + m[0].length, i2).trim(),
            o2: text.substring(i2 + m[1].length, i3).trim(),
            o3: text.substring(i3 + m[2].length, i4).trim(),
            o4: o4.replace(/。$/, '').trim(),
        };
    }
    return null;
}

// ============================================================
// 純文字 fallback 解析（PDF / 圖片 / 非表格 docx）
// ============================================================

function extractQuestions(text) {
    const questions = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let currentObj = null;

    const pushCurrentObj = () => {
        if (!currentObj || !currentObj._rawText) return;

        let fullText = currentObj._rawText.trim();

        const expMatch = fullText.match(/【?(?:解說|解析|說明)】?[:：\s]*(.*?)$/is);
        if (expMatch) {
            currentObj.explanation = expMatch[1].trim();
            fullText = fullText.substring(0, expMatch.index).trim();
        }

        if (!currentObj.answer) {
            const ansMatch = fullText.match(/【?(?:答案|解答|Ans)】?[:：\s]*(?:\(|（|)?([1-4A-D])(?:\)|）|)?/i);
            if (ansMatch) {
                const val = ansMatch[1];
                if (['1', 'A', 'a'].includes(val)) currentObj.answer = 1;
                else if (['2', 'B', 'b'].includes(val)) currentObj.answer = 2;
                else if (['3', 'C', 'c'].includes(val)) currentObj.answer = 3;
                else if (['4', 'D', 'd'].includes(val)) currentObj.answer = 4;
                fullText = fullText.substring(0, ansMatch.index).trim();
            }
        }

        const opts = extractOptions(fullText);
        if (opts) {
            currentObj.question = opts.q;
            currentObj.question_part2 = opts.qp2;
            currentObj.option_1 = opts.o1;
            currentObj.option_2 = opts.o2;
            currentObj.option_3 = opts.o3;
            currentObj.option_4 = opts.o4;
        } else {
            currentObj.question = fullText;
            currentObj.question_part2 = '';
        }

        if (currentObj.option_4) {
            currentObj.option_4 = currentObj.option_4.replace(/。$/, '').trim();
        }

        if (currentObj.question && currentObj.option_1 && currentObj.option_2 && currentObj.answer >= 1 && currentObj.answer <= 4) {
            // 清理 PDF / 純文字排版產生的多餘空白、換行
            currentObj.question = cleanText(currentObj.question);
            currentObj.question_part2 = cleanText(currentObj.question_part2 || '');
            currentObj.option_1 = cleanText(currentObj.option_1);
            currentObj.option_2 = cleanText(currentObj.option_2);
            currentObj.option_3 = cleanText(currentObj.option_3);
            currentObj.option_4 = cleanText(currentObj.option_4);
            currentObj.explanation = cleanText(currentObj.explanation || '');
            delete currentObj._rawText;
            questions.push(currentObj);
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.replace(/\s/g, '').includes('題號答案')) continue;

        const newFormatMatch = line.match(/^(\d+)\s+([1-4])(?:\s+(.*))?$/);
        const oldFormatMatch = line.match(/^(\d+)[\.、]\s*(.*)$/);

        let isNewStart = false;
        let qText = '';
        let qAns = null;
        let qNum = null;

        if (newFormatMatch) {
            isNewStart = true;
            qNum = parseInt(newFormatMatch[1], 10);
            qAns = parseInt(newFormatMatch[2]);
            qText = newFormatMatch[3] || '';
        } else if (oldFormatMatch) {
            isNewStart = true;
            qNum = parseInt(oldFormatMatch[1], 10);
            qText = oldFormatMatch[2] || '';
        }

        if (isNewStart) {
            pushCurrentObj();
            currentObj = {
                _rawText: qText,
                source_number: qNum,
                option_1: '', option_2: '', option_3: '', option_4: '',
                answer: qAns || 1,
                explanation: '',
                category: '題庫匯入',
                difficulty: 'medium'
            };
        } else if (currentObj) {
            if (currentObj._rawText) {
                currentObj._rawText += '\n' + line;
            } else {
                currentObj._rawText = line;
            }
        }
    }

    pushCurrentObj();

    return questions;
}
