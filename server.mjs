import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const SHIPPING_COUNTRIES = 'CA MX US AG AI AW BB BL BM BQ BS BZ CR CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS NI PA PM PR SV SX TC TT VC VG AR BO BR BV CL CO EC FK GF GS GY PE PY SR UY VE AD AL AT AX BA BE BG BY CH CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW IO KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SH SL SN SO SS ST SZ TD TF TG TN TZ UG YT ZA ZM ZW'.split(' ');
const STRIPE_VERSION = '2026-08-26.dahlia; custom_checkout_payment_form_preview=v1';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

export function validateInquiry(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Invalid request.';
  if (!['demo', 'contact', 'order'].includes(data.kind)) return 'Choose a valid enquiry type.';
  if (data.website) return 'Invalid request.';
  if (typeof data.name !== 'string' || data.name.trim().length < 2 || data.name.length > 100) return 'Enter your name.';
  if (!validEmail(data.email)) return 'Enter a valid email address.';
  if (typeof data.message !== 'string' || data.message.trim().length < 10 || data.message.length > 5000) return 'Enter a message between 10 and 5000 characters.';
  if (!['on', true].includes(data.privacy)) return 'Acknowledge the privacy notice.';
  for (const field of ['organisation', 'postcode', 'role', 'product', 'topic', 'source']) {
    if (data[field] !== undefined && (typeof data[field] !== 'string' || data[field].length > 200)) return 'An enquiry field is too long.';
  }
  if (data.kind === 'demo' && (!data.organisation?.trim() || !data.role?.trim() || !['Bedbord', 'TESS', 'Both products'].includes(data.product))) return 'Complete your organisation, role and product.';
  return null;
}
export function validEmail(value) { return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value); }
export function checkoutReady(config, env) {
  const test = env.STRIPE_SECRET_KEY?.startsWith('sk_test_') && env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_');
  const live = env.STRIPE_SECRET_KEY?.startsWith('sk_live_') && env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_') && config.salesReady === true;
  return Boolean((test || live) && env.CHECKOUT_ENABLED === 'true' && config.legalName && config.companyNumber && config.registeredOffice && env.STRIPE_PRICE_ID);
}

