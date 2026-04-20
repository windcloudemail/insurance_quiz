import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategories, getRandomQuestions, getRandomWrongQuestions, login, getMasteryStats } from '../lib/api.js'

// 5 段進度配色 — Claude 暖色調
function progressColor(pct) {
  if (pct < 20) return '#b54545' // 赤陶紅
  if (pct < 40) return '#c96442' // 橘
  if (pct < 60) return '#b67a3a' // 琥珀
  if (pct < 80) return '#5b7f9a' // 藍灰
  return '#5b7f4f'               // 橄欖綠
}

const COUNT_OPTIONS = [10, 20, 30, 40]

export default function Home() {
  const [count, setCount] = useState(20)
  const [customCount, setCustomCount] = useState('')
  const [category, setCategory] = useState('全部')
  const [categories, setCategories] = useState([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [mode, setMode] = useState('random')
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
  const [masteryMap, setMasteryMap] = useState({})

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
      .then(data => {
        // 新格式：[{category, total}]；舊格式（string[]）也兼容
        const list = Array.isArray(data) && data.length > 0 && typeof data[0] === 'object'
          ? data
          : (data || []).map(c => ({ category: c, total: 0 }))
        const allTotal = list.reduce((s, r) => s + (r.total || 0), 0)
        setCategories([{ category: '全部', total: allTotal }, ...list])
        setLoadingCats(false)
      })
      .catch(() => { setCategories([{ category: '全部', total: 0 }]); setLoadingCats(false) })
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
    if (!authUsername) {
      setStartError('請先登入再開始練習')
      return
    }
    const newN = Math.max(0, Number(count) || 0)
    const wrongN = mode === 'mixed' ? Math.max(0, Number(wrongCount) || 0) : 0
    if (newN + wrongN === 0) {
      setStartError('題數不能為 0')
      return
    }
    setStarting(true)
    try {
      const [newQs, wrongQs] = await Promise.all([
        newN > 0 ? getRandomQuestions(newN, cat, excludeMastered) : Promise.resolve([]),
        wrongN > 0 ? getRandomWrongQuestions(wrongN, cat, excludeMastered) : Promise.resolve([]),
      ])
      if (wrongN > 0 && wrongQs.length === 0) {
        setStartError('此分類下沒有錯題可複習')
        setStarting(false)
        return
      }
      if (newQs.length === 0 && wrongQs.length === 0) {
        setStartError('沒有符合條件的題目（試試取消「排除精熟」或換分類）')
        setStarting(false)
        return
      }
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

  const inputCls = 'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-primary transition-colors'
  const tabBase = 'py-2.5 rounded-md font-medium text-sm border transition-all'
  const tabActive = 'border-primary bg-primary/5 text-primary'
  const tabIdle = 'border-border bg-surface text-ink-soft hover:border-border-strong hover:text-ink'

  return (
    <div className="fadeIn">
      {/* 標題 */}
      <div className="mb-8">
        <p className="text-xs tracking-widest text-primary/80 uppercase font-semibold mb-2">Exam Practice</p>
        <h1 className="font-display text-3xl font-semibold text-ink leading-tight">外幣保險練習</h1>
        <p className="text-ink-soft mt-2 text-[15px] leading-relaxed">選擇題庫與題數，開始隨機練習。</p>
      </div>

      {/* 登入 / 使用者資訊 */}
      {authUsername ? (
        <div className="mb-7 bg-surface border border-border rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-ink-soft text-sm">你好，</span>
            <span className="text-ink font-semibold text-sm font-mono truncate">{authUsername}</span>
            {authRole === 'admin' && <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded">管理員</span>}
          </div>
          <div className="flex gap-2 shrink-0">
            {authRole === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="text-xs px-3 py-1 border border-accent/40 text-accent rounded hover:bg-accent/10"
              >
                後台
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-1 border border-border text-ink-soft rounded hover:border-border-strong hover:text-ink"
            >
              登出
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="mb-7 bg-surface border border-border rounded-lg p-4">
          <p className="text-ink text-sm mb-3 font-serif font-semibold">登入以開始練習</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              value={loginUser}
              onChange={e => setLoginUser(e.target.value)}
              placeholder="帳號（生日 MMDD）"
              maxLength={20}
              className={inputCls}
              required
            />
            <input
              type="password"
              value={loginPass}
              onChange={e => setLoginPass(e.target.value)}
              placeholder="密碼（年份 YYYY）"
              className={inputCls}
              required
            />
          </div>
          {loginErr && <p className="text-wrong text-xs mb-2">{loginErr}</p>}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-2 bg-primary text-surface font-medium rounded-md hover:bg-primary-dim disabled:opacity-50 text-sm transition-colors"
          >
            {loggingIn ? '登入中…' : '登入 / 首次登入自動註冊'}
          </button>
          <p className="text-[11px] text-ink-faint mt-2.5 leading-relaxed">
            帳號為 4 位數生日月日（MMDD，例 1975/4/8 → <span className="font-mono text-ink-soft">0408</span>）、
            密碼為 4 位數年份（YYYY，例 <span className="font-mono text-ink-soft">1975</span>）。首次登入自動建立。管理員請用 <span className="font-mono text-ink-soft">admin</span>。
          </p>
        </form>
      )}

      {/* 題數 */}
      <section className="mb-7">
        <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">
          {mode === 'mixed' ? '新題數' : '題數'}
        </h2>
        <div className="grid grid-cols-4 gap-2 mb-2.5">
          {COUNT_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => handlePresetCount(n)}
              className={`${tabBase} ${count === n && !customCount ? tabActive : tabIdle}`}
            >
              {n} 題
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2">
          <span className="text-ink-faint text-xs font-mono shrink-0">自訂</span>
          <input
            type="number"
            min="1" max="999"
            placeholder="任意題數"
            value={customCount}
            onChange={e => handleCustomCount(e.target.value)}
            className="flex-1 bg-transparent text-sm text-ink focus:outline-none placeholder-ink-faint"
          />
          {customCount && <span className="text-primary text-xs font-mono">{count} 題</span>}
        </div>
      </section>

      {/* 題本 */}
      <section className="mb-7">
        <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">題本</h2>
        {loadingCats ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-card rounded-md animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {categories.map(c => {
              const catName = c.category
              const catTotal = c.total || 0
              const m = masteryMap[catName]
              const masteryTotal = m?.total ?? catTotal
              const mastered = m?.mastered || 0
              const remaining = masteryTotal - mastered
              const pct = masteryTotal > 0 ? (mastered / masteryTotal) * 100 : 0
              const color = progressColor(pct)
              const selected = category === catName
              return (
                <button
                  key={catName}
                  onClick={() => setCategory(catName)}
                  className={`w-full text-left px-4 py-3 rounded-md border transition-all ${selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-surface hover:border-border-strong'
                    }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selected ? 'bg-primary' : 'bg-border-strong'}`} />
                    <span className="flex-1 text-[15px] font-medium text-ink truncate">{catName === '全部' ? '全部分類' : catName}</span>
                    {catTotal > 0 && (
                      <span className="text-[12px] text-ink-soft font-mono shrink-0">{catTotal} 題</span>
                    )}
                    {selected && <span className="text-primary text-sm ml-1">✓</span>}
                  </div>
                  {authUsername && masteryTotal > 0 && (
                    <div className="pl-4">
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 text-[12px] font-mono">
                        <span className="text-ink-soft">
                          精熟 <span className="font-semibold" style={{ color }}>{mastered}</span> / {masteryTotal}（剩 {remaining}）
                        </span>
                        <span style={{ color }} className="font-semibold">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* 組題模式 */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-3">組題模式</h2>
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <button
            onClick={() => setMode('random')}
            className={`${tabBase} ${mode === 'random' ? tabActive : tabIdle}`}
          >
            全部隨機
          </button>
          <button
            onClick={() => { setMode('mixed'); if (wrongCount === 0) setWrongCount(5) }}
            className={`${tabBase} ${mode === 'mixed' ? tabActive : tabIdle}`}
          >
            混合錯題複習
          </button>
        </div>
        {mode === 'mixed' && (
          <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2">
            <span className="text-ink-faint text-xs font-mono shrink-0">+ 錯題</span>
            <input
              type="number"
              min="0" max="100"
              value={wrongCount}
              onChange={e => setWrongCount(Math.max(0, Number(e.target.value) || 0))}
              className="flex-1 bg-transparent text-sm text-ink focus:outline-none"
            />
            <span className="text-ink-faint text-xs font-mono shrink-0">題</span>
            <span className="text-primary text-xs font-semibold font-mono shrink-0 border-l border-border pl-2.5">
              共 {Number(count) + Number(wrongCount)} 題
            </span>
          </div>
        )}
      </section>

      {/* 精熟排除 */}
      <label className="mb-6 flex items-start gap-3 bg-surface border border-border rounded-md px-4 py-3 cursor-pointer hover:border-border-strong transition-all">
        <input
          type="checkbox"
          checked={excludeMastered}
          onChange={e => setExcludeMastered(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink font-medium">排除已精熟的題目</p>
          <p className="text-[11px] text-ink-faint mt-0.5">累積答對 3 次以上的題目暫時不出現，節省時間</p>
        </div>
      </label>

      {startError && (
        <p className="text-wrong text-xs mb-3 text-center">{startError}</p>
      )}
      <button
        onClick={start}
        disabled={starting}
        className="w-full py-3.5 bg-primary text-surface font-semibold rounded-md hover:bg-primary-dim disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {starting ? '載入中…' : '開始練習'}
        {!starting && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </button>
    </div>
  )
}
