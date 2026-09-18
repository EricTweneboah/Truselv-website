# Cloudflare Free deployment

The website uses Workers Static Assets for HTML, videos, fonts and PDFs. Only `/api/*` and `/js/site-config.js` invoke the Worker. The Node preview and Worker share `api.mjs`, including price/address validation and email delivery. No paid database, storage bucket or other paid binding is required. Stay on Workers Free; its request/CPU quotas still apply.

## Connect GitHub

In Cloudflare, open Workers & Pages (under Compute), create an application and connect `EricTweneboah/Truselv-website` from GitHub as a **Worker**, not a static-only upload.

- Branch: `main`
- Name: `truselv-website`
- Build command: `npm run build:cloudflare`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

Cloudflare installs npm dependencies. The HTML and PDFs are already built and committed; the deployment command packages only allowlisted public files. Do not set the repository root as a public asset directory. Do not upload `.env`.

Start on the generated `workers.dev` address. Keep the current root and www website DNS records until the preview works. Nameserver migration alone does not move the website to this Worker.

## Runtime secrets and settings

After initial deployment, open the Worker's Settings → Variables and Secrets. Copy values directly from the local `.env`; never paste credentials into Git or chat.

| Name | Type | Value |
| --- | --- | --- |
| RESEND_API_KEY | Secret | Existing verified Resend key |
| STRIPE_SECRET_KEY | Secret | Existing `sk_test_…` key first |
| STRIPE_PUBLISHABLE_KEY | Secret or variable | Matching `pk_test_…` key; intentionally sent to Stripe.js |
| STRIPE_PRICE_ID | Secret or variable | Existing £119 one-time test price |
| CHECKOUT_ENABLED | Variable | `true` for sandbox testing |
| INQUIRY_FROM | Variable | `TruSelv website <website@truselv.co.uk>` |

The checked-in Wrangler configuration initially keeps checkout disabled. Before enabling sandbox checkout, change `vars.CHECKOUT_ENABLED` to `true` there too so subsequent Git deployments retain the setting. Set credentials as secrets so deployment cannot expose them in source. Leave `SITE_URL` unset during the workers.dev preview: the API checks POST Origin against the actual request origin. Optionally set it to the final canonical origin once the domain is attached.

Cloudflare does not receive the local `.env` automatically. With no secrets configured the website remains usable and enquiries use the email-app fallback. Live checkout still requires matching live keys plus `salesReady=true` after final offer/delivery details are settled. No live activation has been performed.

## Preview checks and domain switch

Check £119 pricing, no Premium offer, required manual shipping fields, all three videos and PDF downloads. Test enquiry delivery and Stripe sandbox checkout on the workers.dev URL, including the payment return/status page. Confirm shipping details in Stripe. Test receipt email restrictions still apply.

Then add `truselv.co.uk` and `www.truselv.co.uk` using the Worker's Domains & Routes → Custom domain workflow. Existing conflicting website records may need replacing at that point; preserve all mail, Resend, verification and service records. Keep a copy of the old website DNS targets for rollback. Check HTTPS, root/www, enquiries and checkout after the switch. Domain registration remains with GoDaddy; Cloudflare provides DNS and hosting.

## Local maintenance

`npm run build` regenerates HTML/PDFs after editing their sources. `npm run build:cloudflare` packages them. `npm test` checks Node and Worker behavior after packaging. `npm run dev:cloudflare` runs the actual local Workers runtime. `.dev.vars` is ignored and deliberately empty by default, so local Workers tests do not accidentally use the real `.env` credentials. The Node preview still uses `.env` via `npm start`.

Use `npx wrangler deploy --dry-run` to validate without publishing. Do not change Cloudflare plans or add paid services for this setup. API rate limiting is applied per IP/method using Cloudflare's rate limiter; it is approximate and local to Cloudflare locations, not a global abuse guarantee.

References: [Static assets](https://developers.cloudflare.com/workers/static-assets/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## Activate order emails

The deployed endpoint is `https://truselv.co.uk/api/stripe-webhook`.
In Stripe live mode, create a webhook event destination for your own account with:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Copy its signing secret into Cloudflare runtime secrets as `STRIPE_WEBHOOK_SECRET` and deploy the secret update. Never commit or share the value. Sandbox endpoints have separate signing secrets and must use matching sandbox API credentials.

Both emails are sent through the existing Resend sender after signature and paid-order verification. This works even if the buyer closes the checkout page. The buyer gets the quantity, total, delivery service and address; support receives the same details plus buyer email. These are order emails, separate from Stripe payment receipts. Provider acceptance is not proof of inbox delivery: check Resend delivery events and spam folders.

Delivery acceptance IDs are stored in Checkout Session metadata (`order_email_buyer` and `order_email_support`). Each recipient also has a stable Resend idempotency key. Partial failures return a non-2xx response so Stripe can retry. An uncertain send older than 23 hours returns an error for manual reconciliation, because Resend only retains idempotency keys for 24 hours. Check the Resend log before clearing a `_started` marker; if already sent, record its email ID in the corresponding metadata field instead. Never clear a sent marker just to retry another recipient.

Fulfilment remains manual. No old purchases are automatically emailed; an event resend can process an eligible past paid Session. Verify both recipients with an intended order or a separate sandbox setup. Automated tests mock providers and do not send real mail or charge a card.

References: https://docs.stripe.com/webhooks/signature and https://resend.com/changelog/idempotency-keys
