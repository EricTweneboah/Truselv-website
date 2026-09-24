# TESS facility portal

This is the separate, protected service for `portal.truselv.co.uk` and `admin.truselv.co.uk`. It is intentionally not part of the public marketing Worker.

## Before first deployment

1. Create a Cloudflare D1 database named `tess-facility-portal` and replace `database_id` in `wrangler.jsonc`.
2. Apply `schema.sql` with `npx wrangler d1 execute tess-facility-portal --remote --file=schema.sql`.
3. Create a 32-byte base64 encryption key and set it as the Worker secret: `npx wrangler secret put FIELD_ENCRYPTION_KEY`.
4. Deploy with `npx wrangler deploy` from this directory.
5. Add custom domains `portal.truselv.co.uk` and `admin.truselv.co.uk` to this Worker.
6. Protect both domains with Cloudflare Zero Trust Access. Require named work-email identities and MFA. The Worker trusts the Access identity header only after Access protects the route.
7. Provision the first TruSelv administrator directly in D1. All other access is assigned through the admin workspace and the Cloudflare Access policy.

## Data model and boundaries

- `facility_users.facility_id` is the tenant boundary. Every facility query is scoped to the signed-in user’s facility.
- Resident first name, last name and date of birth are encrypted before storage. Usage events use resident IDs rather than names.
- The device activation key is shown once when a TESS device is registered. Only its SHA-256 hash is retained.
- The portal is for service insight and management; it must not be presented as a clinical record or decision-support system.

## Roles

| Role | Scope |
|---|---|
| `truselv_admin` | All facilities, onboarding, devices, licences and audit history |
| `facility_admin` | One facility, people, residents, devices and reports |
| `activities_lead` | One facility, resident list and aggregate reports |
| `viewer` | One facility, aggregate reports only |

## TESS app contract

The app uses a registered device key with `Authorization: Bearer <device-key>`:

- `GET /api/device/bootstrap` returns the facility ID, device status and active licence.
- `POST /api/device/events` accepts a bounded batch of privacy-minimised activity events.

See `APP_INTEGRATION.md` for the exact integration work.