async function bodyJSON(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('Expected JSON.'), { status: 415 });
  let size = 0, chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw Object.assign(new Error('Request too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}

export function createHandler({ config, env = process.env, fetcher = fetch, root = ROOT } = {}) {
  const limits = new Map();
  const siteUrl = new URL(env.SITE_URL || config.siteUrl).origin;
  const inquiriesEnabled = Boolean(env.RESEND_API_KEY && env.INQUIRY_FROM);
  const paymentsEnabled = checkoutReady(config, env);
  function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
  async function stripe(path, options = {}) {
    const response = await fetcher('https://api.stripe.com/v1/' + path, { ...options, headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': STRIPE_VERSION, ...(options.headers || {}) }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Object.assign(new Error('Payment service unavailable. No payment was taken by this request.'), { status: 502 });
    return response.json();
  }
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // JSON-LD is the only inline script; no inline executable scripts are used.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, siteUrl);
      if (url.pathname === '/shop.html' || url.pathname === '/shop') res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://js.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; connect-src 'self' https://api.stripe.com https://*.stripe.com; img-src 'self' data: https://*.stripe.com; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
      if (url.pathname.startsWith('/api/')) {
        if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
        const origin = req.headers.origin;
        if (req.method === 'POST' && origin !== siteUrl) return json(res, 403, { error: 'This request must come from the TruSelv website.' });
        const now = Date.now();
        for (const [key, entry] of limits) if (entry.until < now) limits.delete(key);
        const clientIP = env.TRUST_PROXY === 'true' ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
        const key = `${clientIP}:${req.method}:${url.pathname === '/api/addresses' ? 'lookup' : 'general'}`;
        const bucket = limits.get(key) || { count: 0, until: now + 600000 };
        bucket.count++; limits.set(key, bucket);
        if (bucket.count > (req.method === 'POST' ? 12 : 60)) return json(res, 429, { error: 'Too many requests. Please try again later or email TruSelv.' });
        if (url.pathname === '/api/inquiries' && req.method === 'POST') {
          if (!inquiriesEnabled) return json(res, 503, { error: 'Online delivery is not configured. Please use email.' });
          const data = await bodyJSON(req);
          const invalid = validateInquiry(data);
          if (invalid) return json(res, 422, { error: invalid });
          const allowed = ['name', 'email', 'organisation', 'postcode', 'role', 'product', 'topic', 'message', 'source'];
          const text = allowed.filter(k => data[k]).map(k => `${k}: ${data[k]}`).join('\n\n');
          const response = await fetcher('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: env.INQUIRY_FROM, to: ['support@truselv.co.uk'], reply_to: data.email, subject: `TruSelv ${data.kind} enquiry`, text }), signal: AbortSignal.timeout(15000)
          });
          if (!response.ok) return json(res, 502, { error: 'The enquiry could not be delivered. Please email TruSelv.' });
          const sent = await response.json();
          if (!sent.id) return json(res, 502, { error: 'Delivery could not be confirmed.' });
          return json(res, 200, { accepted: true });
        }
        if (url.pathname === '/api/addresses' && req.method === 'POST') {
          if (!env.IDEAL_POSTCODES_API_KEY) return json(res, 503, { error: 'Address lookup is unavailable. Enter your address manually.' });
          const data = await bodyJSON(req);
          const postcode = typeof data.postcode === 'string' ? data.postcode.replace(/\s/g, '').toUpperCase() : '';
          if (!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(postcode)) return json(res, 422, { error: 'Enter a complete UK postcode.' });
          const response = await fetcher(`https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${encodeURIComponent(env.IDEAL_POSTCODES_API_KEY)}`, { signal: AbortSignal.timeout(10000) });
          if (response.status === 404) return json(res, 200, { addresses: [] });
          if (!response.ok) return json(res, 502, { error: 'Address lookup is unavailable. Enter your address manually.' });
          const result = await response.json();
          if (result.code !== 2000 || !Array.isArray(result.result)) return json(res, 502, { error: 'Address lookup is unavailable. Enter your address manually.' });
          const addresses = result.result.slice(0, 100).map(a => ({ line1: String(a.line_1 || ''), line2: [a.line_2, a.line_3].filter(Boolean).join(', '), city: String(a.post_town || ''), state: String(a.county || ''), postal_code: String(a.postcode || ''), country: 'GB' }));
          return json(res, 200, { addresses });
        }
        if (url.pathname === '/api/checkout' && req.method === 'POST') {
          if (!paymentsEnabled) return json(res, 503, { error: 'Checkout is not available yet. Please send an order enquiry.' });
          const data = await bodyJSON(req);
          if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 50 || !validEmail(data.email) || data.termsAccepted !== true) return json(res, 422, { error: 'Review your quantity, email and terms.' });
          // Never accept client-supplied amounts, Price IDs, shipping or redirect URLs.
          const price = await stripe(`prices/${encodeURIComponent(env.STRIPE_PRICE_ID)}`);
          if (!price.active || price.type !== 'one_time' || price.currency !== 'gbp' || price.unit_amount !== config.tessUnitPrice * 100 || price.tax_behavior !== 'inclusive') return json(res, 503, { error: 'The product price needs review. Please contact TruSelv.' });
          const fields = new URLSearchParams({ mode: 'payment', ui_mode: 'form', 'line_items[0][price]': env.STRIPE_PRICE_ID, 'line_items[0][quantity]': String(data.quantity), billing_address_collection: 'auto', submit_type: 'auto', 'phone_number_collection[enabled]': 'false', 'automatic_tax[enabled]': 'false', integration_identifier: 'custom_embedded_web_0001' });
          SHIPPING_COUNTRIES.forEach((country, index) => fields.set(`shipping_address_collection[allowed_countries][${index}]`, country));
          const session = await stripe('checkout/sessions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': randomUUID() }, body: fields.toString() });
          if (!session.client_secret || !session.id) return json(res, 502, { error: 'The checkout could not be initialized.' });
          return json(res, 200, { client_secret: session.client_secret, session_id: session.id });
        }
        if (url.pathname === '/api/order-status' && req.method === 'GET') {
          if (!paymentsEnabled) return json(res, 503, { error: 'Payment verification unavailable.' });
          const id = url.searchParams.get('session_id');
          if (!/^cs_(test|live)_[A-Za-z0-9]{10,250}$/.test(id || '')) return json(res, 400, { error: 'Invalid session.' });
          const session = await stripe(`checkout/sessions/${encodeURIComponent(id)}?expand[]=line_items`);
          // No name, email, address or financial details are exposed.
          const lines = session.line_items?.data;
          return json(res, 200, { paid: session.mode === 'payment' && session.payment_status === 'paid' && session.status === 'complete' && lines?.length === 1 && lines[0].price?.id === env.STRIPE_PRICE_ID });
        }
        return json(res, 404, { error: 'Endpoint not found.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
      if (url.pathname === '/js/site-config.js') {
        const publicConfig = { ...config, inquiryEndpoint: inquiriesEnabled ? '/api/inquiries' : '', checkoutEndpoint: paymentsEnabled ? '/api/checkout' : '', orderStatusEndpoint: paymentsEnabled ? '/api/order-status' : '', stripePublishableKey: paymentsEnabled ? env.STRIPE_PUBLISHABLE_KEY : '', checkoutTestMode: paymentsEnabled && env.STRIPE_SECRET_KEY.startsWith('sk_test_'), addressEndpoint: env.IDEAL_POSTCODES_API_KEY ? '/api/addresses' : '', shippingCountries: SHIPPING_COUNTRIES };
        res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
        return res.end(req.method === 'HEAD' ? '' : 'window.TRUSELV_CONFIG = ' + JSON.stringify(publicConfig) + ';');
      }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Invalid URL.' }); }
      if (pathname === '/') pathname = '/index.html';
      if (pathname === '/more/' || pathname === '/more') { res.writeHead(301, { Location: '/resources.html' }); return res.end(); }
      const retired = { care: 'index', 'home-improvements': 'index', careers: 'about', folda: 'bedbord', ngage: 'tess', teevy: 'tess', documentation: 'resources', 'compliance-blog': 'trust', 'edi-blog': 'accessibility', 'innovation-blog': 'about', Partnership: 'partnerships' };
      const routeName = pathname.slice(1).replace(/\.html$/, '');
      if (retired[routeName]) { res.writeHead(301, { Location: '/' + retired[routeName] + '.html' }); return res.end(); }
      if (/^\/[a-zA-Z0-9-]+$/.test(pathname)) {
        try { await stat(resolve(root, '.' + pathname + '.html')); res.writeHead(301, { Location: pathname + '.html' }); return res.end(); } catch { /* Use the useful 404 below. */ }
      }
      const permitted = /^\/[a-zA-Z0-9-]+\.html$/.test(pathname) || /^\/(assets|downloads)\/[a-zA-Z0-9_.-]+$/.test(pathname) || /^\/(css\/site\.css|js\/site\.js|robots\.txt|sitemap\.xml)$/.test(pathname) || /^\/documents\/(Bedbord-solution|TruSelv-Investor-ready)\.pdf$/.test(pathname);
      const path = resolve(root, '.' + pathname);
      if (!permitted || !path.startsWith(resolve(root) + sep)) { res.writeHead(404, { 'Content-Type': MIME['.html'] }); return res.end(await readFile(resolve(root, '404.html'))); }
      let info;
      try { info = await stat(path); if (!info.isFile()) throw new Error(); }
      catch { res.writeHead(404, { 'Content-Type': MIME['.html'] }); return res.end(await readFile(resolve(root, '404.html'))); }
      const headers = { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': extname(path) === '.html' ? 'no-cache' : 'public, max-age=3600', 'Accept-Ranges': 'bytes' };
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let start, end;
        if (match && (match[1] || match[2])) { start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2])); end = match[1] && match[2] ? Number(match[2]) : info.size - 1; }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size || start < 0) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return res.end(); }
        end = Math.min(end, info.size - 1);
        res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${info.size}` });
        if (req.method === 'HEAD') return res.end();
        return createReadStream(path, { start, end }).on('error', () => res.destroy()).pipe(res);
      }
      res.writeHead(200, { ...headers, 'Content-Length': info.size });
      if (req.method === 'HEAD') return res.end();
      createReadStream(path).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      json(res, error.status || 500, { error: error.status ? error.message : 'The service could not complete this request. Please contact TruSelv.' });
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(await readFile(resolve(ROOT, 'site.config.json'), 'utf8'));
  const port = Number(process.env.PORT || 4173);
  const server = http.createServer(createHandler({ config }));
  server.requestTimeout = 30000; server.headersTimeout = 15000;
  server.listen(port, '0.0.0.0', () => console.log(`TruSelv preview: http://localhost:${port}`));
}
