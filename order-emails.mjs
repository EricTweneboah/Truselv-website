import {validEmail} from './api.mjs';
const failure = (message,status=503) => Object.assign(new Error(message),{status});
export async function verifyStripeEvent(request, secret, now=Date.now()) {
  const header=request.headers.get('stripe-signature') || '';
  const parts=header.split(',').map(p=>p.trim().split('='));
  const timestamp=parts.find(p=>p[0]==='t')?.[1];
  if (!/^\d+$/.test(timestamp || '') || Math.abs(now/1000-Number(timestamp))>300) throw failure('Invalid webhook signature.',400);
  const reader=request.body?.getReader(); let raw='',size=0;
  const decoder=new TextDecoder();
  if(reader) while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();throw failure('Webhook too large.',413);}raw+=decoder.decode(value,{stream:true});}
  raw+=decoder.decode();
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  let verified=false;
  for(const [type,hex] of parts){if(type==='v1' && /^[a-f0-9]{64}$/.test(hex || '')){
    const bytes=Uint8Array.from(hex.match(/../g),h=>parseInt(h,16));
    if(await crypto.subtle.verify('HMAC',key,bytes,encoder.encode(timestamp+'.'+raw)))verified=true;
  }}
  if(!verified)throw failure('Invalid webhook signature.',400);
  try{return JSON.parse(raw);}catch{throw failure('Invalid webhook payload.',400);}
}
export async function orderWebhook(request,{env,stripe,fetcher}) {
  if(!env.STRIPE_WEBHOOK_SECRET)throw failure('Order email webhook is not configured.');
  const event=await verifyStripeEvent(request,env.STRIPE_WEBHOOK_SECRET);
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return;
  const live=env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
  if(event.livemode!==live)throw failure('Webhook mode mismatch.',400);
  const id=event.data?.object?.id;
  if(!/^cs_(test|live)_[A-Za-z0-9]{10,250}$/.test(id || ''))throw failure('Invalid Checkout Session.',400);
  const session=await stripe(`checkout/sessions/${encodeURIComponent(id)}?expand[]=line_items&expand[]=shipping_cost.shipping_rate`);
  if(session.mode!=='payment' || session.status!=='complete' || session.payment_status!=='paid')return;
  const lines=session.line_items?.data;
  if(session.livemode!==live || lines?.length!==1 || session.line_items.has_more || lines[0].price?.id!==env.STRIPE_PRICE_ID)return;
  if(!env.RESEND_API_KEY || !env.INQUIRY_FROM)throw failure('Order email sender is not configured.');
  const email=session.customer_details?.email || session.customer_email;
  const shipping=session.collected_information?.shipping_details || session.shipping_details;
  if(!validEmail(email) || !shipping?.address?.line1 || !Number.isInteger(session.amount_total) || session.currency!=='gbp')throw failure('Order details need review.');
  const address=[shipping.name,...['line1','line2','city','state','postal_code','country'].map(k=>shipping.address[k])].filter(Boolean).join('\n');
  const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n/100);
  const reference=id;
  const summary=`Order reference: ${reference}\nTESS tablet quantity: ${lines[0].quantity}\nTotal paid: ${money(session.amount_total)}\nDelivery: ${session.shipping_cost?.shipping_rate?.display_name || 'UK delivery'}\nDelivery charge: ${money(session.total_details?.amount_shipping || 0)}\n\nDelivery address:\n${address}`;
  const prefix=live?'':'[TEST] ';
  const messages=[
    {role:'buyer',to:email,subject:prefix+'Your TruSelv TESS order confirmation',text:`Thank you for your order. Your payment has been confirmed.\n\n${summary}\n\nWe will follow up with your dispatch details. For help, reply to this email or contact support@truselv.co.uk.\n\nDelivery and returns: https://truselv.co.uk/returns.html\nTRUSELV LTD | Company 17224419`,reply_to:'support@truselv.co.uk'},
    {role:'support',to:'support@truselv.co.uk',subject:prefix+'New paid TESS order',text:`A TESS order has been paid.\n\n${summary}\n\nBuyer email: ${email}\n\nCheck the order in Stripe and arrange fulfilment.`,reply_to:email}
  ];
  const metadata=session.metadata || {};
  async function mark(key,value){await stripe(`checkout/sessions/${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({[`metadata[${key}]`]:value}).toString()});metadata[key]=value;}
  for(const message of messages){
    const key='order_email_'+message.role;
    if(metadata[key])continue;
    const started=key+'_started';
    // An unresolved send older than Resend's deduplication window needs manual
    // reconciliation rather than risking another customer email.
    if(metadata[started] && Date.now()-Number(metadata[started])>23*60*60*1000)throw failure('Order email requires reconciliation.');
    if(!metadata[started])await mark(started,String(Date.now()));
    const {role,...body}=message;
    const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`tess-order-v1/${id}/${role}`},body:JSON.stringify({from:env.INQUIRY_FROM,...body}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw failure('Order email could not be accepted.');
    const sent=await response.json();if(!sent.id)throw failure('Order email acceptance was not confirmed.');
    await mark(key,sent.id);
  }
}
