-- Normalise the commercial model to two tiers. Resident-assigned tablets are
-- a TESS Organisation device mode, not a separate subscription plan.
UPDATE facilities SET plan='organisation' WHERE plan='dedicated';

CREATE INDEX IF NOT EXISTS facilities_plan_status ON facilities(plan,status);
