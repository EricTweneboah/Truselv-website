# Website resources

In the admin portal, select **Website resources → Add resource**. Enter a title,
category and short description, then add article text, a PDF/plain-text document
(up to 10 MB), or both. Word documents should be exported as PDF.

- **Preview** shows unsaved text without publishing it.
- **Save draft** keeps new resources private and leaves any published version unchanged.
- **Publish resource / Publish changes** makes the current version public at `/resources`.
- **Unpublish** removes public access, including the download, and retains the draft.

New resources are public downloads; the existing static guides retain their existing
work-email access rules. The existing guides are maintained in the website source.
Uploaded content is plain text, not HTML. Document downloads use attachment disposition
and private R2 storage. Only `truselv_admin` may access the editor API. Updates use a
revision check to prevent overwriting another administrator's changes.

## Storage and deployment

Both Workers bind `RESOURCE_DB` to `truselv-website-resources` and `RESOURCE_FILES`
to the private R2 bucket of the same name. The public website has no binding to the
facility database. Apply `website-content/schema.sql` to the resource database before
deploying. It is separate from portal migrations and contains no patient information.
Superseded documents are retained privately; no automatic deletion runs during editing.

The portal uses `/logo-white.svg` and the TruSelv `/favicon.ico`. Cloudflare Access
login design uses the public TruSelv logo, ivory background and navy text, with
the heading “TruSelv Administration”. Access login design is organisation-wide;
facility sign-in is handled by the existing portal code. Cloudflare's hosted Access
login does not expose a custom favicon setting; the branded favicon appears after
entering the portal. Authentication and password behavior are unchanged.

## Verification

`npm test` includes publishing, permissions, upload validation, draft isolation,
optimistic concurrency and unpublishing tests. `npm run check` checks site assets.

For the full local browser check, initialise the portal schema and resource schema
using Wrangler D1 `--local`; seed `editor@example.com` as a `truselv_admin` in the
local portal database. Start the portal on port 8791 with
`--var DEV_IDENTITY_EMAIL:editor@example.com --var PORTAL_HOST:facility.local`.
Start the website on port 8792 with `--persist-to portal/.wrangler/state` so both
Workers share local resource storage. Run `python scripts/resources_browser_check.py`.
Never add these local identity overrides to deployed configuration. The browser check
uses local data only and leaves its test resource unpublished.
