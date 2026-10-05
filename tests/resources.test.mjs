import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {adminResources, publicResources} from '../website-content/content.mjs';
import portal from '../portal/worker.mjs';

function storage() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../website-content/schema.sql', import.meta.url), 'utf8'));
  const files = new Map();
  return {
    RESOURCE_DB: {prepare(sql) {
      const statement = db.prepare(sql); let args = [];
      return {bind(...values) { args = values; return this; }, async first() { return statement.get(...args) || null; }, async all() { return {results: statement.all(...args)}; }, async run() { return {meta: statement.run(...args)}; }};
    }},
    RESOURCE_FILES: {async put(key, bytes) {files.set(key, bytes);}, async get(key) {const bytes = files.get(key); return bytes ? {body: bytes, size: bytes.length} : null;}, async delete(key) {files.delete(key);}},
    files
  };
}
const admin = {role: 'truselv_admin', email: 'admin@example.com'};
const values = {title: 'A useful guide', summary: 'Practical information.', body: 'First paragraph.\n\nSecond paragraph.', category: 'Planning', action: 'draft'};
function write(env, changes = {}, id = '', file, headers = {}) {
  const form = new FormData(); form.set('details', JSON.stringify({...values, ...changes}));
  if (file) form.set('file', file);
  return adminResources(new Request(`https://admin.truselv.co.uk/api/admin/resources${id ? '/' + id : ''}`, {method: 'POST', headers: {Origin: 'https://admin.truselv.co.uk', 'X-TruSelv-Editor': '1', ...headers}, body: form}), env, admin);
}
const listing = env => publicResources(new Request('https://truselv.co.uk/api/resources'), env).then(response => response.json());

test('draft, publish, draft edits, revision conflict and unpublish preserve visibility boundaries', async () => {
  const env = storage();
  const first = await write(env); assert.equal(first.status, 201);
  const {id} = await first.json(); assert.equal((await listing(env)).resources.length, 0);
  assert.equal((await write(env, {action: 'publish', revision: 1}, id)).status, 200);
  assert.equal((await listing(env)).resources[0].title, values.title);
  assert.equal((await write(env, {title: 'Private draft', revision: 2}, id)).status, 200);
  assert.equal((await listing(env)).resources[0].title, values.title);
  assert.equal((await write(env, {title: 'Stale overwrite', revision: 2}, id)).status, 409);
  assert.equal((await write(env, {action: 'publish', title: 'New public title', revision: 3}, id)).status, 200);
  assert.equal((await listing(env)).resources[0].title, 'New public title');
  assert.equal((await write(env, {action: 'unpublish', revision: 4}, id)).status, 200);
  assert.equal((await listing(env)).resources.length, 0);
});

test('draft files are private; replacement stays private until published; unpublish disables downloads', async () => {
  const env = storage(), file = new File(['%PDF-1.7\nexample'], 'guide.pdf', {type: 'application/pdf'});
  const created = await write(env, {}, '', file), {id} = await created.json();
  const download = () => publicResources(new Request(`https://truselv.co.uk/api/resources/${id}/file`), env);
  assert.equal((await download()).status, 404);
  await write(env, {action: 'publish', revision: 1}, id);
  const response = await download(); assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /^attachment/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), '%PDF-1.7\nexample');
  const listed = (await listing(env)).resources[0]; assert.equal(listed.file.key, undefined); assert.equal(listed.updated_by, undefined);
  await write(env, {revision: 2}, id, new File(['%PDF-1.7\nprivate replacement'], 'new.pdf'));
  assert.equal(await (await download()).text(), '%PDF-1.7\nexample');
  await write(env, {action: 'unpublish', revision: 3}, id);
  assert.equal((await download()).status, 404);
});

test('admin authorization, origin and editor header are required', async () => {
  const env = storage(), url = 'https://admin.truselv.co.uk/api/admin/resources';
  for (const role of ['facility_admin', 'viewer', 'ward_analytics']) {
    assert.equal((await adminResources(new Request(url), env, {role})).status, 403);
  }
  assert.equal((await write(env, {}, '', null, {Origin: 'https://evil.example'})).status, 403);
  assert.equal((await write(env, {}, '', null, {'X-TruSelv-Editor': ''})).status, 403);
  assert.equal((await portal.fetch(new Request(url), {DB: {}, PORTAL_HOST: 'portal.truselv.co.uk'})).status, 401);
});

test('invalid, empty, oversized and executable documents cannot be published', async () => {
  const env = storage();
  assert.equal((await write(env, {title: ''})).status, 400);
  assert.equal((await write(env, {action: 'publish', body: ''})).status, 400);
  assert.equal((await write(env, {category: '<script>'})).status, 400);
  assert.equal((await write(env, {}, '', new File(['<script>bad</script>'], 'fake.pdf'))).status, 400);
  assert.equal((await write(env, {}, '', new File(['<html>'], 'page.html'))).status, 400);
  assert.equal((await write(env, {}, '', new File(['PK archive'], 'macros.docm'))).status, 400);
  assert.equal((await write(env, {}, '', new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.txt'))).status, 413);
  assert.equal(env.files.size, 0);
});
