import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHandler, validateInquiry, checkoutReady } from '../server.mjs';

const base = JSON.parse(await readFile(new URL('../site.config.json', import.meta.url), 'utf8'));
const ready = { ...base, salesReady: true, legalName: 'Test seller', companyNumber: '12345678', registeredOffice: 'Test address' };
const enabledEnv = { SITE_URL: 'https://truselv.example', CHECKOUT_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_PRICE_ID: 'price_test', STRIPE_PUBLISHABLE_KEY: 'pk_test_fake' };
async function fixture(t, config = base, env = {}, fetcher = () => { throw new Error('Unexpected external request'); }) {
  const server = http.createServer(createHandler({ config, env: { SITE_URL: 'https://truselv.example', ...env }, fetcher }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { get: (path, options) => fetch(url + path, options), post: (path, data, origin = 'https://truselv.example') => fetch(url + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) };
}

test('static files and byte-range video work; source secrets stay private', async t => {
  const api = await fixture(t);
  const home = await api.get('/'); assert.equal(home.status, 200); assert.match(await home.text(), /The person/);
  const retired = await api.get('/home-improvements', { redirect: 'manual' }); assert.equal(retired.status, 301); assert.equal(retired.headers.get('location'), '/index.html');
  const cleanUrl = await api.get('/tess', { redirect: 'manual' }); assert.equal(cleanUrl.status, 301); assert.equal(cleanUrl.headers.get('location'), '/tess.html');
  for (const path of ['/.env','/site.config.json','/server.mjs','/.git/config','/scripts/build_site.py']) assert.equal((await api.get(path)).status, 404);
  const range = await api.get('/assets/welcome.mp4', { headers: { Range: 'bytes=0-99' } });
  assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 100);
  assert.equal((await api.get('/assets/welcome.mp4', { headers: { Range: 'bytes=9999999999-' } })).status, 416);
  const config = await (await api.get('/js/site-config.js')).text(); assert.match(config, /"checkoutEndpoint":""/); assert.doesNotMatch(config, /sk_test/);
});
test('checkout stays disabled without explicit complete configuration', async t => {
  assert.equal(checkoutReady(base, enabledEnv), true);
  assert.equal(checkoutReady({...base,salesReady:false}, {...enabledEnv, STRIPE_SECRET_KEY: 'sk_live_fake', STRIPE_PUBLISHABLE_KEY: 'pk_live_fake'}), false);
  assert.equal(checkoutReady(ready, {...enabledEnv, STRIPE_PUBLISHABLE_KEY: 'pk_live_fake'}), false);
  assert.equal(checkoutReady(ready, {}), false);
  const api = await fixture(t);
  assert.equal((await api.post('/api/checkout', { quantity: 1 })).status, 503);
  assert.equal((await api.post('/api/inquiries', {})).status, 503);
});
test('Resend demo uses fixed support recipient and visitor Reply-To', async t => {
  const api = await fixture(t, base, {RESEND_API_KEY:'secret-email-key',INQUIRY_FROM:'website@truselv.co.uk'}, async (url,options) => {
    assert.equal(url,'https://api.resend.com/emails');
    const email = JSON.parse(options.body);
    assert.deepEqual(email.to,['support@truselv.co.uk']); assert.equal(email.reply_to,'visitor@example.com'); assert.match(email.text,/Bedbord/);
    return new Response(JSON.stringify({id:'accepted-message'}));
  });
  const data = {kind:'demo',name:'Test Visitor',email:'visitor@example.com',organisation:'Example care',role:'Manager',product:'Bedbord',message:'Please arrange a product demonstration.',privacy:'on',to:'attacker@example.com'};
  assert.deepEqual(await (await api.post('/api/inquiries',data)).json(),{accepted:true});
});
test('cross-origin requests, invalid quantities and unacknowledged terms are rejected', async t => {
  const api = await fixture(t, ready, enabledEnv);
  assert.equal((await api.post('/api/checkout', {}, 'https://other.example')).status, 403);
  for (const quantity of [0,-1,1.5,51,'2',null]) assert.equal((await api.post('/api/checkout', { quantity, email: 'buyer@example.com', termsAccepted: true, shippingAddress: {line1:'1 Test Road',city:'London',postal_code:'SW1A 1AA',country:'GB'} })).status, 422);
  assert.equal((await api.post('/api/checkout', { quantity: 1, email: 'buyer@example.com', termsAccepted: false })).status, 422);
});
test('embedded checkout uses verified server price and configured parameters, ignoring client amounts', async t => {
  const calls = [];
  const api = await fixture(t, ready, enabledEnv, async (url, options) => {
    calls.push([url,options]);
    return new Response(JSON.stringify(url.includes('/prices/') ? { active: true, type: 'one_time', currency: 'gbp', unit_amount: 11900, tax_behavior: 'unspecified' } : { client_secret: 'cs_test_secret', id: 'cs_test_12345678901' }), { status: 200 });
  });
  const response = await api.post('/api/checkout', { quantity: 2, email: 'buyer@example.com', termsAccepted: true, shippingAddress: {line1:'1 Test Road',city:'London',postal_code:'SW1A 1AA',country:'GB'}, amount: 1, shippingAmount: 1, price: 'cheap', success_url: 'https://bad.example' });
  assert.equal(response.status, 200);
  const fields = new URLSearchParams(calls[1][1].body);
  assert.equal(fields.get('line_items[0][quantity]'), '2'); assert.equal(fields.get('line_items[0][price]'), 'price_test');
  assert.deepEqual(fields.getAll('shipping_address_collection[allowed_countries][0]'), ['GB']);
  assert.equal(fields.has('shipping_address_collection[allowed_countries][1]'), false);
  assert.equal(fields.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '0');
  assert.equal(fields.get('shipping_options[1][shipping_rate_data][fixed_amount][amount]'), '499');
  assert.equal(fields.get('shipping_options[1][shipping_rate_data][fixed_amount][currency]'), 'gbp');
  assert.equal(fields.get('shipping_options[1][shipping_rate_data][display_name]'), 'Next working day (order before 6pm UK time)');
  assert.equal(fields.get('mode'), 'payment'); assert.equal(fields.get('ui_mode'), 'form'); assert.equal(fields.has('success_url'), false); assert.equal(fields.get('billing_address_collection'), 'auto'); assert.equal(fields.get('automatic_tax[enabled]'), 'false'); assert.match(calls[1][1].headers['Stripe-Version'], /custom_checkout_payment_form_preview=v1/); assert.deepEqual(await response.json(), {client_secret:'cs_test_secret',session_id:'cs_test_12345678901'});
});
test('a changed price or recurring price cannot be charged', async t => {
  const api = await fixture(t, ready, enabledEnv, async () => new Response(JSON.stringify({ active: true, type: 'recurring', currency: 'gbp', unit_amount: 11900, tax_behavior: 'unspecified' })));
  assert.equal((await api.post('/api/checkout', { quantity: 1, email: 'buyer@example.com', termsAccepted: true, shippingAddress: {line1:'1 Test Road',city:'London',postal_code:'SW1A 1AA',country:'GB'} })).status, 503);
});
test('order status only reports confirmed TESS payments and returns no personal data', async t => {
  let paid = false;
  const api = await fixture(t, ready, enabledEnv, async () => new Response(JSON.stringify({ payment_status: paid ? 'paid' : 'unpaid', status: 'complete', mode: 'payment', line_items: { data: [{ price: { id: 'price_test' } }] }, customer_details: { email: 'private@example.com' } })));
  const path = '/api/order-status?session_id=cs_test_12345678901';
  assert.deepEqual(await (await api.get(path)).json(), { paid: false }); paid = true;
  assert.deepEqual(await (await api.get(path)).json(), { paid: true });
});
test('enquiry validation and provider failure cannot show false success', async t => {
  const data = { kind: 'contact', name: 'Test Person', email: 'test@example.com', message: 'A product question for the team.', privacy: 'on' };
  assert.equal(validateInquiry(data), null); assert.notEqual(validateInquiry({ ...data, email: 'bad\r\n@example.com' }), null);
  assert.notEqual(validateInquiry({ ...data, website: 'spam' }), null);
  assert.notEqual(validateInquiry({ ...data, privacy: false }), null);
  let success = false;
  const api = await fixture(t, base, { RESEND_API_KEY: 'fake', INQUIRY_FROM: 'website@example.com' }, async () => new Response(JSON.stringify(success ? { id: 'test-message' } : { error: 'failed' }), { status: success ? 200 : 500 }));
  assert.equal((await api.post('/api/inquiries', data)).status, 502); success = true;
  assert.deepEqual(await (await api.post('/api/inquiries', data)).json(), { accepted: true });
});

test('checkout requires a complete delivery address', async t => {
 const api = await fixture(t, ready, enabledEnv);
 for (const shippingAddress of [undefined, {}, {line1:"1 Road",city:"Paris",postal_code:"75001",country:"FR"}, {line1:' ',city:'London',postal_code:'SW1A 1AA',country:'GB'}, {line1:'1 Road',city:'',postal_code:'SW1A 1AA',country:'GB'}]) {
  assert.equal((await api.post('/api/checkout',{quantity:1,email:'buyer@example.com',termsAccepted:true,shippingAddress})).status,422);
 }
});
