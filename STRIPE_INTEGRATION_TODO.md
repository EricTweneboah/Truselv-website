# Stripe, Resend and delivery-address setup

This is the current integration checklist. Code is implemented locally; no credentials, real Price ID or production deployment were supplied. No live payment or email has been exercised.

## Configure the server

1. Copy `.env.example` to `.env` (ignored by Git), or configure equivalent secrets on a Node 22+ host. Set `SITE_URL` to the exact browser origin. GitHub Pages alone cannot run these APIs.
2. Resend: verify `truselv.co.uk` and its sending DNS in Resend. Set `RESEND_API_KEY` and a verified `INQUIRY_FROM` (example: `TruSelv website <website@truselv.co.uk>`). Every demo/contact/order enquiry goes to **support@truselv.co.uk**; Reply-To is the validated visitor email. Confirm that mailbox receives mail. Provider acceptance is not guaranteed inbox delivery.
3. Delivery addresses are entered manually. Address line 1, town/city, postcode and country are mandatory; line 2 and region are optional. No address-provider account or key is needed.
4. Stripe: use matching sandbox/test `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`, plus the real `STRIPE_PRICE_ID` from that same account. The publishable key is intentionally delivered to Stripe.js; the secret remains server-only. Use a one-time GBP £119 price without adding VAT. No secret or Price ID placeholders are embedded in source.
5. Set `CHECKOUT_ENABLED=true`. Test keys work while `salesReady=false`; live keys also require `salesReady=true` in `site.config.json`. Restart the server after environment changes. Run `npm run build` after content/configuration changes, then `npm start`.

## Configured Checkout Session parameters

The existing REST call remains in `api.mjs`; no Stripe SDK installation is required. Its API header follows the newer version in the user's direct snippet: `2026-08-26.dahlia; custom_checkout_payment_form_preview=v1` (the duplicate attachments specified March). Confirm that the account supports this preview/version in a sandbox.

| Parameter | Implemented value |
| --- | --- |
| mode | payment (preserved) |
| ui_mode | form |
| line_items | Server-configured real Price ID and validated quantity 1–50 (preserved) |
| billing_address_collection | auto |
| phone_number_collection.enabled | false |
| automatic_tax.enabled | false |
| submit_type | auto |
| shipping_address_collection.allowed_countries | UK only (GB), stored as SHIPPING_COUNTRIES in api.mjs |
| integration_identifier | custom_embedded_web_0001 |

`payment_method_collection` is omitted because this is payment mode. Old redirect URLs, metadata, card-only restriction and other unconfigured Session parameters were removed. Customer email and selected address are provided through the SDK's `defaultValues`. The existing Price amount/currency/type validation remains server-side. The endpoint returns `client_secret` plus `session_id`; it never redirects to `session.url`.

Stripe.js loads only when opening checkout, from `https://js.stripe.com/dahlia/stripe.js`, with `custom_checkout_payment_form_1`. The supplied appearance settings and expanded layout are preserved. Confirmation passes the form event, a same-site return URL and `redirect: if_required`. Status is checked against Stripe and the configured product Price ID, without exposing customer information. This is a one-time payment, not a recurring subscription.

## Before accepting live payments

- VAT is currently not charged, as instructed by the owner. Confirm stock, hardware/accessories, delivery coverage/cost/timing, warranty, setup and support terms. Update public offer and policies to match. Company identity is now TRUSELV LTD, 17224419, 9 Moorland Road, Weston-super-Mare, United Kingdom, BS23 4HW, as supplied.
- The supplied Checkout Studio configuration has **no shipping charge** and **automatic tax disabled**. Do not enable live sales unless the £119 price and delivery policy intentionally account for this. The supplied broad country allowlist does not itself establish an operational international delivery service.
- Complete Stripe business verification, payment-method settings, support information, receipt settings and legal URLs. Enable the Form SDK preview if required by Stripe. Configure HTTPS hosting and provider processing arrangements.
- Set matching live keys/Price ID only after sandbox checks, then enable `salesReady`. Keep credentials out of logs, public files and Git.

## Test the flow

1. Submit a demo with valid details; verify Resend acceptance and actual support inbox receipt/Reply-To. Try missing fields and provider failure. No success should appear on failure.
2. Enter a delivery address manually. Verify empty required fields prevent checkout and the entered address appears in Stripe.
3. Choose one and multiple tablets. Verify GBP £119 per tablet and final total. Try test card `4242 4242 4242 4242`, any future expiry and any three-digit CVC. For authentication use `4000 0025 0000 3155`; for decline use `4000 0000 0000 9995`. Use test mode only.
4. Exercise authentication/redirect returns, declines, network interruption, quantity changes, back navigation and mobile/keyboard use. Verify successful payments in Stripe, and that the status page cannot claim payment from a URL alone.

## Fulfilment

Manual fulfilment remains required: check successful paid Sessions in the Stripe Dashboard, accept orders, arrange delivery and provide the agreed TESS setup support. Do not fulfil based on a browser success message. No inventory or entitlement API was supplied. Automated fulfilment requires a durable order store and signature-verified, idempotent webhooks for completed and asynchronous payment success/failure events; it is not implemented or claimed here.

## References

- [Stripe key safety](https://docs.stripe.com/keys-best-practices)
- [Checkout Session creation](https://docs.stripe.com/api/checkout/sessions/create)
- [Official Form SDK types, including defaultValues](https://github.com/stripe/stripe-js/blob/master/types/stripe-js/checkout.d.ts)
- [Stripe test cards](https://docs.stripe.com/testing)
- [Stripe fulfilment](https://docs.stripe.com/checkout/fulfillment)
- [Resend email API](https://resend.com/docs/api-reference/emails/send-email)
- Shipping addresses are entered manually and required.

## Cloudflare deployment

Use [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) for hosting and runtime secrets. Local `.env` is not uploaded. Sandbox checkout and receipt delivery have been confirmed by the owner; production deployment and live-mode activation remain separate steps.
