// ============================================================================
// Pipeline Types — TypeScript port of Python pipeline data structures
// Maps to Supabase schema (schema.sql) and Python codebase
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';

// --- Pipeline Run ---

export type PipelineMode = 'live' | 'demo';
export type PipelineStatus = 'idle' | 'running' | 'completed' | 'error';

export interface PipelineRun {
  id: string; // UUID
  mode: PipelineMode;
  status: PipelineStatus;
  current_stage: number; // 0-6
  started_at: string | null; // ISO timestamp
  completed_at: string | null;
  created_at: string;
}

// --- Stage Progress ---

export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type StageStatus = 'pending' | 'running' | 'completed' | 'error';

export interface StageProgress {
  id: string;
  run_id: string;
  stage: StageNumber;
  status: StageStatus;
  progress_pct: number; // 0-100
  message: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

// --- Stage 1: Client Discovery ---

export interface DiscoveryResponse {
  id?: string;
  run_id: string;
  model: string;
  question_key: string;
  question_label: string;
  question_text: string;
  response: string;
  created_at?: string;
}

export interface DiscoveryBrief {
  id?: string;
  run_id: string;
  brief: Record<string, unknown>;
  models_used: string[];
  created_at?: string;
}

// --- Stage 2: Interviews ---

export interface InterviewPersona {
  persona_id: string; // INT01-INT30
  name: string;
  age: string; // e.g. "25-34"
  income: string; // e.g. "$75,000-$99,999"
  work_arrangement: string;
  home_situation: string;
  household: string;
  lifestyle_note: string;
  hoa_status: string; // "Yes" | "No" | "I'm not sure"
}

export interface InterviewDemographics {
  age: string;
  income: string;
  work_arrangement: string;
  home_situation: string;
  household: string;
  lifestyle_note: string;
  hoa_status: string;
}

export type InterviewQuestionKey =
  | 'IQ1' | 'IQ2' | 'IQ3' | 'IQ4'
  | 'IQ5' | 'IQ6' | 'IQ7' | 'IQ8'
  | 'additional_thoughts';

export interface InterviewTranscript {
  id?: string;
  run_id: string;
  interview_id: string; // e.g. "INT01_GPT-4.1-mini"
  model: string; // model label
  persona_id: string;
  persona_name: string;
  demographics: InterviewDemographics;
  responses: Record<InterviewQuestionKey, string>;
  created_at?: string;
}

export type EmotionType =
  | 'excitement' | 'skepticism' | 'anxiety' | 'curiosity'
  | 'indifference' | 'aspiration' | 'frustration' | 'pragmatism';

export interface InterviewAnalysis {
  id?: string;
  run_id: string;
  interview_id: string;
  sentiment_scores: Record<string, number>; // per-question VADER compound scores + overall
  primary_emotion: EmotionType | null;
  secondary_emotion: EmotionType | null;
  emotion_intensity: 1 | 2 | 3 | 4 | 5 | null;
  emotion_reasoning: string | null;
  created_at?: string;
}

export type ThemeSource = 'lda' | 'llm';

export interface SupportingQuote {
  respondent_id: string;
  quote: string;
}

export interface InterviewTheme {
  id?: string;
  run_id: string;
  source: ThemeSource;
  theme_name: string;
  description: string | null;
  frequency: number | null;
  keywords: string[] | null;
  supporting_quotes: SupportingQuote[] | null;
  created_at?: string;
}

// --- Stage 3: Survey Design ---

export interface SurveyDesign {
  id?: string;
  run_id: string;
  model: string;
  design: Record<string, unknown>; // full survey design JSON
  total_questions: number | null;
  estimated_duration_minutes: number | null;
  created_at?: string;
}

export interface SurveyCoverage {
  id?: string;
  run_id: string;
  section_id: string;
  section_label: string;
  models_including: string[];
  question_counts: Record<string, number>;
  created_at?: string;
}

// --- Stage 4: Survey Responses ---

export interface SurveyResponse {
  id?: string;
  run_id: string;
  respondent_id: string; // e.g. "S1_GPT-4.1-mini_1"
  model: string; // model label
  segment_id: number; // 1-5
  segment_name: string;
  responses: Record<string, string | number | string[]>;
  created_at?: string;
}

// --- Segments ---

export interface SegmentDemographics {
  Q21: string; // age bracket
  Q22: string; // income bracket
  Q23: string; // work arrangement
  Q24: string | string[]; // HOA status (options)
  Q25: string; // outdoor frequency
  Q26: string; // outdoor club member
}

export interface Segment {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  demographics: SegmentDemographics;
  psychographic: string;
}

export interface RespondentConfig {
  name: string;
  demographics: Record<string, string>;
  psychographic: string;
  variation: string;
  segment_id: number;
  segment_name: string;
}

// --- Stage 5: Analysis ---

export type AnalysisType =
  | 'descriptive_likert'
  | 'descriptive_categorical'
  | 'model_comparison_likert'
  | 'model_comparison_categorical'
  | 'barrier_heatmap'
  | 'segment_profiles'
  | 'kruskal_wallis'
  | 'inter_llm_reliability'
  | 'benchmark_comparison'
  | 'disagreement_analysis'
  | 'stamp_emotion_classification'
  | 'stamp_theme_extraction'
  | 'stamp_interpretation_agreement';

export interface AnalysisResult {
  id?: string;
  run_id: string;
  analysis_type: AnalysisType;
  group_by: string | null;
  results: Record<string, unknown>;
  created_at?: string;
}

// --- Stage 6: Validation ---

export interface QualityCheck {
  check_name: string;
  passed: boolean;
  details: string;
  value?: number;
}

export interface BiasDetection {
  test_name: string;
  variable: string;
  statistic: number;
  p_value: number;
  significant: boolean;
  effect_size?: number;
}

export interface ConfidenceInterval {
  variable: string;
  mean: number;
  ci_lower: number;
  ci_upper: number;
  n: number;
}

export interface ValidationReport {
  id?: string;
  run_id: string;
  quality_checks: QualityCheck[];
  bias_detection: BiasDetection[];
  confidence_intervals: ConfidenceInterval[];
  grade: string; // e.g. "A", "B+", "C"
  issues_found: number;
  total_checks: number;
  recommendation: string;
  created_at?: string;
}

export interface RespondentScore {
  id?: string;
  run_id: string;
  respondent_id: string;
  model: string;
  segment_name: string;
  quality_score: number; // integer
  response_sd: number | null;
  unique_values: number | null;
  attention_pass: boolean | null;
  created_at?: string;
}

// --- OpenRouter Config ---

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature: number;
  max_tokens: number;
  response_format?: { type: 'json_object' };
}

