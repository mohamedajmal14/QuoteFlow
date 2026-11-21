CREATE SEQUENCE IF NOT EXISTS quote_number_seq START WITH 100;

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  client TEXT NOT NULL,
  contact TEXT NOT NULL,
  owner TEXT NOT NULL,
  service TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  stage TEXT NOT NULL CHECK (stage IN ('discovery', 'proposal', 'negotiation', 'won', 'lost')),
  probability INTEGER NOT NULL CHECK (probability BETWEEN 0 AND 100),
  expected_close_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_action TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  health TEXT NOT NULL CHECK (health IN ('on-track', 'at-risk', 'closed')),
  CHECK (cardinality(tags) <= 8)
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'call', 'demo', 'proposal-review')),
  due_date DATE NOT NULL,
  note TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quotes_stage_idx ON quotes(stage);
CREATE INDEX IF NOT EXISTS quotes_owner_idx ON quotes(LOWER(owner));
CREATE INDEX IF NOT EXISTS quotes_updated_at_idx ON quotes(updated_at DESC);
CREATE INDEX IF NOT EXISTS follow_ups_quote_id_idx ON follow_ups(quote_id);
CREATE INDEX IF NOT EXISTS follow_ups_due_date_idx ON follow_ups(due_date) WHERE completed = FALSE;
