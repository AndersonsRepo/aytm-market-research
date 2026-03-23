-- Pipeline run tracking
CREATE TABLE pipeline_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('live', 'demo')),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'error')),
  current_stage INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stage progress (realtime)
CREATE TABLE stage_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'error')),
  progress_pct INTEGER DEFAULT 0,
  message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(run_id, stage)
);

-- Stage 1: Client Discovery
CREATE TABLE discovery_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  question_key TEXT NOT NULL,
  question_label TEXT NOT NULL,
  question_text TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE discovery_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  brief JSONB NOT NULL,
  models_used TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stage 2: Interviews
CREATE TABLE interview_transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  interview_id TEXT NOT NULL,
  model TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  persona_name TEXT NOT NULL,
  demographics JSONB NOT NULL,
  responses JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE interview_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  interview_id TEXT NOT NULL,
  sentiment_scores JSONB NOT NULL,
  primary_emotion TEXT,
  secondary_emotion TEXT,
  emotion_intensity INTEGER,
  emotion_reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE interview_themes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('lda', 'llm')),
  theme_name TEXT NOT NULL,
  description TEXT,
  frequency INTEGER,
  keywords TEXT[],
  supporting_quotes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stage 3: Survey Design
CREATE TABLE survey_designs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  design JSONB NOT NULL,
  total_questions INTEGER,
  estimated_duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE survey_coverage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  section_label TEXT NOT NULL,
  models_including TEXT[] NOT NULL,
  question_counts JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stage 4: Survey Responses
CREATE TABLE survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  respondent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  segment_id INTEGER NOT NULL,
  segment_name TEXT NOT NULL,
  responses JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stage 5: Analysis
CREATE TABLE analysis_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  group_by TEXT,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stage 6: Validation
CREATE TABLE validation_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  quality_checks JSONB NOT NULL,
  bias_detection JSONB NOT NULL,
  confidence_intervals JSONB NOT NULL,
  grade TEXT NOT NULL,
  issues_found INTEGER NOT NULL,
  total_checks INTEGER NOT NULL,
  recommendation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE respondent_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  respondent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  segment_name TEXT NOT NULL,
  quality_score INTEGER NOT NULL,
  response_sd REAL,
  unique_values INTEGER,
  attention_pass BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable realtime for progress tracking
ALTER PUBLICATION supabase_realtime ADD TABLE stage_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_runs;

-- Open RLS for hackathon demo (no auth)
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON pipeline_runs FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE stage_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON stage_progress FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE discovery_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON discovery_responses FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE discovery_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON discovery_briefs FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE interview_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON interview_transcripts FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE interview_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON interview_analysis FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE interview_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON interview_themes FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE survey_designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON survey_designs FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE survey_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON survey_coverage FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON survey_responses FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON analysis_results FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE validation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON validation_reports FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE respondent_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON respondent_scores FOR ALL USING (true) WITH CHECK (true);
