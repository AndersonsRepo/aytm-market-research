-- Add cost tracking columns to stage_progress
ALTER TABLE stage_progress ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;
ALTER TABLE stage_progress ADD COLUMN IF NOT EXISTS cost_estimate NUMERIC(10,6) DEFAULT 0;

-- Add total cost to pipeline_runs
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10,6) DEFAULT 0;
