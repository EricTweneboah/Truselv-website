# TESS facility portal

This is the separate service for `portal.truselv.co.uk`, `admin.truselv.co.uk`, and `device-api.truselv.co.uk`. The browser portals are protected by Cloudflare Access; the device API uses a unique device activation key and has no browser interface.

## Before first deployment

1. Create a Cloudflare D1 database named `tess-facility-portal` and replace `database_id` in `wrangler.jsonc`.
2. Apply `schema.sql` with `npx wrangler d1 execute tess-facility-portal --remote --file=schema.sql`.
3. Create a 32-byte base64 encryption key and set it as the Worker secret: `npx wrangler secret put FIELD_ENCRYPTION_KEY`.
4. Deploy with `npx wrangler deploy` from this directory.
5. Add custom domains `portal.truselv.co.uk` and `admin.truselv.co.uk` to this Worker.
6. Protect both domains with Cloudflare Zero Trust Access. Require named work-email identities and MFA. The Worker trusts the Access identity header only after Access protects the route.
7. Provision the first TruSelv administrator directly in D1. All other access is assigned through the admin workspace and the Cloudflare Access policy.

## Admin-managed portal invitations

To allow **Team access → Create secure invitation** to add a manager to Cloudflare Access automatically, create a restricted Cloudflare API token with only **Access: Apps and Policies — Edit** permission for this account. Store it only as the Worker secret `CF_ACCESS_API_TOKEN`:

```powershell
npx wrangler secret put CF_ACCESS_API_TOKEN
```

The Worker finds the Access application for `portal.truselv.co.uk` and creates an allow policy for the exact invited email address. Keep One-time PIN as the portal application's sole login method. Do not use a global API key.

To send the invitation automatically, set these additional Worker secrets using the existing verified Resend sender:

```powershell
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put PORTAL_INVITE_FROM
```

`PORTAL_INVITE_FROM` must be a verified sender, for example `TruSelv <website@truselv.co.uk>`. If email delivery is not configured or Resend rejects it, access is still created and the admin portal displays a manual link instead of claiming that an email was sent.

## Upgrade: ward-scoped access

For the deployed database, apply the ward migration once before deploying the updated Worker:

```powershell
npx wrangler d1 execute tess-facility-portal --remote --file=migrations/001_wards.sql
npx wrangler deploy
```

Every new device must be assigned to a ward. Existing unassigned devices should be retired or re-registered after creating the appropriate wards.

## Data model and boundaries

- `facility_users.facility_id` is the tenant boundary. Every facility query is scoped to the signed-in user’s facility; `ward_id` limits ward accounts to one ward.
- Resident first name, last name and date of birth are encrypted before storage. Usage events use resident IDs rather than names.
- The device activation key is shown once when a TESS device is registered. Only its SHA-256 hash is retained.
- The portal is for service insight and management; it must not be presented as a clinical record or decision-support system.

## Roles

| Role | Scope |
|---|---|
| `truselv_admin` | All facilities, onboarding, devices, licences and audit history |
| `facility_admin` | One facility, people, residents, devices and reports |
| `facility_head` | One facility, all aggregate ward analytics only |
| `activities_lead` | One facility, resident list and aggregate reports |
| `viewer` | One facility, aggregate reports only |
| `ward_analytics` | One ward, aggregate interaction analytics only |

`ward_analytics` is intended for a shared ward login. It provides counts and feature usage only; it cannot open resident records, device records, licences, or team access. Cloudflare Access authenticates the shared login email. The audit trail therefore records the ward account, not the individual staff member using it.

## TESS app contract

The app uses a registered device key with `Authorization: Bearer <device-key>`:

- `GET /api/device/bootstrap` returns the facility ID, device status and active licence.
- `POST /api/device/events` accepts a bounded batch of privacy-minimised activity events.

See `APP_INTEGRATION.md` for the exact integration work.
