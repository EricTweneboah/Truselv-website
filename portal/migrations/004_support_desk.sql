-- Facility-scoped support tickets and service-desk conversation history.
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  requester_user_id TEXT REFERENCES facility_users(id) ON DELETE SET NULL,
  requester_email TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','open','waiting','resolved','closed')),
  assigned_to TEXT,
  resolution TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS support_tickets_facility_updated ON support_tickets(facility_id, updated_at);
CREATE INDEX IF NOT EXISTS support_tickets_status_updated ON support_tickets(status, updated_at);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  author_role TEXT NOT NULL,
  message TEXT NOT NULL,
  visible_to_facility INTEGER NOT NULL DEFAULT 1 CHECK(visible_to_facility IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at);
