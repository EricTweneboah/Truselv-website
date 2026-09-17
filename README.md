# TruSelv website

A complete static rebuild focused on **Bedbord** and **TESS**, using the supplied brand identity, locally served fonts, three product films and the new TESS tablet imagery.

## Preview

Requires Node 22 or later. No production npm dependencies are needed.

```powershell
npm start
```

Open `http://localhost:4173`. Built HTML also runs directly on GitHub Pages or another static host. No bundler, external fonts, analytics or cookies are required.

## Included

- Home, Bedbord, TESS, tablet shop and order review.
- Demo and contact forms with honest email preparation on static hosting.
- Optional server-delivered enquiries and Stripe Checkout with verified payment status.
- Bedbord time and ROI calculator with editable assumptions and print/save-to-PDF.
- Purpose, team, partnerships, searchable resources, FAQs and support.
- Trust, safety, accessibility, privacy, cookies, acceptable use, website/sales terms, returns and company information.
- Seven branded PDFs, sitemap, metadata, useful 404 and legacy redirects.

## Editing

Generated HTML is included for direct static publishing. Edit the maintained source and rebuild so changes are not overwritten:

| File | Purpose |
| --- | --- |
| `scripts/build_site.py` | Layout, product pages, forms, shop, calculator, resources and redirects |
| `scripts/site_policies.py` | Trust and legal content |
| `scripts/build_pdfs.py` | PDFs; privacy PDF follows the generated notice |
| `css/site.css` | Responsive brand and print styles |
| `js/site.js` | Browser interactions |
| `site.config.json` | Public company/offer details, app links and integration settings |
| `server.mjs` | Optional server and API endpoints |

```powershell
python -m pip install -r requirements-dev.txt
npm install
npm run build
```

Only when original assets change:

```powershell
python scripts/prepare_assets.py
```

Web derivatives go to `assets/`; originals remain intact. The three web videos total roughly 5.6 MB, compared with roughly 26 MB of source footage.

## Forms and payments

By default, the site prepares an email for the visitor to review and send. It never claims an enquiry has been sent or a demo booked. No payment or subscription is created by an enquiry.

To enable direct delivery, copy `.env.example` to `.env`, configure a verified Resend sender/key and restart the Node server. It exposes same-origin endpoints only when configured. Keys stay server-side.

Stripe embedded Checkout is implemented using the supplied Form SDK preview. Test mode needs server credentials; live sales also require complete offer details. See [STRIPE_INTEGRATION_TODO.md](STRIPE_INTEGRATION_TODO.md). GitHub Pages cannot run a Node API. See [LAUNCH.md](LAUNCH.md) for activation steps, manual fulfilment and remaining factual confirmations.

## Checks

```powershell
npm run check
npm test
python -m playwright install chromium
python scripts/browser_check.py http://localhost:4173
```

Checks cover local links/assets/fragments, PDF validity, server validation, payment verification, all content pages at 320/390/768/1440 px, automated WCAG checks, navigation, forms, shopping, resource filters, calculator edge cases and no-JavaScript use. Provider tests are mocked: no real email or charge is made.

Screenshots and reports are in ignored `.preview/`. Automated accessibility checks do not establish audited conformance; known limitations and launch details are documented in [LAUNCH.md](LAUNCH.md).
