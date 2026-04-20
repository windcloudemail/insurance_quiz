-- 外幣保險考題練習網站 — 資料庫結構
-- 執行方式：npx wrangler d1 execute exam-quiz-db --file=.cloudflare/schema.sql

CREATE TABLE IF NOT EXISTS questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_number INTEGER,                            -- 題本原始題號（來自匯入檔案），便於回查實體題本
  category      TEXT    NOT NULL DEFAULT '外幣保險',
  difficulty    TEXT    NOT NULL DEFAULT 'medium',  -- easy / medium / hard
  question      TEXT    NOT NULL,
  question_part2 TEXT   NOT NULL DEFAULT '',
  option_1      TEXT    NOT NULL,
  option_2      TEXT    NOT NULL,
  option_3      TEXT    NOT NULL,
  option_4      TEXT    NOT NULL,
  answer        INTEGER NOT NULL,                   -- 1, 2, 3, 或 4
  explanation   TEXT    NOT NULL DEFAULT '',
  order_index   INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,        -- 累計答對次數
  wrong_count   INTEGER NOT NULL DEFAULT 0,        -- 累計答錯次數
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 索引：加速依分類篩選 + 依題本原題號排序
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(category, source_number);

-- 匯入失敗紀錄：parser 解析不出來的題目暫存於此，供後台手動補建後刪除
CREATE TABLE IF NOT EXISTS import_failures (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_number INTEGER,
  category      TEXT,
  reason        TEXT NOT NULL,          -- no_options / bad_answer / parse_error ...
  raw_body      TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_failures_category ON import_failures(category, source_number);

-- 使用者帳號（簡易版，密碼明文儲存，供自用 / 親友圈使用）
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL UNIQUE,        -- admin 或 4 位數字 (MMDD)
  password   TEXT    NOT NULL,                -- admin 自訂 / 一般用戶為 4 位數字 (YYYY)
  role       TEXT    NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin');

-- 每位使用者的答題歷程：per-user 錯題複習、per-user 精熟排除都依靠此表
CREATE TABLE IF NOT EXISTS user_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  question_id  INTEGER NOT NULL,
  correct      INTEGER NOT NULL,  -- 0 / 1
  attempted_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_attempts_uq ON user_attempts(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_user_attempts_uqc ON user_attempts(user_id, question_id, correct);

-- 預設分類範例資料（可刪除）
INSERT INTO questions (category, question, option_1, option_2, option_3, option_4, answer, explanation)
VALUES (
  '管理外匯條例',
  '「管理外匯條例」第3條規定，掌理外匯業務機關為何？',
  '金管會', '財政部', '國貿局', '中央銀行',
  4,
  '掌理外匯業務的機關為中央銀行；而管理外匯的行政主管機關則為金管會，兩者角色不同，要特別區分。'
);
