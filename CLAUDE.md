# 外幣保險考題練習網站 — AI 開發指引

這份文件是給 Claude 或任何 AI 工具看的專案說明。
每次開始新的對話，請先把這份文件貼給 AI，讓它了解專案背景。

---

## 專案概述

一個供備考外幣保險證照人員使用的線上練習網站。
使用者可以隨機抽題、作答後立即看到答案與解說，管理員可以透過後台管理題庫。

---

## 技術架構

| 層次 | 技術 | 說明 |
|------|------|------|
| 前端 | React 18 + Vite | 元件化開發 |
| 樣式 | Tailwind CSS v3 | utility-first CSS |
| 路由 | React Router v6 | SPA 路由 |
| 部署 | Cloudflare Pages | 靜態網站托管 |
| 後端 API | Cloudflare Workers (Pages Functions) | `/functions/api/` 目錄 |
| 資料庫 | Cloudflare D1 (SQLite) | 題庫與紀錄 |
| 版本控制 | GitHub | 推送後自動部署 |

---

## 專案目錄結構

```
insurance_quiz/
├── CLAUDE.md                  ← 你現在看的這份文件
├── README.md                  ← 給人看的說明
├── package.json
├── vite.config.js
├── tailwind.config.js
├── wrangler.toml              ← Cloudflare 設定
├── .cloudflare/
│   └── schema.sql             ← D1 資料庫建表 SQL
├── public/
│   └── favicon.ico
├── src/
│   ├── main.jsx               ← React 進入點
│   ├── App.jsx                ← 路由設定
│   ├── index.css              ← Tailwind 引入
│   ├── lib/
│   │   └── api.js             ← 所有 API 呼叫集中在這裡
│   ├── components/
│   │   ├── Layout.jsx         ← 頁面外框（導覽列等）
│   │   ├── QuestionCard.jsx   ← 題目卡片元件
│   │   ├── OptionButton.jsx   ← 選項按鈕元件
│   │   └── ExplanationBox.jsx ← 解說區塊元件
│   └── pages/
│       ├── Home.jsx           ← 首頁（選題數、分類）
│       ├── Quiz.jsx           ← 練習頁（核心作答流程）
│       ├── Result.jsx         ← 結果頁（分數與回顧）
│       └── Admin.jsx          ← 後台題庫管理
└── functions/
    └── api/
        ├── questions/
        │   ├── index.js       ← GET /api/questions, POST /api/questions
        │   ├── random.js      ← GET /api/questions/random?count=20
        │   └── [id].js        ← GET/PUT/DELETE /api/questions/:id
        └── _middleware.js     ← CORS 與錯誤處理
```

---

## 資料庫結構

### questions 資料表（題庫）

```sql
CREATE TABLE questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT    NOT NULL DEFAULT '外幣保險',
  difficulty  TEXT    NOT NULL DEFAULT 'medium',
  question    TEXT    NOT NULL,
  option_1    TEXT    NOT NULL,
  option_2    TEXT    NOT NULL,
  option_3    TEXT    NOT NULL,
  option_4    TEXT    NOT NULL,
  answer      INTEGER NOT NULL,  -- 1, 2, 3, 或 4
  explanation TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

## API 端點

| 端點 | 方法 | 說明 | 參數 |
|------|------|------|------|
| `/api/questions/random` | GET | 隨機抽題 | `?count=20&category=全部` |
| `/api/questions` | GET | 所有題目 | `?category=xxx&page=1` |
| `/api/questions` | POST | 新增題目 | JSON body |
| `/api/questions/:id` | GET | 單一題目 | - |
| `/api/questions/:id` | PUT | 更新題目 | JSON body |
| `/api/questions/:id` | DELETE | 刪除題目 | - |

### API 回傳格式（統一）

```json
// 成功
{ "success": true, "data": ... }

// 失敗
{ "success": false, "error": "錯誤訊息" }
```

---

## 設計風格

- **色彩**：深藍主色 `#1e3a5f`、琥珀金強調色 `#f0a500`
- **背景**：深色 `#0f1923`（長時間閱讀不刺眼）
- **字體**：Noto Sans TC（中文）
- **動畫**：答題後對錯提示用 fadeIn，不過度動畫
- **版面**：最大寬度 720px 置中，左右留白

---

## 核心作答流程（Quiz.jsx）

```
1. 進入頁面 → 呼叫 /api/questions/random 取得題目陣列
2. 顯示第 N 題的 QuestionCard + 四個 OptionButton
3. 使用者點選選項 → 禁止再次點選
4. 顯示 ExplanationBox（答對綠色 / 答錯紅色 + 正確答案）
5. 使用者點「下一題」→ 重複步驟 2
6. 全部答完 → 導向 /result，傳遞答題結果
```

---

## 環境變數

本機開發時在 `.dev.vars` 設定（不要 commit）：

```
# 目前不需要額外環境變數
# D1 資料庫透過 wrangler.toml 綁定
```

---

## 常見開發任務

### 新增一個頁面
1. 在 `src/pages/` 建立新的 `.jsx` 檔
2. 在 `src/App.jsx` 的 Routes 裡新增路由

### 新增一個 API 端點
1. 在 `functions/api/` 對應路徑建立 `.js` 檔
2. 匯出 `onRequestGet` / `onRequestPost` 等函式

### 本機開發
```bash
npm run dev        # 啟動前端開發伺服器
npx wrangler pages dev --d1 DB=<DB_ID>  # 含 D1 的完整本機測試
```

### 部署
```bash
git add . && git commit -m "說明" && git push
# Cloudflare Pages 會自動偵測並重新部署
```

---

## 注意事項

- D1 使用 SQLite 語法，**不支援** `RANDOM()` 以外的複雜函式
- Pages Functions 每個檔案對應一個路由，命名規則遵循 Cloudflare 規範
- `[id].js` 的方括號是 Cloudflare 動態路由語法，不是錯誤
- 所有 API 呼叫集中在 `src/lib/api.js`，避免散落各元件
