"""Local resource publishing journey. Requires portal :8791 and website :8792.

Use only local D1/R2, with editor@example.com seeded as a truselv_admin.
Start the portal with --var DEV_IDENTITY_EMAIL:editor@example.com.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.preview'
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8791/')
    page.locator('[data-view=resources]').click()
    page.locator('#new-resource').click()
    page.locator('[name=title]').fill('Browser test guide')
    page.locator('[name=summary]').fill('A practical guide for care teams.')
    page.locator('[name=body]').fill('First paragraph.\n\n<script>alert("safe text")</script>')
    page.locator('[name=file]').set_input_files({'name': 'test-guide.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.7\nlocal test'})
    page.locator('#preview-resource').click()
    assert page.locator('#resource-preview').is_visible()
    assert '<script>' in page.locator('#resource-preview-content').inner_text()
    page.keyboard.press('Escape')
    assert page.locator('#preview-resource').evaluate('(el) => document.activeElement === el')
    for width in [320, 390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), f'Overflow at {width}px'
    page.add_script_tag(path=str(ROOT / 'node_modules/axe-core/axe.min.js'))
    violations = page.evaluate("async () => (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v => ({id:v.id,targets:v.nodes.map(n=>n.target)}))")
    assert not violations, json.dumps(violations)
    page.screenshot(path=str(OUT / 'resources-editor-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(OUT / 'resources-editor-mobile.png'), full_page=True)
    page.get_by_role('button', name='Save draft', exact=True).click()
    page.get_by_text('Draft saved. The website has not changed.', exact=True).wait_for()
    public = context.new_page()
    public.goto('http://127.0.0.1:8792/resources')
    assert public.get_by_role('heading', name='Browser test guide', exact=True).count() == 0
    page.get_by_role('button', name='Edit Browser test guide', exact=True).last.click()
    page.get_by_role('button', name='Publish resource', exact=True).click()
    page.get_by_text('Resource published. It is now available on the website.', exact=True).wait_for()
    public.reload()
    public.get_by_role('heading', name='Browser test guide', exact=True).wait_for()
    link = public.get_by_role('link', name='Download test-guide.pdf').last
    response = context.request.get('http://127.0.0.1:8792' + link.get_attribute('href'))
    assert response.status == 200, response.text()
    assert response.body() == b'%PDF-1.7\nlocal test'
    public.locator('#resource-search').fill('Browser test guide')
    assert public.locator('#resource-count').inner_text() == '1 resource'
    public.get_by_text('Read article', exact=True).last.click()
    assert '<script>' in public.locator('.resource-card:not([hidden])').inner_text()
    public.set_viewport_size({'width': 320, 'height': 900})
    assert public.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.get_by_role('button', name='Edit Browser test guide', exact=True).last.click()
    page.locator('[name=title]').fill('Private edited title')
    page.get_by_role('button', name='Save draft', exact=True).click()
    page.get_by_text('Draft saved. The website has not changed.', exact=True).wait_for()
    public.reload()
    public.get_by_role('heading', name='Browser test guide', exact=True).wait_for()
    assert public.get_by_role('heading', name='Private edited title', exact=True).count() == 0
    page.get_by_role('button', name='Edit Private edited title', exact=True).last.click()
    page.once('dialog', lambda dialog: dialog.accept())
    page.get_by_role('button', name='Unpublish', exact=True).click()
    page.get_by_text('Resource unpublished. It is saved as a private draft.', exact=True).wait_for()
    assert context.request.get(response.url).status == 404
    assert not errors, errors
    browser.close()
print('PASS: local D1/R2 upload, draft, preview, publish, download, search, safe text, draft isolation, unpublish, 320–1440px layout, axe, Escape/focus restoration.')
