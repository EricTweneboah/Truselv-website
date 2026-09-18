import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createApi} from '../api.mjs';
const env={STRIPE_WEBHOOK_SECRET:'whsec_fake',STRIPE_SECRET_KEY:'sk_test_fake',STRIPE_PRICE_ID:'price_test',RESEND_API_KEY:'fake',INQUIRY_FROM:'website@truselv.co.uk'};
const id='cs_test_12345678901';
function request(type='checkout.session.completed',time=Math.floor(Date.now()/1000),secret=env.STRIPE_WEBHOOK_SECRET){const body=JSON.stringify({id:'evt_test',livemode:false,type,data:{object:{id}}});const sig=createHmac('sha256',secret).update(time+'.'+body).digest('hex');return new Request('https://truselv.co.uk/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':`t=${time},v1=${sig}`},body});}
function fixture(){
 const session={id,livemode:false,mode:'payment',status:'complete',payment_status:'paid',currency:'gbp',amount_total:12399,metadata:{},line_items:{data:[{quantity:1,price:{id:'price_test'}}]},customer_details:{email:'buyer@example.com'},collected_information:{shipping_details:{name:'Test Buyer',address:{line1:'1 Test Street',city:'London',postal_code:'SW1A 1AA',country:'GB'}}},total_details:{amount_shipping:499},shipping_cost:{shipping_rate:{display_name:'Next working day (order before 6pm UK time)'}}};
 const sent=[];const accepted=new Map();let failSupport=false;let failMark=false;let calls=0;
 const fetcher=async(url,options={})=>{
  calls++;
  if(url.startsWith('https://api.stripe.com/')){
   if(options.method==='POST') {for(const [k,v] of new URLSearchParams(options.body)){const field=k.slice(9,-1);if(failMark && field==='order_email_buyer')return new Response('{}',{status:500});session.metadata[field]=v;} }
   return Response.json(structuredClone(session));
  }
  assert.equal(url,'https://api.resend.com/emails');
  const body=JSON.parse(options.body);if(failSupport && body.to==='support@truselv.co.uk')return new Response('{}',{status:503});
  const key=options.headers['Idempotency-Key'];if(!accepted.has(key)){accepted.set(key,{id:'email_'+accepted.size});sent.push(body);}return Response.json(accepted.get(key));
 };
 const api=createApi({config:{siteUrl:'https://truselv.co.uk'},env,fetcher,rateLimit:async()=>false});
 return {api,session,sent,setFailSupport:v=>failSupport=v,setFailMark:v=>failMark=v,get calls(){return calls;}};
}
test('webhook rejects forged and expired signatures before provider calls',async()=>{const f=fixture();assert.equal((await f.api(request(undefined,Math.floor(Date.now()/1000),'wrong'))).status,400);assert.equal((await f.api(request(undefined,Math.floor(Date.now()/1000)-600))).status,400);assert.equal(f.calls,0);});
test('verified paid order emails buyer and fixed support recipient once across event types',async()=>{const f=fixture();assert.equal((await f.api(request())).status,200);assert.equal(f.sent.length,2);assert.equal(f.sent[0].to,'buyer@example.com');assert.equal(f.sent[1].to,'support@truselv.co.uk');assert.match(f.sent[0].text,/123\.99/);assert.match(f.sent[1].text,/1 Test Street/);assert.match(f.sent[0].subject,/TEST/);assert.equal((await f.api(request('checkout.session.async_payment_succeeded'))).status,200);assert.equal(f.sent.length,2);});
test('no email for unpaid, unrelated price or wrong-mode order',async()=>{for(const change of [s=>s.payment_status='unpaid',s=>s.line_items.data[0].price.id='price_other',s=>s.livemode=true]){const f=fixture();change(f.session);assert.equal((await f.api(request())).status,200);assert.equal(f.sent.length,0);}});
test('partial failure retries only unsent recipient',async()=>{const f=fixture();f.setFailSupport(true);assert.equal((await f.api(request())).status,503);assert.equal(f.sent.length,1);f.setFailSupport(false);assert.equal((await f.api(request())).status,200);assert.equal(f.sent.length,2);});
test('metadata failure retries safely with same provider key; stale uncertainty blocks resending',async()=>{const f=fixture();f.setFailMark(true);assert.equal((await f.api(request())).status,502);assert.equal(f.sent.length,1);f.setFailMark(false);assert.equal((await f.api(request())).status,200);assert.equal(f.sent.length,2);const g=fixture();g.session.metadata.order_email_buyer_started=String(Date.now()-24*60*60*1000);assert.equal((await g.api(request())).status,503);assert.equal(g.sent.length,0);});
