// 所有 API 呼叫集中在這裡，方便維護

const BASE = '/api'

// 一次性 migration：把舊的 admin_token 搬到新的 auth_* 鍵
if (typeof localStorage !== 'undefined') {
  if (!localStorage.getItem('auth_token') && localStorage.getItem('admin_token')) {
    localStorage.setItem('auth_token', localStorage.getItem('admin_token'))
    localStorage.setItem('auth_username', 'admin')
    localStorage.setItem('auth_role', 'admin')
    localStorage.removeItem('admin_token')
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem('auth_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    headers: { ...headers, ...(options.headers || {}) },
    ...options,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '發生錯誤')
  return json.data
}

// 隨機抽題（可選 exclude_mastered 排除已答對 ≥ 3 次的題，需已登入才生效）
export const getRandomQuestions = (count = 20, category = '', excludeMastered = false) =>
  request(`/questions/random?count=${count}&category=${encodeURIComponent(category)}${excludeMastered ? '&exclude_mastered=1' : ''}`)

// 從曾經答錯過的題庫隨機抽（錯題複習模式，per-user）
export const getRandomWrongQuestions = (count = 10, category = '', excludeMastered = false) =>
  request(`/questions/random-wrong?count=${count}&category=${encodeURIComponent(category)}${excludeMastered ? '&exclude_mastered=1' : ''}`)

// 錯題加強練習（wrong > right 的題，按 (wrong-right) DESC 排序）
export const getWrongPriorityQuestions = (count = 20, category = '') =>
  request(`/questions/wrong-priority?count=${count}&category=${encodeURIComponent(category)}`)

// 未攻克題數（wrong > right 的題數），給 Home 按鈕顯示用
export const getWrongPriorityCount = (category = '') =>
  request(`/stats/wrong-priority-count?category=${encodeURIComponent(category)}`)

// 上報答題結果（累加 correct_count / wrong_count）
export const submitAttempts = (attempts) =>
  request('/attempts', { method: 'POST', body: JSON.stringify(attempts) })

// 取得所有題目（後台用）
export const getAllQuestions = (page = 1, category = '') =>
  request(`/questions?page=${page}&category=${encodeURIComponent(category)}`)

// 取得所有不重複的分類
export const getCategories = () =>
  request('/questions/categories')


// 取得單一題目
export const getQuestion = (id) =>
  request(`/questions/${id}`)

// 新增題目
export const createQuestion = (data) =>
  request('/questions', { method: 'POST', body: JSON.stringify(data) })

// 批次新增題目（一次 D1 batch 送多題，效能比逐題 POST 快 10-50x）
export const bulkCreateQuestions = (questions) =>
  request('/questions/bulk', { method: 'POST', body: JSON.stringify({ questions }) })

// 匯入失敗紀錄：parser 抽不出的題目暫存此表，供後台手動補建
export const getImportFailures = () =>
  request('/import-failures')

export const bulkCreateFailures = (failures) =>
  request('/import-failures/bulk', { method: 'POST', body: JSON.stringify({ failures }) })

export const deleteImportFailure = (id) =>
  request(`/import-failures/${id}`, { method: 'DELETE' })

// 更新題目
export const updateQuestion = (id, data) =>
  request(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) })

// 刪除題目
export const deleteQuestion = (id) =>
  request(`/questions/${id}`, { method: 'DELETE' })

// 批次更新題目順序
export const reorderQuestions = (orderedIds) =>
  request('/questions/reorder', { method: 'POST', body: JSON.stringify({ orderedIds }) })

// 登入（支援 admin / 一般用戶統一流程；一般用戶首次登入會自動建立帳號）
export const login = (username, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })

// 取得當前使用者身分（Cloudflare Access SSO 通過後自動帶入；fallback 使用 token）
export const getMe = () =>
  request('/auth/me')

// 每分類精熟度統計（per-user）：回 [{ category, total, mastered }, ...]
export const getMasteryStats = () =>
  request('/stats/mastery')
