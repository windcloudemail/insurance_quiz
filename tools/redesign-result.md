# 結果頁 Result 重設計 brief

## 用法
1. 開啟 https://claude.ai
2. 複製下方 prompt 全部貼上
3. 附上現況截圖（高分 / 中等 / 低分 + 逐題回顧 + 三個底部按鈕）
4. 讓 Claude 產 Artifact 預覽、iterate
5. 跟 Claude 說「請輸出 Result.jsx 完整內容」，整段回應複製給我

---PROMPT START---

這是我專案的結果頁，附上程式碼與現況截圖。請幫我重新設計視覺。

【保留不動】
- 所有 useState / useEffect / useRef / useMemo / handler
- API 呼叫（submitAttempts）
- navigate / state 傳遞格式
- practiceOnly 分支邏輯（true 時不上報統計 + 顯示 banner）
- import 路徑

【只改】JSX return 結構與 className / style

【技術規範】
- React + Tailwind CSS pure class
- 不要 import 外部 icon 套件
- 百分比圓環可用 inline SVG（可 inline style 僅限 stroke-dashoffset 動態值）
- Artifact 預覽請展示：高分 90%（綠）/ 中等 65%（琥珀）/ 低分 30%（紅）+ practiceOnly 模式 + 有錯題 / 全對兩種 CTA 狀態

【色票】
- bg-primary (#c96442) / bg-primary-dim (#a85230) / bg-accent (#b67a3a)
- bg-base (#faf9f5) / bg-surface (#fff) / bg-card (#f4f1e9)
- text-ink (#1f1d18) / text-ink-soft (#4d473c) / text-ink-faint (#766f5f)
- border-border (#d8d1bf) / border-border-strong (#b9b29f)
- bg-correct / text-correct (#5b7f4f)
- bg-wrong / text-wrong (#b54545)

【字體】標題 font-serif / 數字 font-mono

【風格】Claude 紙感 + 儀式感（成績卡像證書）、不要 glow / gradient

【分數色規則】
- pct ≥ 80：綠 #5b7f4f，訊息「表現優秀，繼續保持」
- 60 ≤ pct < 80：琥珀 #b67a3a，訊息「不錯，再加把勁」
- pct < 60：紅 #b54545，訊息「多練習幾次，你可以的」

【頁面結構（必要）】
1. practiceOnly banner（若 practiceOnly=true）：「錯題練習模式 · 本次不計入統計」
2. 分數卡：圓環 SVG（顯示 pct + 分數分母）+ 「測驗完成」標題 + grade 訊息 + 下方三個數字格（答對/答錯/總題）
3. 逐題回顧分隔標題
4. 逐題卡片列表：每題顯示 ✓/✗ icon + Q 序號 + 題本 # + 分類 tag + 題幹（line-clamp-2）+ 答錯時顯示你的答案（紅）+ 正確答案（綠）
5. 固定底部三按鈕（grid-cols-3 gap-2）：「回首頁」（細邊）/「練錯題 (N)」或「✓ 全對」（紅色系 / disabled）/「再練一次」（主色橘）

【RWD】手機優先 max-w-2xl，底部固定按鈕 bottom-0

【Mock data】
```js
const mockQuestions = [
  { id:1, source_number:1, category:'11503-2_外幣題庫(北二專屬)', question:'保險業經主管機關核准之被投資保險相關事業…', option_1:'ABCD', option_2:'ABC', option_3:'ABD', option_4:'BCD', answer:2 },
  { id:2, source_number:2, category:'11503-2_外幣題庫(北二專屬)', question:'保險業辦理外匯業務管理辦法第 3 條規定…', option_1:'以新臺幣收付…外幣放款', option_2:'以外幣收付之人身保險之保險單為質之外幣放款', option_3:'以外幣收付…新臺幣放款', option_4:'以外幣收付之財產保險…', answer:2 },
  { id:3, source_number:3, category:'11503-2_外幣題庫(北二專屬)', question:'投資型保險商品所連結…', option_1:'twBBB+', option_2:'twA-', option_3:'twA', option_4:'twAA', answer:4 },
]
const mockAnswers = [
  { questionId:1, selected:1, correct:1 },  // 對
  { questionId:2, selected:3, correct:1 },  // 錯
  { questionId:3, selected:3, correct:3 },  // 對
]
```

請在 Artifact 中預覽新版，並輸出 Result.jsx 完整內容。

---PROMPT END---

---

## 目前 Result.jsx 程式碼

```jsx
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { submitAttempts } from '../lib/api.js'

const LABELS = ['A', 'B', 'C', 'D']

export default function Result() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const reported = useRef(false)

  if (!state?.questions) { navigate('/'); return null }
  const { questions, answers, category, practiceOnly } = state
  const wrongQuestions = questions.filter((q, i) => answers[i]?.selected !== answers[i]?.correct)
  const hasWrong = wrongQuestions.length > 0

  useEffect(() => {
    if (practiceOnly) return
    if (reported.current || !answers || answers.length === 0) return
    reported.current = true
    const payload = answers.map(a => ({
      question_id: a.questionId,
      correct: a.selected === a.correct,
    }))
    submitAttempts(payload).catch(() => { /* 靜默失敗 */ })
  }, [])

  const score = answers.filter(a => a.selected === a.correct).length
  const pct = Math.round((score / questions.length) * 100)
  const gradeColor = pct >= 80 ? '#5b7f4f' : pct >= 60 ? '#b67a3a' : '#b54545'
  const gradeMsg = pct >= 80 ? '表現優秀，繼續保持' : pct >= 60 ? '不錯，再加把勁' : '多練習幾次，你可以的'

  return (
    // === Claude 請重新設計這邊的 JSX ===
    // 需包含：practiceOnly banner / 分數卡（含圓環）/ 逐題回顧清單 /
    //         底部三按鈕（回首頁 / 練錯題 / 再練一次）
    null
  )
}
```
