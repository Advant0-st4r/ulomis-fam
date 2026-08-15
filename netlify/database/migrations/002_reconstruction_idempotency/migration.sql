ALTER TABLE ulomis_threads ADD COLUMN IF NOT EXISTS last_request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS ulomis_threads_user_variant_request_idx
  ON ulomis_threads(user_id, variant, last_request_id)
  WHERE last_request_id IS NOT NULL;
