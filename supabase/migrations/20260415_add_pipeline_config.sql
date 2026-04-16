-- Pipeline configuration overrides (defaults live in constants.ts)
CREATE TABLE pipeline_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pipeline_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON pipeline_config FOR ALL USING (true) WITH CHECK (true);

-- Snapshot active config on each pipeline run for reproducibility
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS config_snapshot JSONB;
