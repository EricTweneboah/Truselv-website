export const GATED_RESOURCES = new Set([
  'bedbord-product-brief.pdf',
  'tess-product-brief.pdf',
  'pilot-planning-guide.pdf',
  'procurement-checklist.pdf',
  'truselv-company-overview.pdf'
]);

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com', 'icloud.com', 'me.com',
  'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.co.uk',
  'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru'
]);

const encoder = new TextEncoder();

export function validWorkEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /[\r\n]/.test(value)) return false;
  return !PERSONAL_EMAIL_DOMAINS.has(value.trim().toLowerCase().split('@').pop());
}

export function validateResourceLead(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.website) return 'Invalid request.';
  if (!GATED_RESOURCES.has(data.resource)) return 'Choose a valid resource.';
  if (typeof data.firstName !== 'string' || data.firstName.trim().length < 2 || data.firstName.length > 80) return 'Enter your first name.';
  if (typeof data.lastName !== 'string' || data.lastName.trim().length < 2 || data.lastName.length > 80) return 'Enter your last name.';
  if (typeof data.organisation !== 'string' || data.organisation.trim().length < 2 || data.organisation.length > 200) return 'Enter your organisation.';
  if (data.postcode !== undefined && (typeof data.postcode !== 'string' || data.postcode.length > 20)) return 'Enter a valid organisation postcode.';
  if (!validWorkEmail(data.email)) return 'Enter your work email address. Personal email services such as Gmail, Outlook and Yahoo cannot be used.';
  if (data.marketing !== undefined && !['on', true, false].includes(data.marketing)) return 'Choose a valid communication preference.';
  if (!['on', true].includes(data.privacy)) return 'Acknowledge the privacy notice.';
  return null;
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function signature(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

export async function createResourceAccessToken(secret, now = Date.now()) {
  if (!secret) throw new Error('Resource access is not configured.');
  const payload = `v1.${Math.floor(now / 1000) + 86400}`;
  return `${payload}.${await signature(secret, payload)}`;
}

export async function hasResourceAccess(request, secret, now = Date.now()) {
  if (!secret) return false;
  const raw = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith('truselv_resource_access='))?.split('=').slice(1).join('=');
  const match = /^v1\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(raw || '');
  if (!match || Number(match[1]) < Math.floor(now / 1000)) return false;
  const payload = `v1.${match[1]}`;
  return (await signature(secret, payload)) === match[2];
}
