const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function unbase64url(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function key(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Purchase-link signing is not configured.');
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}

export async function createPurchaseToken(secret, {email, name = '', maxQuantity = 1, expiresAt}) {
  const payload = base64url(encoder.encode(JSON.stringify({
    v: 1,
    email: email.trim().toLowerCase(),
    name: name.trim().slice(0, 100),
    maxQuantity,
    exp: Math.floor(new Date(expiresAt).getTime() / 1000),
    nonce: crypto.randomUUID(),
  })));
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

export async function validatePurchaseToken(secret, token) {
  try {
    if (typeof token !== 'string' || token.length > 2048) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    const valid = await crypto.subtle.verify('HMAC', await key(secret), unbase64url(signature), encoder.encode(payload));
    if (!valid) return null;
    const value = JSON.parse(decoder.decode(unbase64url(payload)));
    if (value.v !== 1 || !/^\S+@\S+\.\S+$/.test(value.email) || !Number.isInteger(value.maxQuantity) || value.maxQuantity < 1 || value.maxQuantity > 50 || !Number.isInteger(value.exp) || value.exp <= Math.floor(Date.now() / 1000)) return null;
    return value;
  } catch {
    return null;
  }
}
