-- D1 schema for the community routes. No names, emails or accounts: every id is random.
-- Apply once: npx wrangler d1 execute leonidas-community --file schema.sql (add --local for tests).

-- "I'm stuck" reports. The id is made on the device and is NOT the analytics install id.
CREATE TABLE IF NOT EXISTS stuck_reports (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL,
  screen TEXT NOT NULL,
  last_action TEXT NOT NULL,
  error_code TEXT,
  provider TEXT,
  source TEXT NOT NULL,
  issue_number INTEGER,
  fixed_in TEXT,
  fixed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_stuck_issue ON stuck_reports (issue_number);

-- Friends leaderboard. board_id is a random id made for this feature only.
CREATE TABLE IF NOT EXISTS boards (
  code TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

-- nickname is NULL while the member stays anonymous.
CREATE TABLE IF NOT EXISTS members (
  code TEXT NOT NULL,
  board_id TEXT NOT NULL,
  nickname TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (code, board_id)
);

CREATE TABLE IF NOT EXISTS scores (
  code TEXT NOT NULL,
  board_id TEXT NOT NULL,
  week TEXT NOT NULL,
  words INTEGER NOT NULL,
  messages INTEGER NOT NULL,
  active_days INTEGER NOT NULL,
  tokens INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (code, board_id, week)
);
