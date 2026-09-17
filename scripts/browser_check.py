"""Run real browser layout, accessibility and customer-journey checks.

Start a preview first. Usage: python scripts/browser_check.py http://localhost:4173
Requires development Python dependencies and npm install (axe-core).
"""
from pathlib import Path
import json
import sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4173'
OUT=ROOT/'.preview';OUT.mkdir(exist_ok=True)
manifest=json.loads((ROOT/'scripts/page-manifest.json').read_text())
failures=[];errors=[];a11y=[]

with sync_playwright() as p:
    browser=p.chromium.launch()
    context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    page=context.new_page()
    # Serve the test instrument through a mocked same-origin route so production CSP stays enabled.
    page.route('**/assets/test-axe.js',lambda route:route.fulfill(path=str(ROOT/'node_modules/axe-core/axe.min.js'),content_type='text/javascript'))
    page.on('pageerror',lambda error:errors.append(str(error)))
    for name in manifest:
        page.goto(URL+'/'+name,wait_until='load')
        page.evaluate('document.fonts.ready')
        for width in [320,390,768,1440]:
            page.set_viewport_size({'width':width,'height':1000})
            if page.evaluate('document.documentElement.scrollWidth > innerWidth + 1'): failures.append(f'{name}: overflow at {width}px')
        missing=page.locator('img').evaluate_all('(imgs)=>imgs.filter(i=>i.complete && !i.naturalWidth).map(i=>i.src)')
        if missing:failures.append(f'{name}: broken images {missing}')
        page.add_script_tag(url=URL+'/assets/test-axe.js')
        violations=page.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))}")
        if violations:a11y.append({'page':name,'violations':violations})
        print(f'Checked {name}',flush=True)
    # Keyboard navigation and reduced-motion playback.
    page.set_viewport_size({'width':390,'height':844})
    page.goto(URL+'/index.html')
    assert page.locator('#welcome-video').evaluate('(v)=>v.paused')
    page.locator('.menu-toggle').click(); assert page.locator('.navigation').is_visible()
    page.keyboard.press('Escape'); assert page.locator('.menu-toggle').get_attribute('aria-expanded')=='false'
    page.locator('[data-cookie-settings]').click();assert page.locator('#cookie-dialog').is_visible()
    page.keyboard.press('Escape');assert not page.locator('#cookie-dialog').is_visible()
    page.screenshot(path=str(OUT/'home-mobile.png'),full_page=True)
    page.set_viewport_size({'width':1440,'height':1000})
    page.screenshot(path=str(OUT/'home-desktop.png'),full_page=True)
    # Two-tablet selection, gallery, invalid values, review, email fallback.
    page.goto(URL+'/shop.html')
    page.locator('[data-gallery]').nth(1).click();assert 'angled_bundle' in page.locator('#gallery-image').get_attribute('src')
    page.locator('#quantity').fill('0');page.locator('#review-order').click();assert page.locator('#quantity-error').is_visible()
    page.locator('#quantity').fill('2');page.locator('#review-order').click();assert page.locator('#review-subtotal').inner_text()=='£240'
    page.locator('#order-name').fill('Test Person');page.locator('#order-email').fill('test@example.com');page.locator('#order-postcode').fill('BS23 1HL');page.locator('#order-line1').fill('1 Test Street');page.locator('#order-city').fill('Weston-super-Mare');page.locator('input[name=terms]').check()
    page.locator('#checkout-button').click()
    assert 'Nothing has been sent yet' in page.locator('#order-result').inner_text()
    assert 'Quantity: 2' in page.locator('#order-result textarea').input_value()
    assert page.locator('#order-result a').get_attribute('href').startswith('mailto:')
    # Form validation and query-string preselection; no actual email is sent.
    page.goto(URL+'/book-demo.html?product=TESS')
    assert page.locator('#product').input_value()=='TESS'
    page.locator('[data-form-submit]').click();assert not page.locator('.form-result').is_visible()
    page.locator('#name').fill('Test Person');page.locator('#email').fill('test@example.com');page.locator('#organisation').fill('Test care setting');page.locator('#role').select_option('Care home manager');page.locator('#message').fill('Please show us the available tablet activities.');page.locator('input[name=privacy]').check();page.locator('[data-form-submit]').click()
    assert 'Ready to send' in page.locator('.form-result').inner_text()
    # Resource filtering, no-results state and reset.
    page.goto(URL+'/resources.html');page.locator('[data-filter=Legal]').click();assert page.locator('.resource-card:visible').count()==2
    page.locator('#resource-search').fill('nonexistent-resource');assert page.locator('#no-resources').is_visible()
    page.locator('#resource-search').fill('');page.locator('[data-filter=All]').click();assert page.locator('.resource-card:visible').count()==7
    # Independently computed calculator outcomes, including negative benefit.
    page.goto(URL+'/roi-calculator.html');assert page.locator('#roi-hours').inner_text()=='730 hours';assert page.locator('#roi-value').inner_text()=='£18,250'
    page.locator('#upfront').fill('10000');page.locator('#annual').fill('2000');assert page.locator('#roi-net').inner_text()=='£6,250';assert '52.1%' in page.locator('#roi-return').inner_text()
    page.locator('#digital').fill('12');assert page.locator('#roi-hours').inner_text()=='-584 hours';assert 'No payback' in page.locator('#roi-payback').inner_text()
    page.locator('#occupancy').fill('101');assert page.locator('#roi-error').is_visible()
    page.locator('button[type=reset]').click();page.wait_for_timeout(50);assert page.locator('#roi-hours').inner_text()=='730 hours'
    # Images, video controls and screenshots for visual review.
    for name in ['bedbord','tess','book-demo','shop','trust']:
        page.goto(URL+'/'+name+'.html');page.screenshot(path=str(OUT/(name+'-desktop.png')),full_page=True)
    for name in ['welcome','bedbord','tess']:
        response=context.request.get(URL+'/assets/'+name+'.mp4');assert response.ok and len(response.body())>1000
    for path in (ROOT/'downloads').glob('*.pdf'):
        response=context.request.get(URL+'/downloads/'+path.name);assert response.ok and response.body().startswith(b'%PDF-')
    # Static hosting remains usable without JavaScript; forms cannot leak by GET.
    nojs=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
    nojs_page=nojs.new_page();nojs_page.goto(URL+'/book-demo.html');assert nojs_page.locator('nav.navigation').is_visible();assert not nojs_page.locator('form[data-inquiry]').is_visible();assert nojs_page.locator('noscript .no-js').is_visible()
    nojs.close();browser.close()

result={'pages':len(manifest),'widths':[320,390,768,1440],'layout_failures':failures,'javascript_errors':errors,'automated_accessibility_violations':a11y,'customer_journeys':'passed'}
(OUT/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
sys.exit(1 if failures or errors or a11y else 0)
