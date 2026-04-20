# 首頁 Home 重設計 brief

## 用法
1. 開啟 https://claude.ai（新對話）
2. 複製以下「給 Claude.ai 的 prompt」區塊（從 `---PROMPT START---` 到 `---PROMPT END---`）全部貼上
3. 在輸入框**附加一張你現有首頁的截圖**（登入前後各一張更好）
4. 送出後 Claude 會產 Artifact 即時預覽；覺得不滿意就用對話繼續 iterate
5. 滿意後跟 Claude 說「請輸出完整的 Home.jsx 檔案內容」，把回應整段複製給我

---PROMPT START---

這是我專案裡的 Home 頁面，我附上現有程式碼和現況截圖。請幫我重新設計視覺。

【保留不動】
- 所有 useState / useEffect / handler 函式
- 所有 API 呼叫（getCategories / getRandomQuestions / getRandomWrongQuestions / login / getMasteryStats）
- localStorage 存取邏輯
- props / state shape
- import 路徑

【只改】
- JSX return 的結構與視覺
- className / style

【技術規範】
- React + Tailwind CSS（pure class，不要 inline style 除非是 progress bar 的 dynamic width）
- 不要 import 外部 icon 套件（lucide-react / heroicons 都不行）
  需要 icon 用 inline SVG 或 Unicode 字元
- Artifact 預覽時用 mock data 展示各種狀態（未登入 / 已登入一般用戶 / 已登入管理員 / 有精熟進度 / 無精熟進度）

