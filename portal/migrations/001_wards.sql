-- Adds ward-scoped analytics. Rebuild facility_users to extend its role check.
PRAGMA foreign_keys = OFF;

CREATE TABLE facility_users_new (
  id TEXT PRIMARY KEY,
  facility_id TEXT REFERENCES facilities(id) ON DELETE CASCADE,
  ward_id TEXT REFERENCES wards(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('truselv_admin','facility_admin','facility_head','activities_lead','viewer','ward_analytics')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(facility_id, email)
);

CREATE TABLE wards (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(facility_id, name)
);
CREATE INDEX wards_facility ON wards(facility_id, active);

INSERT INTO facility_users_new (id, facility_id, ward_id, email, role, active, created_at)
SELECT id, facility_id, NULL, email, role, active, created_at FROM facility_users;
DROP TABLE facility_users;
ALTER TABLE facility_users_new RENAME TO facility_users;
CREATE INDEX facility_users_email ON facility_users(email);

ALTER TABLE devices ADD COLUMN ward_id TEXT REFERENCES wards(id) ON DELETE RESTRICT;
ALTER TABLE residents ADD COLUMN ward_id TEXT REFERENCES wards(id) ON DELETE SET NULL;
ALTER TABLE usage_events ADD COLUMN ward_id TEXT REFERENCES wards(id) ON DELETE RESTRICT;
CREATE INDEX devices_ward ON devices(ward_id);
CREATE INDEX usage_events_ward_date ON usage_events(ward_id, occurred_at);
PRAGMA foreign_keys = ON;
