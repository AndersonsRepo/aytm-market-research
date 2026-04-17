-- Per-IP rate limiting for public endpoints
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created
  ON rate_limits(key, created_at DESC);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON rate_limits FOR ALL USING (true) WITH CHECK (true);
