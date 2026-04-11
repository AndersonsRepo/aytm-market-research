-- Add model column to interview_themes for STAMP 3-model tracking
ALTER TABLE interview_themes ADD COLUMN IF NOT EXISTS model TEXT;
