CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ulomis_threads (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  variant text NOT NULL,
  category text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  counterparty_label text NOT NULL DEFAULT '',
  amount_minor bigint,
  currency text,
  stage text NOT NULL DEFAULT 'UNKNOWN',
  state text NOT NULL CHECK (state IN ('WAITING_EXTERNAL','ACTION_REQUIRED','UNCONFIRMED','RESOLVED')),
  next_actor text NOT NULL CHECK (next_actor IN ('USER','COUNTERPARTY','UNKNOWN')),
  attention_date date,
  next_action_text text NOT NULL DEFAULT '',
  state_summary text NOT NULL DEFAULT '',
  canonical_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(canonical_state)='object'),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence)='array'),
  history jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(history)='array'),
  corrections jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(corrections)='array'),
  last_delta jsonb,
  source_text text NOT NULL DEFAULT '' CHECK (char_length(source_text)<=6000),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  resolved_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ulomis_threads_user_variant_updated_idx ON ulomis_threads(user_id,variant,updated_at DESC);
CREATE INDEX IF NOT EXISTS ulomis_threads_user_variant_state_idx ON ulomis_threads(user_id,variant,state) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ulomis_threads_user_variant_attention_idx ON ulomis_threads(user_id,variant,attention_date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ulomis_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  session_id text,
  variant text NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category text,
  milestone text,
  referral_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(meta)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ulomis_events_user_variant_created_idx ON ulomis_events(user_id,variant,created_at DESC);
CREATE INDEX IF NOT EXISTS ulomis_events_session_variant_created_idx ON ulomis_events(session_id,variant,created_at DESC);
CREATE INDEX IF NOT EXISTS ulomis_events_ai_limit_idx ON ulomis_events(variant,name,created_at DESC);
