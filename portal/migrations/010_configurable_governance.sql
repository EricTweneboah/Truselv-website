-- Configurable multi-tenant governance.  Values are deliberately bounded and
-- are enforced by the Worker; the portal is never the enforcement boundary.
PRAGMA foreign_keys = ON;

ALTER TABLE facilities ADD COLUMN platform_controls_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE facilities ADD COLUMN billing_contact_email TEXT;
ALTER TABLE facilities ADD COLUMN data_retention_days INTEGER NOT NULL DEFAULT 365;
ALTER TABLE facilities ADD COLUMN minimum_app_version TEXT;
ALTER TABLE facilities ADD COLUMN emergency_disabled INTEGER NOT NULL DEFAULT 0 CHECK(emergency_disabled IN (0,1));

ALTER TABLE facility_users ADD COLUMN permission_overrides_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE facility_users ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS organisation_content (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('video','document','link')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS organisation_content_facility_kind
  ON organisation_content(facility_id,kind,enabled);
