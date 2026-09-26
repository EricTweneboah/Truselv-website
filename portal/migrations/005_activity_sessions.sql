-- Records optional named individual/group activity sessions on facility devices.
CREATE TABLE IF NOT EXISTS activity_sessions (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
  mode TEXT NOT NULL CHECK(mode IN ('individual','group')),
  anonymous INTEGER NOT NULL DEFAULT 0 CHECK(anonymous IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS activity_sessions_facility_started ON activity_sessions(facility_id, started_at);
CREATE INDEX IF NOT EXISTS activity_sessions_device_status ON activity_sessions(device_id, status);

CREATE TABLE IF NOT EXISTS activity_session_residents (
  session_id TEXT NOT NULL REFERENCES activity_sessions(id) ON DELETE CASCADE,
  resident_id TEXT NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  PRIMARY KEY(session_id, resident_id)
);
CREATE INDEX IF NOT EXISTS activity_session_residents_resident ON activity_session_residents(resident_id);

ALTER TABLE usage_events ADD COLUMN session_id TEXT REFERENCES activity_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS usage_events_session ON usage_events(session_id);
