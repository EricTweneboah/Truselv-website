import {orderWebhook} from './order-emails.mjs';
import {createResourceAccessToken, hasResourceAccess, validateResourceLead} from './resource-access.mjs';
import {validatePurchaseToken} from './purchase-access.mjs';
export const SHIPPING_COUNTRIES = ['GB'];
const STRIPE_VERSION = '2026-08-26.dahlia; custom_checkout_payment_form_preview=v1';
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

// Shared Request/Response API used by Node and Cloudflare Workers.
async function bodyJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw Object.assign(new Error('Expected JSON.'), {status:415});
  const reader = request.body?.getReader();
  let size = 0, parts = [];
  if (reader) while (true) {
    const {done,value} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw Object.assign(new Error('Request too large.'), {status:413}); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { const value = JSON.parse(new TextDecoder().decode(bytes)); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw Object.assign(new Error('Invalid JSON.'), {status:400}); }
}
export function publicConfig(config, env) {
  const enabled = checkoutReady(config, env) && Boolean(env.PURCHASE_LINK_SECRET);
  return {email:config.email, inquiryEndpoint: env.RESEND_API_KEY && env.INQUIRY_FROM ? '/api/inquiries' : '', resourceAccessEndpoint: env.RESEND_API_KEY && env.INQUIRY_FROM && env.RESOURCE_ACCESS_SECRET ? '/api/resource-access' : '', checkoutEndpoint: enabled ? '/api/checkout' : '', orderStatusEndpoint: enabled ? '/api/order-status' : '', stripePublishableKey: enabled ? env.STRIPE_PUBLISHABLE_KEY : '', checkoutTestMode: enabled && env.STRIPE_SECRET_KEY.startsWith('sk_test_'), shippingCountries: SHIPPING_COUNTRIES};
}
export function createApi({config, env, fetcher = fetch, rateLimit} = {}) {
  const limits = new Map();
  const siteUrl = new URL(env.SITE_URL || config.siteUrl).origin;
  const inquiriesEnabled = Boolean(env.RESEND_API_KEY && env.INQUIRY_FROM);
  const paymentsEnabled = checkoutReady(config, env) && Boolean(env.PURCHASE_LINK_SECRET);
  function json(status, data, headers = {}) { return Response.json(data, {status, headers:{'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', ...headers}}); }
  async function stripe(path, options = {}) {
    const response = await fetcher('https://api.stripe.com/v1/' + path, {...options, headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version':STRIPE_VERSION, ...(options.headers || {})}, signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Object.assign(new Error('Payment service unavailable. Please try again or contact TruSelv.'), {status:502});
    return response.json();
  }
  const randomUUID = () => crypto.randomUUID();
  return async (request, clientIP = 'unknown') => {
    try {
      const url = new URL(request.url);
      if (!['GET','POST'].includes(request.method)) return json(405, {error:'Method not allowed.'});
      if (url.pathname === '/api/stripe-webhook' && request.method === 'POST') {
        await orderWebhook(request,{env,stripe,fetcher});
        return json(200,{received:true});
      }
      if (request.method === 'POST' && request.headers.get('origin') !== siteUrl) return json(403, {error:'This request must come from the TruSelv website.'});
      if (rateLimit) {
        if (!await rateLimit(clientIP + ':' + request.method)) return json(429, {error:'Too many requests. Please try again later.'});
      } else {
        const now = Date.now();
        for (const [key,entry] of limits) if (entry.until < now) limits.delete(key);
        const key = clientIP + ':' + request.method;
        if (!limits.has(key) && limits.size >= 10000) return json(429, {error:'Please try again later.'});
        const bucket = limits.get(key) || {count:0, until:now+600000}; bucket.count++; limits.set(key,bucket);
        if (bucket.count > (request.method === 'POST' ? 12 : 60)) return json(429, {error:'Too many requests. Please try again later.'});
      }
        if (url.pathname === '/api/inquiries' && request.method === 'POST') {
          if (!inquiriesEnabled) return json(503, { error: 'Online delivery is not configured. Please use email.' });
          const data = await bodyJSON(request);
          const invalid = validateInquiry(data);
          if (invalid) return json(422, { error: invalid });
          const allowed = ['name', 'email', 'organisation', 'postcode', 'role', 'product', 'topic', 'message', 'source'];
          const text = allowed.filter(k => data[k]).map(k => `${k}: ${data[k]}`).join('\n\n');
          const response = await fetcher('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: env.INQUIRY_FROM, to: ['support@truselv.co.uk'], reply_to: data.email, subject: `TruSelv ${data.kind} enquiry`, text }), signal: AbortSignal.timeout(15000)
          });
          if (!response.ok) return json(502, { error: 'The enquiry could not be delivered. Please email TruSelv.' });
          const sent = await response.json();
          if (!sent.id) return json(502, { error: 'Delivery could not be confirmed.' });
          return json(200, { accepted: true });
        }
        if (url.pathname === '/api/resource-access' && request.method === 'GET') {
          return json(200, {allowed:await hasResourceAccess(request, env.RESOURCE_ACCESS_SECRET)});
        }
        if (url.pathname === '/api/resource-access' && request.method === 'POST') {
          if (!inquiriesEnabled || !env.RESOURCE_ACCESS_SECRET) return json(503, {error:'Resource downloads are temporarily unavailable. Please contact TruSelv.'});
          const data = await bodyJSON(request);
          const invalid = validateResourceLead(data);
          if (invalid) return json(422, {error:invalid});
          const lead = [
            `Resource: ${data.resource}`,
            `Name: ${data.firstName.trim()} ${data.lastName.trim()}`,
            `Work email: ${data.email.trim().toLowerCase()}`,
            `Organisation: ${data.organisation.trim()}`,
            `Organisation postcode: ${data.postcode?.trim() || 'Not provided'}`,
            `Marketing consent: ${['on', true].includes(data.marketing) ? 'Yes' : 'No'}`
          ].join('\n\n');
          const response = await fetcher('https://api.resend.com/emails', {
            method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`, 'Content-Type':'application/json'},
            body:JSON.stringify({from:env.INQUIRY_FROM, to:['support@truselv.co.uk'], reply_to:data.email.trim().toLowerCase(), subject:`TruSelv resource download: ${data.resource}`, text:lead}), signal:AbortSignal.timeout(15000)
          });
          if (!response.ok || !(await response.json()).id) return json(502, {error:'We could not prepare the download. Please try again or contact TruSelv.'});
          if (['on', true].includes(data.marketing)) {
            let segmentId=env.RESEND_MARKETING_SEGMENT_ID;
            if(!segmentId){const segmentsResponse=await fetcher('https://api.resend.com/segments?limit=100',{headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`},signal:AbortSignal.timeout(15000)}),segments=segmentsResponse.ok?await segmentsResponse.json():null;segmentId=segments?.data?.find(x=>x.name==='TruSelv Updates')?.id;if(!segmentId&&segmentsResponse.ok){const createdResponse=await fetcher('https://api.resend.com/segments',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({name:'TruSelv Updates'}),signal:AbortSignal.timeout(15000)});if(createdResponse.ok)segmentId=(await createdResponse.json()).id;}}
            const contact = {email:data.email.trim().toLowerCase(),first_name:data.firstName.trim(),last_name:data.lastName.trim(),unsubscribed:false};
            const contactResponse = segmentId&&await fetcher('https://api.resend.com/contacts', {
              method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`, 'Content-Type':'application/json'},
              body:JSON.stringify(contact), signal:AbortSignal.timeout(15000)
            });
            if (contactResponse&&(contactResponse.ok || contactResponse.status===409)) {
              if (contactResponse.status===409) await fetcher(`https://api.resend.com/contacts/${encodeURIComponent(contact.email)}`,{method:'PATCH',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({first_name:contact.first_name,last_name:contact.last_name,unsubscribed:false}),signal:AbortSignal.timeout(15000)});
              await fetcher(`https://api.resend.com/contacts/${encodeURIComponent(contact.email)}/segments/${encodeURIComponent(segmentId)}`,{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
            }
            // The support notification above remains the consent audit fallback if contact enrolment is unavailable.
          }
          const token = await createResourceAccessToken(env.RESOURCE_ACCESS_SECRET);
          return json(200, {accepted:true, downloadUrl:`/downloads/${data.resource}`}, {'Set-Cookie':`truselv_resource_access=${token}; Max-Age=86400; Path=/downloads/; Secure; HttpOnly; SameSite=Lax`});
        }
        if (url.pathname === '/api/checkout' && request.method === 'POST') {
          if (!paymentsEnabled) return json(503, { error: 'Checkout is not available yet. Please send an order enquiry.' });
          const data = await bodyJSON(request);
          if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 50 || !validEmail(data.email) || data.termsAccepted !== true) return json(422, { error: 'Review your quantity, email and terms.' });
          const address = data.shippingAddress;
          if (!address || !['line1', 'city', 'postal_code'].every(k => typeof address[k] === 'string' && address[k].trim().length > 0 && address[k].length <= 200) || !SHIPPING_COUNTRIES.includes(address.country)) return json(422, { error: 'Enter your full delivery address, town or city, postcode and country.' });
          const invitation = await validatePurchaseToken(env.PURCHASE_LINK_SECRET, data.purchaseToken);
          if (!invitation || data.email.trim().toLowerCase() !== invitation.email || data.quantity > invitation.maxQuantity) return json(403, { error: 'This private purchase link is invalid, expired or does not match the invited email address.' });
          // Never accept client-supplied amounts, Price IDs, shipping or redirect URLs.
          const price = await stripe(`prices/${encodeURIComponent(env.STRIPE_PRICE_ID)}`);
          if (!price.active || price.type !== 'one_time' || price.currency !== 'gbp' || price.unit_amount !== config.tessUnitPrice * 100) return json(503, { error: 'The product price needs review. Please contact TruSelv.' });
          const fields = new URLSearchParams({ mode: 'payment', ui_mode: 'form', 'line_items[0][price]': env.STRIPE_PRICE_ID, 'line_items[0][quantity]': String(data.quantity), billing_address_collection: 'auto', submit_type: 'auto', 'phone_number_collection[enabled]': 'false', 'automatic_tax[enabled]': 'false', integration_identifier: 'custom_embedded_web_0001' });
          // Shipping is charged once per order, with free standard delivery first.
          [{name:'Standard UK delivery (3-5 working days)',amount:0}, {name:'Next working day (order before 6pm UK time)',amount:499}].forEach((option,index) => {
            const prefix = `shipping_options[${index}][shipping_rate_data]`;
            fields.set(`${prefix}[type]`, 'fixed_amount');
            fields.set(`${prefix}[fixed_amount][amount]`, String(option.amount));
            fields.set(`${prefix}[fixed_amount][currency]`, 'gbp');
            fields.set(`${prefix}[display_name]`, option.name);
          });
          SHIPPING_COUNTRIES.forEach((country, index) => fields.set(`shipping_address_collection[allowed_countries][${index}]`, country));
          const session = await stripe('checkout/sessions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': randomUUID() }, body: fields.toString() });
          if (!session.client_secret || !session.id) return json(502, { error: 'The checkout could not be initialized.' });
          return json(200, { client_secret: session.client_secret, session_id: session.id });
        }
        if (url.pathname === '/api/order-status' && request.method === 'GET') {
          if (!paymentsEnabled) return json(503, { error: 'Payment verification unavailable.' });
          const id = url.searchParams.get('session_id');
          if (!/^cs_(test|live)_[A-Za-z0-9]{10,250}$/.test(id || '')) return json(400, { error: 'Invalid session.' });
          const session = await stripe(`checkout/sessions/${encodeURIComponent(id)}?expand[]=line_items`);
          // No name, email, address or financial details are exposed.
          const lines = session.line_items?.data;
          return json(200, { paid: session.mode === 'payment' && session.payment_status === 'paid' && session.status === 'complete' && lines?.length === 1 && lines[0].price?.id === env.STRIPE_PRICE_ID });
        }

      return json(404, {error:'Endpoint not found.'});
    } catch (error) { return json(error.status || 500, {error:error.status ? error.message : 'The service could not complete this request. Please contact TruSelv.'}); }
  };
}
