-- Records the narrow Cloudflare Access policy created for a portal invitation.
ALTER TABLE facility_users ADD COLUMN access_policy_id TEXT;
