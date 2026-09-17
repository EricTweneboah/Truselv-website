import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
import {readFile,readdir} from 'node:fs/promises';

test('Worker serves runtime configuration without exposing secrets',async()=>{
  const env={RESEND_API_KEY:'private-resend',INQUIRY_FROM:'website@truselv.co.uk',STRIPE_SECRET_KEY:'sk_test_private',STRIPE_PUBLISHABLE_KEY:'pk_test_public',STRIPE_PRICE_ID:'price_test',CHECKOUT_ENABLED:'true'};
  const response=await worker.fetch(new Request('https://preview.workers.dev/js/site-config.js'),env);
  const body=await response.text();
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(body,/pk_test_public/);assert.match(body,/\/api\/inquiries/);
  assert.doesNotMatch(body,/private-resend|sk_test_private|price_test/);
});
test('Worker checks origin, validates shipping and uses Cloudflare rate limiter',async()=>{
  let count=0;
  const env={STRIPE_SECRET_KEY:'sk_test_private',STRIPE_PUBLISHABLE_KEY:'pk_test_public',STRIPE_PRICE_ID:'price_test',CHECKOUT_ENABLED:'true',API_RATE_LIMITER:{limit:async()=>({success:++count<3})}};
  const req=(origin)=>new Request('https://preview.workers.dev/api/checkout',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({quantity:1,email:'buyer@example.com',termsAccepted:true})});
  assert.equal((await worker.fetch(req('https://evil.example'),env)).status,403);
  assert.equal((await worker.fetch(req('https://preview.workers.dev'),env)).status,422);
  assert.equal((await worker.fetch(req('https://preview.workers.dev'),env)).status,422);
  assert.equal((await worker.fetch(req('https://preview.workers.dev'),env)).status,429);
});
test('public deployment folder excludes credentials and application source',async()=>{
  const files=await readdir(new URL('../.cloudflare-public/',import.meta.url),{recursive:true});
  for(const file of files) assert.doesNotMatch(file,/(^|[\\/])(?:\.env|\.dev.vars|node_modules|site.config.json|server.mjs|api.mjs|worker.mjs|LAUNCH.md|tests|scripts)([\\/]|$)/);
  assert.ok(files.includes('shop.html'));assert.ok(files.includes('assets\\welcome.mp4')||files.includes('assets/welcome.mp4'));
  const shop=await readFile(new URL('../.cloudflare-public/shop.html',import.meta.url),'utf8');
  assert.match(shop,/£119/);assert.doesNotMatch(shop,/£120|TESS Premium|months of Premium/);
});