export interface OpenRouterChoice {
  message: {
    content: string;
    role: 'assistant';
  };
  finish_reason: string;
  index: number;
}

export interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// --- Sentiment ---

export interface VaderScores {
  neg: number;
  neu: number;
  pos: number;
  compound: number;
}

// --- Emotion Classification ---

export interface EmotionClassification {
  primary_emotion: string;
  secondary_emotion: string | null;
  intensity: number;
  reasoning: string;
}

// --- Stage Results (discriminated union) ---

export interface Stage1Result {
  stage: 1;
  responses: DiscoveryResponse[];
  brief: DiscoveryBrief;
}

export interface Stage2Result {
  stage: 2;
  transcripts: InterviewTranscript[];
  analysis: InterviewAnalysis[];
  themes: InterviewTheme[];
}

export interface Stage3Result {
  stage: 3;
  designs: SurveyDesign[];
  coverage: SurveyCoverage[];
}

export interface Stage4Result {
  stage: 4;
  responses: SurveyResponse[];
  respondentCount: number;
}

export interface Stage5Result {
  stage: 5;
  results: AnalysisResult[];
}

export interface Stage6Result {
  stage: 6;
  report: ValidationReport;
  scores: RespondentScore[];
}

export type StageResult =
  | Stage1Result
  | Stage2Result
  | Stage3Result
  | Stage4Result
  | Stage5Result
  | Stage6Result;

// --- Model info ---

export interface ModelInfo {
  id: string; // OpenRouter model ID
  label: string; // Display name
}

// --- Segment profile for demo mode data generation ---

export type LikertProfile = [mean: number, spread: number];

export interface SegmentProfile {
  Q0a: string[];
  Q0b: LikertProfile;
  Q1: LikertProfile;
  Q2: LikertProfile;
  Q3: string[];
  Q5_cost: LikertProfile;
  Q5_hoa: LikertProfile;
  Q5_permit: LikertProfile;
  Q5_space: LikertProfile;
  Q5_financing: LikertProfile;
  Q5_quality: LikertProfile;
  Q5_resale: LikertProfile;
  Q6: string[];
  Q7: LikertProfile;
  Q9a: LikertProfile;
  Q9b: LikertProfile;
  Q10a: LikertProfile;
  Q10b: LikertProfile;
  Q11a: LikertProfile;
  Q11b: LikertProfile;
  Q12a: LikertProfile;
  Q12b: LikertProfile;
  Q13a: LikertProfile;
  Q13b: LikertProfile;
  Q14: string[];
  Q15: LikertProfile;
  Q16: LikertProfile;
  Q17: LikertProfile;
  Q17b: LikertProfile;
  Q17c: LikertProfile;
  Q18: string[];
  Q19: LikertProfile;
  Q20: string[][];
}

// --- Model bias for demo mode ---

export interface ModelBias {
  [modelLabel: string]: number;
}

// --- Stage function signature ---

export type StageFn = (
  supabase: SupabaseClient,
  runId: string,
  apiKey: string
) => Promise<unknown>;

