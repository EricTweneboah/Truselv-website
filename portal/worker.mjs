const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const fail = (message, status = 400) => json({ error: message }, status);
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const roles = ['truselv_admin', 'facility_admin', 'activities_lead', 'viewer'];
const canManage = role => ['truselv_admin', 'facility_admin'].includes(role);
const canSeeResidents = role => ['truselv_admin', 'facility_admin', 'activities_lead'].includes(role);

function emailFromAccess(request, env) {
  const header = env.ACCESS_HEADER || 'Cf-Access-Authenticated-User-Email';
  return (request.headers.get(header) || env.DEV_IDENTITY_EMAIL || '').trim().toLowerCase();
}
async function identity(request, env) {
  const email = emailFromAccess(request, env);
  if (!email) throw Object.assign(new Error('Sign in is required.'), { status: 401 });
  const user = await env.DB.prepare('SELECT u.id, u.facility_id, u.email, u.role, u.active, f.name AS facility_name, f.status AS facility_status FROM facility_users u LEFT JOIN facilities f ON f.id=u.facility_id WHERE u.email=? AND u.active=1 LIMIT 1').bind(email).first();
  if (!user || (user.facility_id && user.facility_status !== 'active')) throw Object.assign(new Error('Your account does not have active portal access.'), { status: 403 });
  return user;
}
function assertRole(user, predicate) { if (!predicate(user.role)) throw Object.assign(new Error('You do not have permission for this action.'), { status: 403 }); }
function scopedFacility(user, facilityId) {
  if (user.role === 'truselv_admin') return facilityId;
  if (!user.facility_id || (facilityId && facilityId !== user.facility_id)) throw Object.assign(new Error('Facility access denied.'), { status: 403 });
  return user.facility_id;
}
async function body(request, limit = 65536) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > limit) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  try { return await request.json(); } catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); }
}
async function key(env) {
  if (!env.FIELD_ENCRYPTION_KEY) throw Object.assign(new Error('Portal encryption is not configured.'), { status: 503 });
  const raw = Uint8Array.from(atob(env.FIELD_ENCRYPTION_KEY), c => c.charCodeAt(0));
  if (raw.length !== 32) throw Object.assign(new Error('Portal encryption configuration is invalid.'), { status: 503 });
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const bytesToB64 = bytes => btoa(String.fromCharCode(...bytes));
const b64ToBytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function encrypt(env, value) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), new TextEncoder().encode(value)); return `${bytesToB64(iv)}.${bytesToB64(new Uint8Array(encrypted))}`; }
async function decrypt(env, value) { const [iv, data] = value.split('.'); const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(iv) }, await key(env), b64ToBytes(data)); return new TextDecoder().decode(plain); }
async function hash(value) { return bytesToB64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); }
async function audit(env, user, action, targetType, targetId = null, details = {}) { await env.DB.prepare('INSERT INTO audit_log (id,facility_id,actor_email,action,target_type,target_id,details_json) VALUES (?,?,?,?,?,?,?)').bind(uuid(), user.facility_id || null, user.email, action, targetType, targetId, JSON.stringify(details)).run(); }
const clean = (value, max) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null;

async function device(request, env) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '');
  if (!match) throw Object.assign(new Error('A device key is required.'), { status: 401 });
  const row = await env.DB.prepare('SELECT d.*, l.status AS licence_status FROM devices d LEFT JOIN licences l ON l.id=d.licence_id WHERE d.activation_token_hash=? LIMIT 1').bind(await hash(match[1])).first();
  if (!row) throw Object.assign(new Error('Device access denied.'), { status: 401 });
  return row;
}
async function dashboard(env, facilityId) {
  const values = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS count FROM residents WHERE facility_id=? AND active=1').bind(facilityId).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM devices WHERE facility_id=? AND status='active'").bind(facilityId).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM licences WHERE facility_id=? AND status='active'").bind(facilityId).first(),
    env.DB.prepare("SELECT feature, COUNT(*) AS count FROM usage_events WHERE facility_id=? AND occurred_at>=datetime('now','-30 days') GROUP BY feature ORDER BY count DESC LIMIT 5").bind(facilityId).all(),
    env.DB.prepare("SELECT COUNT(DISTINCT resident_id) AS count FROM usage_events WHERE facility_id=? AND resident_id IS NOT NULL AND occurred_at>=datetime('now','-30 days')").bind(facilityId).first()
  ]);
  return { residents: values[0].count, activeDevices: values[1].count, activeLicences: values[2].count, featureUsage: values[3].results, activeResidents30d: values[4].count };
}

