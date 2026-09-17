"""Mock external providers, exercise real browser integration and address prefill."""
import json, sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:4180'
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def config(route):
        response=route.fetch()
        route.fulfill(response=response,body=response.text()+'''\nObject.assign(window.TRUSELV_CONFIG,{checkoutEndpoint:'/api/checkout',stripePublishableKey:'pk_test_mock',checkoutTestMode:true,addressEndpoint:'/api/addresses'});''')
    page.route('**/js/site-config.js',config)
    page.route('**/api/addresses',lambda route:route.fulfill(json={'addresses':[{'line1':'9 Moorland Road','line2':'','city':'Weston-super-Mare','state':'North Somerset','postal_code':'BS23 4HW','country':'GB'}]}))
    page.route('**/api/checkout',lambda route:route.fulfill(json={'client_secret':'test-secret','session_id':'cs_test_12345678901'}))
    page.route('https://js.stripe.com/dahlia/stripe.js',lambda route:route.fulfill(content_type='text/javascript',body='''window.Stripe=(key,options)=>({initCheckoutFormSdk:settings=>{window.testSettings=settings;return {loadActions:async()=>({type:'success',actions:{confirm:async opts=>{window.testConfirm=opts;return {type:'error',error:{message:'Test decline: choose another payment method.'}}}}}),createForm:()=>({mount:selector=>{document.querySelector(selector).textContent='Mock secure payment form';},on:(name,handler)=>{window.testPayment=handler;},destroy:()=>{}})}}});'''))
    page.goto(URL+'/shop.html');page.locator('#review-order').click()
    page.locator('#order-name').fill('Test Visitor');page.locator('#order-email').fill('test@example.com')
    page.locator('#order-postcode').fill('BS23 4HW');page.locator('#find-address').click()
    page.locator('#address-results').select_option('0')
    assert page.locator('#order-line1').input_value()=='9 Moorland Road'
    page.locator('#order-line2').fill('Reception')
    page.locator('input[name=terms]').check();page.locator('#checkout-button').click()
    page.locator('#checkout-form').get_by_text('Mock secure payment form').wait_for()
    settings=page.evaluate('window.testSettings')
    assert settings['defaultValues']['shippingAddress']['address']['line2']=='Reception'
    assert settings['defaultValues']['email']=='test@example.com'
    page.evaluate('window.testPayment({testEvent:true})')
    assert 'Test decline' in page.locator('#payment-error').inner_text()
    assert page.evaluate('window.testConfirm.redirect')=='if_required'
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors,errors
    page.screenshot(path='.preview/checkout-integration-mobile.png',full_page=True)
    browser.close()
print('PASS: postcode selection, editable address, Stripe prefill, confirmation error, mobile layout; providers mocked.')
