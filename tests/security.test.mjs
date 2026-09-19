import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../api.mjs';
import config from '../site.config.json' with {type:'json'};

// Malicious inputs must be rejected before a payment or email provider is called.
function fixture() {
  let calls=0;
  const env={SITE_URL:'https://truselv.example',CHECKOUT_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_fake',STRIPE_PUBLISHABLE_KEY:'pk_test_fake',STRIPE_PRICE_ID:'price_fake',RESEND_API_KEY:'fake',INQUIRY_FROM:'website@example.com'};
  const api=createApi({config,env,fetcher:()=>{calls++;throw new Error('Unexpected provider call');}});
  const request=(body,contentType='application/json',origin=env.SITE_URL)=>new Request(env.SITE_URL+'/api/checkout',{method:'POST',headers:{Origin:origin,'Content-Type':contentType},body});
  return {api,request,calls:()=>calls};
}
test('malformed, oversized and wrong-content-type bodies cannot reach providers',async()=>{
  const f=fixture();
  for(const body of ['{','null','[]','"string"']) assert.equal((await f.api(f.request(body))).status,400);
  assert.equal((await f.api(f.request('{}','text/plain'))).status,415);
  assert.equal((await f.api(f.request(JSON.stringify({padding:'x'.repeat(17000)})))).status,413);
  assert.equal(f.calls(),0);
});
test('missing or hostile origin is rejected and local rate limit bounds repeated attempts',async()=>{
  const f=fixture();
  for(const origin of ['', 'null','https://attacker.invalid']) assert.equal((await f.api(f.request('{}','application/json',origin))).status,403);
  for(let i=0;i<12;i++) assert.equal((await f.api(f.request('{}'))).status,422);
  assert.equal((await f.api(f.request('{}'))).status,429);
  assert.equal(f.calls(),0);
});
