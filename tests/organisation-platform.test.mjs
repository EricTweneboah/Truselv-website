import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration = await readFile(
  new URL('../portal/migrations/007_tess_organisation_platform.sql', import.meta.url),
  'utf8',
);
const productTierMigration = await readFile(
  new URL('../portal/migrations/008_product_tiers.sql', import.meta.url),
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

test('commercial model exposes only Standard and Organisation tiers', () => {
  assert.match(productTierMigration, /SET plan='organisation' WHERE plan='dedicated'/);
  assert.match(worker, /const normalisedPlan=value=>value==='standard'\?'standard':'organisation'/);
  assert.match(worker, /Organisation setup is available with TESS Organisation/);
  assert.match(worker, /Resident-assigned tablets require TESS Organisation/);
  assert.doesNotMatch(worker, /\['standard','organisation','dedicated'\]\.includes/);
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

test('staff directories paginate on the server and expose audit history', () => {
  assert.match(worker, /function pageRequest\(url\)/);
  assert.match(worker, /function pageResponse\(items,total/);
  for (const route of [
    '/api/admin/portfolio',
    '/api/facilities',
    '/api/support/tickets',
    '/api/wards',
    '/api/devices',
    '/api/licences',
    '/api/residents',
    '/api/users',
    '/api/audit',
  ]) {
    const routePattern = route.replaceAll('/', '\\/');
    assert.match(worker, new RegExp(`${routePattern}.*request\\.method===['"]GET['"]`));
  }
  assert.match(worker, /LIMIT \? OFFSET \?/);
  assert.match(worker, /FROM audit_log a/);
});

test('device and staff control planes are host-isolated', () => {
  assert.match(worker, /Cf-Access-Jwt-Assertion/);
  assert.match(worker, /hostname!==\(env\.ADMIN_HOST/);
  assert.match(worker, /hostname===deviceHost&&!isDeviceRoute/);
  assert.match(worker, /hostname!==deviceHost&&isDeviceRoute/);
  assert.match(worker, /url\.hostname===deviceHost&&!url\.pathname\.startsWith\(['"]\/api\/device\//);
  assert.match(worker, /url\.pathname\.startsWith\(['"]\/api\/admin\/['"]\)&&url\.hostname!==adminHost/);
});

test('portal sessions refresh both server expiry and browser cookie', () => {
  assert.match(worker, /async function refreshLogin/);
  assert.match(worker, /Set-Cookie['"]?:sessionCookie\(token\)/);
  assert.match(worker, /\/api\/auth\/refresh/);
});

test('support summary is calculated across the complete scoped directory', () => {
  assert.match(worker, /SELECT status,COUNT\(\*\) count FROM support_tickets/);
  assert.match(worker, /return json\(\{tickets,messages,summary,categories/);
});
