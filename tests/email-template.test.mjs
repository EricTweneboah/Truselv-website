import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderEmailHtml} from '../email-template.mjs';
test('order email safely escapes customer fields and separates buyer and support content',()=>{
 const data={reference:'cs_live_example',quantity:2,total:'£242.99',delivery:'Next working day',deliveryCharge:'£4.99',address:'<script>alert(1)</script>\n1 Road & Lane',email:'buyer@example.com',test:false};
 const buyer=orderEmailHtml({...data,role:'buyer'});
 assert.doesNotMatch(buyer,/<script>|Open Stripe|TEST ORDER/);
 assert.match(buyer,/&lt;script&gt;/);assert.match(buyer,/1 Road &amp; Lane/);assert.match(buyer,/£242.99/);assert.match(buyer,/https:\/\/truselv.co.uk\/assets\/apple-touch-icon.png/);
 const support=orderEmailHtml({...data,role:'support',test:true});assert.match(support,/Open Stripe/);assert.match(support,/buyer@example.com/);assert.match(support,/TEST ORDER/);
});
