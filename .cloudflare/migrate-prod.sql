-- Production D1 migration：idempotent 版（重跑不會爆）
-- 只用 CREATE IF NOT EXISTS / INSERT OR IGNORE
-- ALTER TABLE 部分已註解（線上已 apply，SQLite 沒有 ADD COLUMN IF NOT EXISTS）
--
-- 如果是全新的 D1，請改用 schema.sql

-- ⚠️ 以下三條 ALTER 已於早期一次性 apply 過，重跑會 'duplicate column'。
-- 如果是新建 D1，請手動取消註解後再跑（或直接用 schema.sql）。
-- ALTER TABLE questions ADD COLUMN source_number INTEGER;
-- ALTER TABLE questions ADD COLUMN correct_count INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE questions ADD COLUMN wrong_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(category, source_number);

CREATE TABLE IF NOT EXISTS import_failures (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_number INTEGER,
  category      TEXT,
  reason        TEXT NOT NULL,
  raw_body      TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_failures_category ON import_failures(category, source_number);

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL UNIQUE,
  password   TEXT    NOT NULL,
  role       TEXT    NOT NULL DEFAULT 'user',
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin');

CREATE TABLE IF NOT EXISTS user_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  question_id  INTEGER NOT NULL,
  correct      INTEGER NOT NULL,
  attempted_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_attempts_uq ON user_attempts(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_user_attempts_uqc ON user_attempts(user_id, question_id, correct);

-- 使用者對單題的標記：有疑義 / 手動精熟 / 備註
-- flagged=1 進「有疑義題目」清單；manual_mastered=1 視同精熟，不再出現
CREATE TABLE IF NOT EXISTS user_question_marks (
  user_id          INTEGER NOT NULL,
  question_id      INTEGER NOT NULL,
  flagged          INTEGER NOT NULL DEFAULT 0,
  flag_note        TEXT    NOT NULL DEFAULT '',
  manual_mastered  INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_marks_user_flagged ON user_question_marks(user_id, flagged);
CREATE INDEX IF NOT EXISTS idx_marks_user_master ON user_question_marks(user_id, manual_mastered);