【色票】（對應我專案 Tailwind）
- bg-primary      主 CTA 橘 (#c96442)
- bg-primary-dim  CTA hover (#a85230)
- bg-accent       次要琥珀 (#b67a3a)
- bg-base         頁面底暖米白 (#faf9f5)
- bg-surface      卡片白 (#ffffff)
- bg-card         次卡片米 (#f4f1e9)
- text-ink        主文字深墨 (#1f1d18)
- text-ink-soft   次文字 (#4d473c)
- text-ink-faint  提示文字 (#766f5f)
- border-border   邊線 (#d8d1bf)
- border-border-strong 強邊線 (#b9b29f)
- bg-correct / text-correct  綠 (#5b7f4f)
- bg-wrong / text-wrong      紅 (#b54545)

【字體】
- 標題用 `font-serif`（Source Serif 4 / Noto Serif TC）
- 內文 `font-sans`（Inter / Noto Sans TC）
- 數字 `font-mono`

【風格】
- Claude / Notion 風，暖色紙感
- 不要霓虹色、不要 glow、不要 gradient 背景
- 圓角中等（rounded-md ~ rounded-lg）
- 陰影極輕或無

【頁面區塊（必要）】
1. 頁首：小標 "EXAM PRACTICE" + serif 大標 + 一句副文
2. 登入卡：未登入時是 form（username 帳號 + password 密碼 + 登入按鈕 + 規則說明）；已登入時顯示 username + 登出按鈕（admin 多一個「後台」按鈕）
3. 題數：4 個預設按鈕（10/20/30/40）+ 自訂 input
4. 題本列表：每項含 radio 指示 + 名稱 + 進度條 + 「精熟 X / 總 Y（剩 Z）」統計 + 百分比。進度條顏色 5 段（紅橘琥珀藍綠）
5. 組題模式：兩個 tab「全部隨機 / 混合錯題複習」；選混合時多一個「+ 錯題 N 題」input
6. 精熟排除 checkbox + 說明
7. 開始練習大按鈕

【RWD】手機優先，最大寬度 max-w-2xl

【Mock data 給 Artifact 預覽用】
```js
const mockCategories = ['11503-2_外幣題庫(北二專屬)', '11502_外幣考前衝刺(題目+答案)', '11503-2_外幣考前衝刺(北二專屬)', '115年_外幣考前衝刺(北二專屬)']
const mockMastery = {
  '全部': { total: 848, mastered: 30 },
  '11503-2_外幣題庫(北二專屬)': { total: 392, mastered: 15 },
  '11502_外幣考前衝刺(題目+答案)': { total: 181, mastered: 10 },
  '11503-2_外幣考前衝刺(北二專屬)': { total: 200, mastered: 5 },
  '115年_外幣考前衝刺(北二專屬)': { total: 75, mastered: 0 },
}
// 預覽可以 hardcode 一個 const mockAuthUser = '0408' 讓登入後狀態直接看到
```

請在 Artifact 中預覽新版，並在對話中輸出完整修改後的 Home.jsx 檔案內容（含所有 import 和函式）。

---PROMPT END---

---

## 目前 Home.jsx 的完整程式碼（整段複製附在 prompt 下方）

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategories, getRandomQuestions, getRandomWrongQuestions, login, getMasteryStats } from '../lib/api.js'

// 5 段進度配色
function progressColor(pct) {
  if (pct < 20) return '#b54545'
  if (pct < 40) return '#c96442'
  if (pct < 60) return '#b67a3a'
  if (pct < 80) return '#5b7f9a'
  return '#5b7f4f'
}

const COUNT_OPTIONS = [10, 20, 30, 40]

export default function Home() {
  const [count, setCount] = useState(20)
  const [customCount, setCustomCount] = useState('')
  const [category, setCategory] = useState('全部')
  const [categories, setCategories] = useState([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [mode, setMode] = useState('random')  // 'random' | 'mixed'
  const [wrongCount, setWrongCount] = useState(0)
  const [excludeMastered, setExcludeMastered] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  const [authUsername, setAuthUsername] = useState(localStorage.getItem('auth_username') || '')
  const [authRole, setAuthRole] = useState(localStorage.getItem('auth_role') || '')
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [masteryMap, setMasteryMap] = useState({})  // { [category]: { total, mastered } }

  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginErr('')
    setLoggingIn(true)
    try {
      const res = await login(loginUser.trim(), loginPass.trim())
      localStorage.setItem('auth_token', res.token)
      localStorage.setItem('auth_username', res.username)
      localStorage.setItem('auth_role', res.role)
      setAuthUsername(res.username)
      setAuthRole(res.role)
      setLoginUser('')
      setLoginPass('')
    } catch (err) {
      setLoginErr(err.message || '登入失敗')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_username')
    localStorage.removeItem('auth_role')
    setAuthUsername('')
    setAuthRole('')
  }

  useEffect(() => {
    getCategories()
      .then(data => { setCategories(['全部', ...data]); setLoadingCats(false) })
      .catch(() => { setCategories(['全部']); setLoadingCats(false) })
  }, [])

  useEffect(() => {
    if (!authUsername) { setMasteryMap({}); return }
    getMasteryStats()
      .then(list => {
        const map = {}
        let sumTotal = 0, sumMastered = 0
        for (const row of list) {
          map[row.category] = { total: row.total, mastered: row.mastered }
          sumTotal += row.total
          sumMastered += row.mastered
        }
        map['全部'] = { total: sumTotal, mastered: sumMastered }
        setMasteryMap(map)
      })
      .catch(() => setMasteryMap({}))
  }, [authUsername])

  const handleCustomCount = (val) => {
    const n = parseInt(val)
    setCustomCount(val)
    if (!isNaN(n) && n > 0) setCount(n)
  }

  const handlePresetCount = (n) => {
    setCount(n)
    setCustomCount('')
  }

  const cat = category === '全部' ? '' : category

  const start = async () => {
    setStartError('')
    if (!authUsername) { setStartError('請先登入再開始練習'); return }
    const newN = Math.max(0, Number(count) || 0)
    const wrongN = mode === 'mixed' ? Math.max(0, Number(wrongCount) || 0) : 0
    if (newN + wrongN === 0) { setStartError('題數不能為 0'); return }
    setStarting(true)
    try {
      const [newQs, wrongQs] = await Promise.all([
        newN > 0 ? getRandomQuestions(newN, cat, excludeMastered) : Promise.resolve([]),
        wrongN > 0 ? getRandomWrongQuestions(wrongN, cat, excludeMastered) : Promise.resolve([]),
      ])
      if (wrongN > 0 && wrongQs.length === 0) { setStartError('此分類下沒有錯題可複習'); setStarting(false); return }
      if (newQs.length === 0 && wrongQs.length === 0) { setStartError('沒有符合條件的題目'); setStarting(false); return }
      const seen = new Set()
      const merged = [...newQs, ...wrongQs].filter(q => {
        if (seen.has(q.id)) return false
        seen.add(q.id)
        return true
      })
      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[merged[i], merged[j]] = [merged[j], merged[i]]
      }
      navigate('/quiz', { state: { questions: merged, count: merged.length, category } })
    } catch (e) {
      setStartError(e.message || '載入失敗')
    } finally {
      setStarting(false)
    }
  }

  return (
    // === 這部分的 JSX 讓 Claude 幫你重新設計 ===
    // 需保留上面所有 state / handler / useEffect 不變
    // 只改 return 裡的 className 與結構
    null
  )
}
```
