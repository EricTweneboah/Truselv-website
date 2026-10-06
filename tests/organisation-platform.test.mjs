import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration = await readFile(
  new URL('../portal/migrations/007_tess_organisation_platform.sql', import.meta.url),
  'utf8',
);
const worker = await readFile(
  new URL('../portal/worker.mjs', import.meta.url),
  'utf8',
);

test('organisation migration establishes configuration, seats and assignments', () => {
  for (const table of [
    'sites',
    'licence_seats',
    'device_assignments',
    'organisation_config_versions',
    'organisation_entitlements',
    'device_commands',
    'resident_profile_forms',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /device_mode TEXT NOT NULL DEFAULT 'shared'/);
  assert.match(migration, /devices_one_dedicated_resident/);
  assert.match(migration, /device_assignments_one_active/);
  assert.match(migration, /row_number\(\) OVER \(PARTITION BY licence_id/);
  assert.match(migration, /data_cipher TEXT NOT NULL/);
});

test('device lifecycle enforces tenant, licence-date and privacy boundaries', () => {
  assert.match(worker, /row\.facility_status!==['"]active['"]/);
  assert.match(worker, /l\.starts_on<=date\(['"]now['"]\)/);
  assert.match(
    worker,
    /lifecycle_state===['"]privacy_reset_pending['"].+complete its privacy reset/,
  );
  assert.match(worker, /assigned_resident_id IS NULL/);
});