async function api(request, env, url) {
  if (!env.DB) return fail('Database binding is not configured.', 503);
  if (url.pathname === '/api/device/bootstrap' && request.method === 'GET') {
    const d = await device(request, env);
    await env.DB.prepare('UPDATE devices SET last_seen_at=? WHERE id=?').bind(now(), d.id).run();
    return json({ deviceId: d.id, facilityId: d.facility_id, status: d.status, licenceStatus: d.licence_status || 'missing', enabled: d.status === 'active' && d.licence_status === 'active' });
  }
  if (url.pathname === '/api/device/activate' && request.method === 'POST') {
    const d = await device(request, env);
    if (d.status === 'retired' || d.status === 'suspended') return fail('This device cannot be activated.', 403);
    if (d.licence_status !== 'active') return fail('This device does not have an active licence.', 403);
    await env.DB.prepare("UPDATE devices SET status='active',last_seen_at=? WHERE id=?").bind(now(), d.id).run();
    return json({ deviceId: d.id, status: 'active' });
  }
  if (url.pathname === '/api/device/events' && request.method === 'POST') {
    const d = await device(request, env);
    if (d.status !== 'active' || d.licence_status !== 'active') return fail('This device is not active.', 403);
    const input = await body(request); const events = Array.isArray(input.events) ? input.events : [];
    if (!events.length || events.length > 100) return fail('Send between 1 and 100 events.');
    const writes = [];
    for (const event of events) {
      if (!/^[a-zA-Z0-9-]{16,64}$/.test(event.id || '') || !clean(event.feature, 80) || !clean(event.eventName, 80) || Number(event.durationSeconds) < 0 || Number(event.durationSeconds) > 86400 || Number.isNaN(Date.parse(event.occurredAt))) return fail('One or more usage events are invalid.');
      if (event.residentId) { const resident = await env.DB.prepare('SELECT id FROM residents WHERE id=? AND facility_id=? AND active=1').bind(event.residentId, d.facility_id).first(); if (!resident) return fail('A usage event references an invalid resident.'); }
      writes.push(env.DB.prepare('INSERT OR IGNORE INTO usage_events (id,facility_id,device_id,resident_id,feature,event_name,duration_seconds,occurred_at) VALUES (?,?,?,?,?,?,?,?)').bind(event.id, d.facility_id, d.id, event.residentId || null, event.feature.trim(), event.eventName.trim(), Math.floor(Number(event.durationSeconds)), new Date(event.occurredAt).toISOString()));
    }
    await env.DB.batch(writes); await env.DB.prepare('UPDATE devices SET last_seen_at=? WHERE id=?').bind(now(), d.id).run();
    return json({ accepted: events.length }, 202);
  }
  const user = await identity(request, env);
  if (url.pathname === '/api/me' && request.method === 'GET') return json({ email: user.email, role: user.role, facilityId: user.facility_id, facilityName: user.facility_name });
  if (url.pathname === '/api/facilities' && request.method === 'GET') { assertRole(user, r => r === 'truselv_admin'); return json({ facilities: (await env.DB.prepare('SELECT id,name,status,created_at FROM facilities ORDER BY name').all()).results }); }
  if (url.pathname === '/api/facilities' && request.method === 'POST') { assertRole(user, r => r === 'truselv_admin'); const input = await body(request); const name = clean(input.name, 150); if (!name) return fail('A facility name is required.'); const id = uuid(); await env.DB.prepare('INSERT INTO facilities (id,name,status) VALUES (?,?,?)').bind(id,name,'pending').run(); await audit(env,user,'facility.created','facility',id,{name}); return json({ id, name, status: 'pending' },201); }
  if (url.pathname === '/api/dashboard' && request.method === 'GET') { const facilityId = scopedFacility(user, url.searchParams.get('facilityId')); if (!facilityId) return fail('Choose a facility.', 400); return json(await dashboard(env,facilityId)); }
  if (url.pathname === '/api/devices' && request.method === 'GET') { const facilityId = scopedFacility(user,url.searchParams.get('facilityId')); if (!facilityId) return fail('Choose a facility.',400); return json({ devices:(await env.DB.prepare('SELECT id,label,platform,status,last_seen_at,app_version,licence_id,created_at FROM devices WHERE facility_id=? ORDER BY created_at DESC').bind(facilityId).all()).results }); }
  if (url.pathname === '/api/devices' && request.method === 'POST') { assertRole(user,canManage); const input=await body(request); const facilityId=scopedFacility(user,input.facilityId); const label=clean(input.label,100); const licenceId=clean(input.licenceId,64); if (!facilityId || !label || !licenceId) return fail('Facility, device label and licence are required.'); const licence=await env.DB.prepare("SELECT id FROM licences WHERE id=? AND facility_id=? AND status='active'").bind(licenceId,facilityId).first(); if(!licence)return fail('Choose an active facility licence.'); const id=uuid(), deviceKey=bytesToB64(crypto.getRandomValues(new Uint8Array(32))); await env.DB.prepare('INSERT INTO devices (id,facility_id,licence_id,label,activation_token_hash) VALUES (?,?,?,?,?)').bind(id,facilityId,licenceId,label,await hash(deviceKey)).run(); await audit(env,user,'device.created','device',id,{label}); return json({id,label,deviceKey,notice:'Copy this device key now. It cannot be viewed again.'},201); }
  if (url.pathname === '/api/licences' && request.method === 'GET') { const facilityId=scopedFacility(user,url.searchParams.get('facilityId')); if(!facilityId)return fail('Choose a facility.',400); return json({licences:(await env.DB.prepare('SELECT id,status,seats,starts_on,ends_on,created_at FROM licences WHERE facility_id=? ORDER BY created_at DESC').bind(facilityId).all()).results}); }
  if (url.pathname === '/api/licences' && request.method === 'POST') { assertRole(user,r=>r==='truselv_admin'); const input=await body(request); const facilityId=clean(input.facilityId,64), seats=Number(input.seats), startsOn=clean(input.startsOn,10), endsOn=clean(input.endsOn,10); if(!facilityId||!Number.isInteger(seats)||seats<1||seats>10000||!/^\d{4}-\d{2}-\d{2}$/.test(startsOn||''))return fail('A facility, seat count and start date are required.'); const id=uuid(); await env.DB.prepare('INSERT INTO licences (id,facility_id,seats,starts_on,ends_on) VALUES (?,?,?,?,?)').bind(id,facilityId,seats,startsOn,endsOn).run(); await audit(env,user,'licence.created','licence',id,{facilityId,seats}); return json({id},201); }
  if (url.pathname === '/api/residents' && request.method === 'GET') { assertRole(user,canSeeResidents); const facilityId=scopedFacility(user,url.searchParams.get('facilityId')); if(!facilityId)return fail('Choose a facility.',400); const rows=(await env.DB.prepare('SELECT id,first_name_cipher,last_name_cipher,dob_cipher,active,created_at FROM residents WHERE facility_id=? ORDER BY created_at DESC').bind(facilityId).all()).results; return json({residents:await Promise.all(rows.map(async r=>({id:r.id,firstName:await decrypt(env,r.first_name_cipher),lastName:await decrypt(env,r.last_name_cipher),dateOfBirth:await decrypt(env,r.dob_cipher),active:Boolean(r.active),createdAt:r.created_at}))) }); }
  if (url.pathname === '/api/residents' && request.method === 'POST') { assertRole(user,canManage); const input=await body(request); const facilityId=scopedFacility(user,input.facilityId); const first=clean(input.firstName,100),last=clean(input.lastName,100),dob=clean(input.dateOfBirth,10); if(!facilityId||!first||!last||!/^\d{4}-\d{2}-\d{2}$/.test(dob||''))return fail('First name, last name and date of birth are required.'); const id=uuid(); await env.DB.prepare('INSERT INTO residents (id,facility_id,first_name_cipher,last_name_cipher,dob_cipher) VALUES (?,?,?,?,?)').bind(id,facilityId,await encrypt(env,first),await encrypt(env,last),await encrypt(env,dob)).run(); await audit(env,user,'resident.created','resident',id); return json({id},201); }
  if (url.pathname === '/api/users' && request.method === 'GET') { assertRole(user,canManage); const facilityId=scopedFacility(user,url.searchParams.get('facilityId')); if(!facilityId)return fail('Choose a facility.',400); return json({users:(await env.DB.prepare('SELECT id,email,role,active,created_at FROM facility_users WHERE facility_id=? ORDER BY email').bind(facilityId).all()).results}); }
  if (url.pathname === '/api/users' && request.method === 'POST') { assertRole(user,canManage); const input=await body(request); const facilityId=scopedFacility(user,input.facilityId), email=clean(input.email,254)?.toLowerCase(), role=clean(input.role,40); if(!facilityId||!email||!/^\S+@\S+\.\S+$/.test(email)||!roles.includes(role)||role==='truselv_admin')return fail('A valid work email and facility role are required.'); const id=uuid(); await env.DB.prepare('INSERT INTO facility_users (id,facility_id,email,role) VALUES (?,?,?,?)').bind(id,facilityId,email,role).run(); await audit(env,user,'user.provisioned','user',id,{email,role}); return json({id,email,role},201); }
  return fail('Not found.',404);
}

export default { async fetch(request,env) { const url=new URL(request.url); if(url.pathname.startsWith('/api/')) { try { if(!['GET','POST'].includes(request.method))return fail('Method not allowed.',405); return await api(request,env,url); } catch(error) { return fail(error.message||'The request could not be completed.',error.status||500); } } return env.ASSETS.fetch(request); } };
