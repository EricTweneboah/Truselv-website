-- TESS facility portal: Cloudflare D1 schema.
-- Never store plain-text device credentials or unencrypted resident identifiers.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','pending')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wards (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  access_policy_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(facility_id, name)
);
CREATE INDEX IF NOT EXISTS wards_facility ON wards(facility_id, active);

CREATE TABLE IF NOT EXISTS facility_users (
  id TEXT PRIMARY KEY,
  facility_id TEXT REFERENCES facilities(id) ON DELETE CASCADE,
  ward_id TEXT REFERENCES wards(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('truselv_admin','facility_admin','facility_head','activities_lead','viewer','ward_analytics')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(facility_id, email)
);
CREATE INDEX IF NOT EXISTS facility_users_email ON facility_users(email);

CREATE TABLE IF NOT EXISTS licences (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','expired')),
  seats INTEGER NOT NULL CHECK(seats > 0),
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
  licence_id TEXT REFERENCES licences(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended','retired')),
  activation_token_hash TEXT NOT NULL,
  last_seen_at TEXT,
  app_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS devices_facility ON devices(facility_id);

CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  ward_id TEXT REFERENCES wards(id) ON DELETE SET NULL,
  first_name_cipher TEXT NOT NULL,
  last_name_cipher TEXT NOT NULL,
  dob_cipher TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS residents_facility ON residents(facility_id, active);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ward_id TEXT NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
  resident_id TEXT REFERENCES residents(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  event_name TEXT NOT NULL,
  duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds >= 0),
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS usage_events_facility_date ON usage_events(facility_id, occurred_at);
CREATE INDEX IF NOT EXISTS usage_events_feature ON usage_events(facility_id, feature, occurred_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_log_facility_date ON audit_log(facility_id, created_at);
