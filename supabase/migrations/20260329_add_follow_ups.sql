-- Add follow_ups column for multi-turn interview probes
ALTER TABLE interview_transcripts
ADD COLUMN IF NOT EXISTS follow_ups JSONB;

COMMENT ON COLUMN interview_transcripts.follow_ups IS 'Multi-turn follow-up exchanges: [{probe_key, trigger, question, response}]';
