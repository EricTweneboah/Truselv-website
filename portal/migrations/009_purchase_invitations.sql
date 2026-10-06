CREATE TABLE IF NOT EXISTS purchase_invitations (
  id TEXT PRIMARY KEY,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  max_quantity INTEGER NOT NULL CHECK(max_quantity BETWEEN 1 AND 50),
  expires_at TEXT NOT NULL,
  sent_by TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS purchase_invitations_sent_at
  ON purchase_invitations(sent_at DESC);

CREATE INDEX IF NOT EXISTS purchase_invitations_customer_email
  ON purchase_invitations(customer_email);
