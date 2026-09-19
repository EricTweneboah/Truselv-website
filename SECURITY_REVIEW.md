# Website sanity and security review — 19 September 2026

## Outcome and scope

No exploitable critical or high-severity issue was identified in this bounded review. This is an application review with targeted, non-destructive penetration checks, not an independent penetration-test certification or a guarantee of security.

Reviewed the current Cloudflare Worker/static-asset architecture, shared API, Node preview server, checkout browser code, webhook handling, email templates and deployment packaging. Tested the local Cloudflare runtime and `https://www.truselv.co.uk`. No real payments, customer emails, brute-force attempts or load tests were performed.

## Evidence

| Check | Result |
|---|---|
| Node automated tests | 20 passed, including two new security regression tests |
| Static site check | 24 pages and 1,231 local link/asset references passed; fragment, image-alt and PDF checks passed |
| Chromium browser checks | 22 pages at 320, 390, 768 and 1440 px; no detected overflow, JavaScript errors or axe accessibility violations |
| Browser customer journeys | Navigation, forms, shopping review/fallback, resource search, calculator, media/PDFs and no-JavaScript fallback passed locally |
| Mocked payment integration | Mobile payment form, address/email prefill and decline handling passed |
| Live clean page URLs | All 22 manifest pages returned HTTP 200 with the identified audit client |
| Live targeted security probes | 23/23 met safe expected outcomes |
| npm dependency audit | Zero reported vulnerabilities at audit time; this does not cover every vendored file, Python package or third-party service |

Live probes confirmed private environment/configuration/source/Git/preview files returned 404; encoded traversal was rejected with 400; cross-origin POSTs returned 403; invalid checkout data returned 422; malformed JSON returned 400; oversized JSON returned 413; a forged webhook returned 400; malformed order identifiers returned 400; unsupported API methods returned 405. No valid checkout or enquiry submission was made. The first traversal expectation was 404; 400 is also a correct rejection, so the harness expectation was corrected without changing application code.

The default Python HTTP client received 403 responses during an additional page scan. Repeating with the same explicit audit User-Agent used in the security probes returned 200 for every page. This is recorded as client-dependent filtering, not a page outage. HTTP-to-HTTPS redirect behavior was not conclusively verified in this environment.

Existing tests also verify server-controlled pricing/shipping, webhook signature expiry and forgery rejection, payment-state checks, retry/duplicate email handling, safe customer-text escaping, fixed support recipients, public-config secret exclusion and deployment asset isolation. Provider interactions in these tests are mocked.

Local evidence: `.preview/verification.json`, `.preview/security-check.json`, browser screenshots and `.preview/checkout-integration-mobile.png`. These are intentionally excluded from public deployment.

## Follow-ups

1. **Credential rotation — priority action if outstanding.** A Resend API credential was previously pasted into the conversation. Revoke/replace it in Resend and update Cloudflare and local secret storage if this has not already been done. Rotation status was not verifiable from this review. No credential values are included in this report.
2. **Live order delivery — verification gap.** Successful mocked tests and rejection of unsigned webhooks do not prove a real Stripe event will deliver both emails. After the first legitimate order, verify the Stripe webhook delivery succeeded and both buyer/support messages arrived. Also check spam placement. Do not treat an HTTP 400 forged-signature test as proof the configured signing secret matches Stripe.
3. **HTTPS hardening — low severity.** The tested HTTPS homepage includes CSP, frame denial, MIME-sniffing protection, restrictive referrer policy and permissions policy, but no `Strict-Transport-Security` header. Review HTTPS enforcement and enable HSTS after confirming both website hostnames work reliably over HTTPS. Do not blanket-enable `includeSubDomains` or preload without reviewing other subdomains. See [Cloudflare HSTS guidance](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/http-strict-transport-security/).
4. **Abuse resistance — residual risk.** Origin checks, validation, honeypot and per-IP rate limiting are present. Origin headers can be forged by non-browser clients; distributed enquiry spam remains possible. Monitor abuse and add a verified bot challenge if needed. Live rate-limit exhaustion was deliberately avoided; rate-limit behavior was tested locally/mocked.
5. **Delivery operations — deferred scope.** Next-working-day delivery has the 6 pm cutoff in its label; checkout does not enforce a business-day calendar/cutoff dynamically. Ensure fulfilment matches the stated terms. Hardware/accessory/warranty details remain subject to the earlier deferred business review.

## Limits

No authenticated Stripe, Cloudflare, Resend or GitHub account-security audit; no historical Git secret audit; no exhaustive TLS, infrastructure, denial-of-service or distributed-abuse assessment; no manual screen-reader certification; no email-client rendering matrix or real-money payment test. The npm audit does not assess legacy vendored JavaScript; the current Cloudflare package only includes the explicitly allowed active site JavaScript. Security outcomes are point-in-time and apply to the paths and cases tested.

Only regression tests and this report were added during the review. Production behavior and provider settings were not changed.
