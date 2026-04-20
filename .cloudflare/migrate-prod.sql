-- Production D1 migration：補上 local 已有但 production 缺的欄位與表
-- 只用 ALTER / CREATE IF NOT EXISTS，不會動到既有資料

ALTER TABLE questions ADD COLUMN source_number INTEGER;
ALTER TABLE questions ADD COLUMN correct_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE questions ADD COLUMN wrong_count INTEGER NOT NULL DEFAULT 0;

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
