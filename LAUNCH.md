# TruSelv rebuild — handover and launch details

## Ready locally

The website has been rebuilt around Bedbord and TESS: 22 content pages, payment-status page, useful 404, legacy redirects and seven branded PDFs. All content pages have substantive copy, consistent navigation, responsive layouts and purposeful actions.

The supplied brand identity replaces the old design. New TESS tablet material replaces the outdated TV description. Unsupported NHS approval, compliance, clinical outcome, automatic integration, guaranteed sustainability and 24/7 support claims have been replaced with precise descriptions and assessment questions. Films and synthetic care imagery are identified as illustrative.

## Owner details still needed

These are factual gaps in supplied material:

1. **VAT status:** supplied company identity is now TRUSELV LTD, company 17224419, registered office 9 Moorland Road, Weston-super-Mare, United Kingdom, BS23 4HW. The owner states VAT is not currently being charged; the website and checkout reflect this.
2. **TESS offer:** whether £119 includes VAT; delivery fees, coverage and timing; tablet specification/accessories; stock; warranty; activation; shared-device licence rules; and ongoing support terms.
3. **Payment setup:** Stripe is confirmed; add account credentials and the real Price ID using STRIPE_INTEGRATION_TODO.md.
4. **App listings:** verified App Store / Google Play links and minimum supported versions. Current buttons route to an availability enquiry.
5. **Enquiry delivery:** verified sender credentials if direct delivery is preferred to email-app preparation. The optional server integration uses Resend.
6. **Product assurance:** release-specific safety, security, conformity, data-flow and accessibility evidence. The trust centre does not invent certificates or a safety case.

Update `site.config.json` and product/policy sources, then run `npm run build`. Never put keys in public configuration, JavaScript, HTML or Git.

## Forms

The static site prepares messages for the visitor’s email app. Visitors review and send themselves; copying is available. It never claims an email was sent or a meeting booked. No form data is stored in browser storage. Without JavaScript, forms are hidden and a direct email route is shown so details cannot accidentally be submitted in a GET URL.

For direct delivery, run the Node server with `RESEND_API_KEY`, verified `INQUIRY_FROM` (delivery is fixed to `support@truselv.co.uk`). Confirm processing terms, transfers and retention and update the privacy notice before activation. The server reports success only after provider acceptance; this is not a promise of final inbox placement. The owner has confirmed receipt of a Resend test enquiry.

## Payments and shipping address

Stripe is confirmed as the payment provider. See [STRIPE_INTEGRATION_TODO.md](STRIPE_INTEGRATION_TODO.md) for the single current setup checklist, exact Checkout Studio parameters, test flow and fulfilment requirements. The embedded form uses the supplied preview API. Resend and Stripe credentials are configured only on the server. Customers manually enter a mandatory shipping address.

## Hosting

The current deployment target is Cloudflare Workers with Static Assets. See [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md). The same API runs locally on Node and on the Worker. Public assets are packaged separately from credentials and source.

- **GitHub Pages:** publish the built files. Email preparation works; checkout stays disabled. HTML stubs preserve old `.html` paths. GitHub Pages ignores `_redirects`.
- **Node:** run `npm start` behind HTTPS with the correct `SITE_URL`. APIs are same-origin. The server supports video byte ranges, denies access to secrets/source and sets security headers. Use `TRUST_PROXY=true` only if the proxy strips and replaces the forwarding header.
- **Netlify-style static host:** `_redirects` covers old and extensionless paths. It does not deploy the Node APIs by itself.

Cloudflare nameservers have been configured by the owner. Website deployment still needs completion; nameserver migration alone does not deploy the Worker.

## Verification completed

- 24 published HTML pages (22 content pages plus status and 404): 1,231 local link/asset references checked, with no missing destinations or fragments.
- All 22 content pages checked in Chromium at 320, 390, 768 and 1440 px: no horizontal overflow and no JavaScript errors.
- Automated axe WCAG 2 A/AA, 2.1 AA and 2.2 AA checks: no detected violations on the tested pages.
- Shopping quantity, review and email fallback; required form validation; demo preselection; resource search/filtering; calculator positive, negative and invalid inputs; keyboard menu/dialog controls; reduced motion; and no-JavaScript fallback all passed.
- Nine Node integration tests passed with mocked providers, including server-controlled prices, checkout gating, origin checks, provider failure, payment verification, protected files, redirects, video range requests, Resend support routing and required shipping addresses.
- The additional integration browser test passed manual address entry, required address fields, Stripe Form SDK prefilling, confirmation-error handling and mobile layout using mocked providers. The owner has also confirmed successful Stripe sandbox payments and a sandbox receipt.
- Seven PDFs parse correctly with searchable text; the cancellation form and company overview fit on one page.

The detailed browser report and review screenshots are in `.preview/`. No live-money payment was exercised.

## Accessibility and legal scope

The implementation includes keyboard navigation, visible focus, labelled forms, semantic headings, reduced-motion handling, local fonts and responsive reflow. PDFs have real searchable text and embedded fonts.

Known limitations are disclosed on the accessibility page: films need verified captions/audio descriptions where applicable; PDFs need tagged-document review for formal PDF accessibility. Automated checks do not replace representative user testing or establish audited AA conformance.

Legal pages are substantive website/enquiry policy drafts based on implemented behaviour and UK guidance. Final seller details, processing practices and sales terms must match operations before launch and payment. Regulatory certification, a DPIA or a clinical safety case cannot be created as if it were verified evidence.

## Sources

- Existing website HTML, team biographies, contacts, both old PDFs, brand guidelines, messaging/imagery guides, TESS shopping copy and image manifest.
- [GOV.UK distance selling](https://www.gov.uk/online-and-distance-selling-for-businesses).
- [GOV.UK returns and refunds](https://www.gov.uk/accepting-returns-and-giving-refunds).
- [ICO privacy information requirements](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/).
- [NHS clinical safety service standard](https://service-manual.nhs.uk/standards-and-technology/service-standard-points/16-make-your-service-clinically-safe).
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- [Stripe Checkout API](https://docs.stripe.com/api/checkout/sessions/create) and [Resend email API](https://resend.com/docs/api-reference/emails/send-email).
