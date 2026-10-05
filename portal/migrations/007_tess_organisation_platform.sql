-- TESS Standard / Organisation multi-tenant platform foundation.
-- This migration is additive so existing facility devices and portal users
-- continue to work while organisation configuration is introduced.
PRAGMA foreign_keys = ON;

ALTER TABLE facilities ADD COLUMN slug TEXT;
ALTER TABLE facilities ADD COLUMN plan TEXT NOT NULL DEFAULT 'organisation'
  CHECK(plan IN ('standard','organisation','dedicated'));
ALTER TABLE facilities ADD COLUMN terminology_person TEXT NOT NULL DEFAULT 'resident';
ALTER TABLE facilities ADD COLUMN terminology_unit TEXT NOT NULL DEFAULT 'ward';

CREATE UNIQUE INDEX IF NOT EXISTS facilities_slug ON facilities(slug);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(facility_id,name)
);
CREATE INDEX IF NOT EXISTS sites_facility_status ON sites(facility_id,status);

ALTER TABLE wards ADD COLUMN site_id TEXT REFERENCES sites(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS wards_site ON wards(site_id,active);

ALTER TABLE devices ADD COLUMN ownership TEXT NOT NULL DEFAULT 'customer_owned'
  CHECK(ownership IN ('customer_owned','truselv_supplied'));
ALTER TABLE devices ADD COLUMN device_mode TEXT NOT NULL DEFAULT 'shared'
  CHECK(device_mode IN ('shared','dedicated'));
ALTER TABLE devices ADD COLUMN assigned_resident_id TEXT REFERENCES residents(id) ON DELETE SET NULL;
ALTER TABLE devices ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'ready'
  CHECK(lifecycle_state IN ('ready','assigned','privacy_reset_pending','lost','retired'));
ALTER TABLE devices ADD COLUMN configuration_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS devices_assignment ON devices(facility_id,assigned_resident_id);
CREATE UNIQUE INDEX IF NOT EXISTS devices_one_dedicated_resident
  ON devices(facility_id,assigned_resident_id)
  WHERE device_mode='dedicated' AND assigned_resident_id IS NOT NULL AND status!='retired';

CREATE TABLE IF NOT EXISTS licence_seats (
  id TEXT PRIMARY KEY,
  licence_id TEXT NOT NULL REFERENCES licences(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','assigned','suspended')),
  assigned_at TEXT,
  released_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(licence_id,seat_number),
  UNIQUE(device_id)
);
CREATE INDEX IF NOT EXISTS licence_seats_facility_status ON licence_seats(facility_id,status);

CREATE TABLE IF NOT EXISTS device_assignments (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  resident_id TEXT NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  assigned_by TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  ended_by TEXT,
  ended_reason TEXT CHECK(ended_reason IS NULL OR ended_reason IN ('reassigned','discharged','deceased','device_replaced','other')),
  privacy_reset_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS device_assignments_device_date ON device_assignments(device_id,started_at);
CREATE INDEX IF NOT EXISTS device_assignments_resident_date ON device_assignments(resident_id,started_at);
CREATE UNIQUE INDEX IF NOT EXISTS device_assignments_one_active
  ON device_assignments(device_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS organisation_config_versions (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','superseded')),
  config_json TEXT NOT NULL,
  change_summary TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  UNIQUE(facility_id,version)
);
CREATE INDEX IF NOT EXISTS organisation_config_status
  ON organisation_config_versions(facility_id,status,version);

CREATE TABLE IF NOT EXISTS organisation_entitlements (
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  quota INTEGER,
  starts_at TEXT,
  ends_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(facility_id,feature_id)
);

CREATE TABLE IF NOT EXISTS device_commands (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  command TEXT NOT NULL CHECK(command IN ('refresh_config','privacy_reset','revoke','restart')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','acknowledged','completed','failed','cancelled')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS device_commands_pending ON device_commands(device_id,status,created_at);

CREATE TABLE IF NOT EXISTS resident_profile_forms (
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  resident_id TEXT NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  data_cipher TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(facility_id,resident_id,form_id)
);
CREATE INDEX IF NOT EXISTS resident_profile_forms_resident
  ON resident_profile_forms(facility_id,resident_id,updated_at);

-- Existing aggregate licences become numbered seats without disturbing
-- currently linked devices. Seat reconciliation is completed by the Worker.
INSERT OR IGNORE INTO licence_seats (id,licence_id,facility_id,seat_number,status)
SELECT l.id || '-seat-' || printf('%04d',n.value),l.id,l.facility_id,n.value,'available'
FROM licences l
JOIN (
  WITH RECURSIVE numbers(value) AS (
    SELECT 1 UNION ALL SELECT value+1 FROM numbers WHERE value<10000
  ) SELECT value FROM numbers
) n ON n.value<=l.seats;

-- Preserve existing device/licence relationships by assigning the first
-- numbered seats to existing non-retired devices in deterministic order.
WITH ranked_devices AS (
  SELECT id,licence_id,
    row_number() OVER (PARTITION BY licence_id ORDER BY created_at,id) AS seat_number
  FROM devices
  WHERE licence_id IS NOT NULL AND status!='retired'
)
UPDATE licence_seats
SET device_id=(
      SELECT ranked_devices.id FROM ranked_devices
      WHERE ranked_devices.licence_id=licence_seats.licence_id
        AND ranked_devices.seat_number=licence_seats.seat_number
    ),
    status='assigned',
    assigned_at=CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM ranked_devices
  WHERE ranked_devices.licence_id=licence_seats.licence_id
    AND ranked_devices.seat_number=licence_seats.seat_number
);
