# TESS app integration

## 1. Register a device during onboarding

An authorised TruSelv administrator creates the device in `admin.truselv.co.uk`. The portal displays a one-time device key. During secure, in-person setup, enter that key in the TESS app. Do not embed it in the app build, log it, or send it by email.

Store the key using Android Keystore / encrypted storage. The app must use HTTPS only.

## 2. Activate and bootstrap the registered device

Immediately after a staff member enters the one-time device key, call `POST https://device-api.truselv.co.uk/api/device/activate`. The portal records the device as active. Do this only during an authorised setup. This dedicated hostname is only for token-protected device calls; browser staff use the Cloudflare-Access-protected portal hostname.

Then call bootstrap at app launch:

Call `GET https://device-api.truselv.co.uk/api/device/bootstrap` with:

```http
Authorization: Bearer <device-key>
```

If the response says `suspended`, `retired`, or the licence is not active, block the facility-linked experience and show a local support message. Keep core offline-only activities separate from portal access decisions if that is part of the agreed service.

## 3. Send usage events

Send batches to `POST https://device-api.truselv.co.uk/api/device/events` after an activity finishes or every few minutes. Use IDs, not resident names or dates of birth:

```json
{
  "events": [{
    "id": "uuid-generated-on-device",
    "residentId": "portal-resident-uuid-or-null",
    "feature": "music",
    "eventName": "activity_completed",
    "durationSeconds": 420,
    "occurredAt": "2026-09-24T12:30:00.000Z"
  }]
}
```

Retry safely with the same event ID after a network failure. The server ignores duplicate IDs. Queue events locally in encrypted storage and remove them after a successful response. Do not capture voice recordings, free text, conversation transcripts, contacts, medical notes, location, or advertising identifiers for this reporting service.

The portal derives the facility and ward from the registered device. The app must never send a facility ID or ward ID as a user-controlled value. For aggregate-only wards, send `residentId: null`; the portal still records the interaction count and feature for that ward.

## 4. Resident selection

Only show facility residents returned by a future resident-assignment endpoint when a member of staff selects the person. Do not infer identity through voice, face, or behaviour. The app should allow activities without a resident selection.

## 5. Security requirements

- Keep the device key in platform secure storage.
- Never write the key or resident data to debug logs, analytics SDKs, crash reports or screenshots.
- Use certificate validation; do not accept invalid certificates.
- Implement remote sign-out by checking bootstrap on launch and at least every 24 hours.
- Build a clear local “contact your facility administrator” recovery screen.
