# 答題頁 Quiz 重設計 brief

## 用法
1. 開啟 https://claude.ai（新對話）
2. 複製下方「給 Claude.ai 的 prompt」全部貼上
3. 附上**作答中 + 揭答案後 + 答對 + 答錯**的截圖
4. 讓 Claude 產 Artifact 預覽，iterate 滿意
5. 跟 Claude 說「請輸出 Quiz.jsx / QuestionCard.jsx / OptionButton.jsx / ExplanationBox.jsx 四個檔案的完整內容」，整段回應複製給我

---PROMPT START---

這是我專案的答題頁，附上 4 個檔案的程式碼與現況截圖。請幫我重新設計視覺。

【保留不動】
- 所有 useState / useEffect / handler
- API 呼叫（getRandomQuestions）
- navigate / state 傳遞格式
- component 間的 props signature
- import 路徑

【只改】
- JSX return 結構
- className / style

【技術規範】
- React + Tailwind CSS pure class
- 不要 import 外部 icon 套件
- Artifact 預覽請同時展示：
  - 作答中（尚未選擇）
  - 已選擇尚未揭答
  - 揭答後答對
  - 揭答後答錯（含 explanation）
  - 最後一題（按鈕顯示「查看結果」）

【色票】
- bg-primary (#c96442) / bg-primary-dim (#a85230) / bg-accent (#b67a3a)
- bg-base (#faf9f5) / bg-surface (#fff) / bg-card (#f4f1e9)
- text-ink (#1f1d18) / text-ink-soft (#4d473c) / text-ink-faint (#766f5f)
- border-border (#d8d1bf) / border-border-strong (#b9b29f)
- bg-correct / text-correct (#5b7f4f)
- bg-wrong / text-wrong (#b54545)

【字體】標題 font-serif、內文 font-sans、數字 font-mono

【風格】Claude 紙感、不要 glow、不要 gradient、rounded-md ~ rounded-lg、極輕陰影

【頁面結構（必要）】
1. 頂部進度列：✕ 離開 + 水平進度條 + 「目前/總題」
2. practiceOnly 時頂部小 banner：「錯題練習模式 · 本次不計入統計」
3. QuestionCard 題目卡：「第 N 題」+ 可選「題本 #N」小標 + 題幹 + 選項前題幹的補充段落 question_part2
4. 4 個選項按鈕（A / B / C / D 圓標 + 選項文字）
   - 5 種狀態：default / selected / correct / wrong / disabled
   - 揭答後正確選項標綠、選錯的標紅
5. 揭答後顯示 ExplanationBox（答對綠左框、答錯紅左框）+ 解說文字
6. 底部 CTA 按鈕：未揭答時「確認答案」（selected 才可點）；揭答後「下一題 →」或「查看結果」
7. 底部題號 dots：顯示所有題的完成狀態（答對綠、答錯紅、目前題主色、未作答灰）

【Mock data】
```js
const mockQuestion = {
  id: 20,
  source_number: 20,
  question: '依國外投資管理辦法第 13-3 條，保險業經主管機關核准之被投資保險相關事業有下列情事之一者，應於事實發生後七日內檢具事由及相關資料向主管機關陳報：A.重大營運政策變更 B.發生重整、清算或破產之情事 C.已發生或可預見之重大虧損案件 D.更換負責人',
  question_part2: '',
  option_1: 'ABCD',
  option_2: 'ABC',
  option_3: 'ABD',
  option_4: 'BCD',
  answer: 2,
  explanation: '依法規，上述 ABC 三款為必須陳報之事由；D（更換負責人）另有獨立規範。',
}
```

請在 Artifact 中預覽新版，並輸出 Quiz.jsx / QuestionCard.jsx / OptionButton.jsx / ExplanationBox.jsx 四個檔案的完整內容。

---PROMPT END---

---

## 目前的四個檔案程式碼

### `src/pages/Quiz.jsx`

```jsx
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getRandomQuestions } from '../lib/api.js'
import QuestionCard from '../components/QuestionCard.jsx'
import OptionButton from '../components/OptionButton.jsx'
import ExplanationBox from '../components/ExplanationBox.jsx'

export default function Quiz() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const count = state?.count ?? 20
  const category = state?.category ?? ''
  const practiceOnly = state?.practiceOnly ?? false

  const [questions, setQuestions] = useState(state?.questions ?? [])
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(!state?.questions)
  const [error, setError] = useState('')

  useEffect(() => {
    if (state?.questions && state.questions.length > 0) return
    getRandomQuestions(count, category === '全部' ? '' : category)
      .then(data => { setQuestions(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div>載入中…</div>
  if (error) return <div>{error}</div>
  if (questions.length === 0) return <div>此分類尚無題目</div>

  const q = questions[current]
  const opts = [q.option_1, q.option_2, q.option_3, q.option_4]
  const correctIdx = q.answer - 1
  const isCorrect = selected === correctIdx
  const progress = Math.round((current / questions.length) * 100)
  const isLast = current + 1 === questions.length

  const handleSelect = (idx) => { if (!revealed) setSelected(idx) }
  const handleReveal = () => {
    if (selected === null) return
    setRevealed(true)
    setAnswers(prev => [...prev, { questionId: q.id, selected, correct: correctIdx }])
  }
  const handleNext = () => {
    if (current + 1 < questions.length) {
      setCurrent(c => c + 1); setSelected(null); setRevealed(false)
    } else {
      navigate('/result', { state: { questions, answers: [...answers], category, practiceOnly } })
    }
  }
  const getOptionState = (idx) => {
    if (!revealed) return selected === idx ? 'selected' : 'default'
    if (idx === correctIdx) return 'correct'
    if (idx === selected && !isCorrect) return 'wrong'
    return 'disabled'
  }

  return (
    // === Claude 請重新設計這邊的 JSX ===
    // 需包含：progress bar / practiceOnly banner / QuestionCard / OptionButton × 4 /
    //         ExplanationBox（revealed 時） / CTA 按鈕 / 題號 dots
    null
  )
}
```

### `src/components/QuestionCard.jsx`

```jsx
export default function QuestionCard({ current, total, source_number, question, question_part2 }) {
  return (
    // === Claude 請重新設計 ===
    // props: current (number, 第幾題), total (number), source_number (number | null),
    //         question (string, 主題幹), question_part2 (string, 選項後補充段落；可能為空)
    null
  )
}
```

### `src/components/OptionButton.jsx`

```jsx
const LABELS = ['A', 'B', 'C', 'D']

export default function OptionButton({ index, text, state, onClick }) {
  // state: 'default' | 'selected' | 'correct' | 'wrong' | 'disabled'
  return (
    // === Claude 請重新設計 ===
    // 需支援 5 個 state 的視覺、點擊互動、A/B/C/D 標籤圓
    null
  )
}
```

### `src/components/ExplanationBox.jsx`

```jsx
export default function ExplanationBox({ isCorrect, explanation }) {
  return (
    // === Claude 請重新設計 ===
    // isCorrect true → 綠色系（bg-correct/系列）
    // isCorrect false → 紅色系（bg-wrong/系列）
    // 顯示 explanation 文字（可能為空字串，空則不顯示解說段落，但仍顯示「答對/答錯」標題）
    null
  )
}
```
