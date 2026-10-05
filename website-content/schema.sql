CREATE TABLE IF NOT EXISTS website_resources (
  id TEXT PRIMARY KEY,
  draft_json TEXT NOT NULL,
  published_json TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
