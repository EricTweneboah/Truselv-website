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
npx wrangler secret put RESEND_MARKETING_SEGMENT_ID
npx wrangler secret put MARKETING_FROM
```

`PORTAL_INVITE_FROM` must be a verified sender, for example `TruSelv <website@truselv.co.uk>`. If email delivery is not configured or Resend rejects it, access is still created and the admin portal displays a manual link instead of claiming that an email was sent.

`RESEND_MARKETING_SEGMENT_ID` connects the website consent form and the admin **Marketing updates** page to the same Resend segment. Set the same value on the website Worker. `MARKETING_FROM` must be a verified sender such as `TruSelv updates <updates@truselv.co.uk>`. Only TruSelv administrators can list contacts, send tests, save drafts, or schedule and send broadcasts. Resend supplies the unsubscribe link and suppresses contacts who opt out.

## Upgrade: ward-scoped access

For the deployed database, apply the ward migration once before deploying the updated Worker:

```powershell
npx wrangler d1 execute tess-facility-portal --remote --file=migrations/001_wards.sql
npx wrangler deploy
```

Every new device must be assigned to a ward. Existing unassigned devices should be retired or re-registered after creating the appropriate wards.

## Upgrade: TESS Standard and TESS Organisation

Apply all earlier migrations, then apply the organisation-platform migration
before deploying the Worker:

```powershell
npx wrangler d1 execute tess-facility-portal --remote --file=migrations/007_tess_organisation_platform.sql
npx wrangler deploy
```

Migration 007 is additive. It converts aggregate licence counts into numbered
tablet seats, preserves existing device/licence links, and adds versioned
organisation configuration, customer-owned device support, dedicated resident
assignments, device commands and encrypted resident profile forms.

The operating model is:

- **TESS Standard** is the maintained personal/family experience.
- **TESS Organisation** adds an isolated organisation tenant, roles, wards or
  units, resident sessions, evidence, configurable branding/features and
  centrally managed tablets.
- A tablet seat can be used by either a TruSelv-supplied or customer-owned
  compatible tablet.
- Shared tablets select a ward and start individual, group or anonymous
  sessions.
- Dedicated tablets pair to one resident. Ending the assignment locks the
  tablet in `privacy_reset_pending`; it cannot be assigned again until the app
  securely deletes resident-local data and acknowledges the reset command.

## Data model and boundaries

- `facility_users.facility_id` is the tenant boundary. Every facility query is scoped to the signed-in user’s facility; `ward_id` limits ward accounts to one ward.
- Resident first name, last name and date of birth are encrypted before storage. Usage events use resident IDs rather than names.
- The device activation key is shown once when a TESS device is registered. Only its SHA-256 hash is retained.
- The portal is for service insight and management; it must not be presented as a clinical record or decision-support system.

## Roles

| Role | Scope |
|---|---|
| `truselv_admin` | All facilities, onboarding, devices, licences and audit history |
| `facility_admin` | One facility, wards, resident registration, people, devices and reports |
| `facility_head` | One facility, wards, resident registration and reports |
| `activities_lead` | One facility, activity and resident participation reports |
| `viewer` | One facility, aggregate reports only |
| `ward_analytics` | One ward, aggregate interaction analytics only |

`ward_analytics` is intended for a shared ward login. It provides counts and feature usage only; it cannot open resident records, device records, licences, or team access. Cloudflare Access authenticates the shared login email. The audit trail therefore records the ward account, not the individual staff member using it.

## TESS app contract

The app uses a registered device key with `Authorization: Bearer <device-key>`:

- `GET /api/device/bootstrap` returns the tenant configuration, device mode,
  resident assignment and pending commands as well as licence status.
- `GET /api/device/context` returns the device ward's active residents and current activity session.
- `POST /api/device/sessions/start` starts a validated individual, group, or anonymous session.
- `POST /api/device/sessions/end` ends the active session.
- `POST /api/device/events` accepts a bounded batch of privacy-minimised activity events.
- `GET|POST /api/device/profile-forms` loads and saves encrypted profile forms
  only for the resident in the current individual or dedicated session.
- `POST /api/device/commands/ack` confirms that a tablet completed a safe
  command such as the mandatory reassignment privacy reset.

The dedicated analytics page uses the self-hosted Apache ECharts build and structured session observations. See `ANALYTICS_CQC.md` for evidence boundaries, CQC mapping, and scaling guidance.

Resident bulk import uses the self-hosted ExcelJS browser build to generate and read the `.xlsx` template. The Worker validates every submitted row before creating encrypted resident records.

See `APP_INTEGRATION.md` for the exact integration work.
