-- Structured, non-clinical observations recorded when an activity session ends.
CREATE TABLE IF NOT EXISTS session_outcomes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES activity_sessions(id) ON DELETE CASCADE,
  resident_id TEXT REFERENCES residents(id) ON DELETE CASCADE,
  engagement_level INTEGER NOT NULL CHECK(engagement_level BETWEEN 1 AND 5),
  wellbeing_change TEXT NOT NULL CHECK(wellbeing_change IN ('improved','unchanged','declined','not_observed')),
  outcome_tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, resident_id)
);
CREATE INDEX IF NOT EXISTS session_outcomes_session ON session_outcomes(session_id);
CREATE INDEX IF NOT EXISTS session_outcomes_resident ON session_outcomes(resident_id, created_at);
