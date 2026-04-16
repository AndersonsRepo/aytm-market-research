// ============================================================================
// Pipeline Config Resolution
// Reads config overrides from Supabase pipeline_config table.
// Falls back to hardcoded defaults from constants.ts.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PipelineConfig,
  PipelineConfigSection,
} from './types';
import {
  MODELS,
  INTERVIEW_QUESTIONS,
  FOLLOW_UP_PROBES,
  INTERVIEW_PERSONAS,
  SEGMENTS,
  AGE_OPTIONS,
  INCOME_OPTIONS,
  WORK_OPTIONS,
  OUTDOOR_OPTIONS,
  SEGMENT_PROFILES,
  RESPONSE_SCHEMA,
  LIKERT_KEYS,
  BARRIER_KEYS,
  CONCEPT_APPEAL,
  CATEGORICAL_KEYS,
  DEMOGRAPHIC_KEYS,
  ALL_NUMERIC_KEYS,
  DISCOVERY_QUESTIONS,
  FOUNDER_BRIEF,
  DISCOVERY_SYSTEM_PROMPT,
  MAX_RETRIES,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  REQUEST_TIMEOUT_MS,
  RESPONDENTS_PER_SEGMENT_PER_MODEL,
  MAX_CONCURRENT_API_CALLS,
  MODEL_BIAS,
} from './constants';
import * as benchmarks from './benchmark';

// ─── Default Config (from constants.ts) ──────────────────────────────────

function getDefaultConfig(): PipelineConfig {
  // Transform FOLLOW_UP_PROBES to the interface format
  const followUpProbes = Object.entries(FOLLOW_UP_PROBES).map(([id, probe]) => ({
    id,
    trigger: probe.trigger,
    target: probe.targetQuestion,
    question: probe.question,
  }));

  return {
    questions: {
      interviewQuestions: { ...INTERVIEW_QUESTIONS },
      followUpProbes,
      discoveryQuestions: { ...DISCOVERY_QUESTIONS },
    },
    personas: [...INTERVIEW_PERSONAS],
    segments: {
      segments: [...SEGMENTS],
      ageOptions: { ...AGE_OPTIONS },
      incomeOptions: { ...INCOME_OPTIONS },
      workOptions: { ...WORK_OPTIONS },
      outdoorOptions: { ...OUTDOOR_OPTIONS },
    },
    segmentProfiles: { ...SEGMENT_PROFILES },
    surveySchema: {
      responseSchema: RESPONSE_SCHEMA,
      likertKeys: { ...LIKERT_KEYS },
      barrierKeys: { ...BARRIER_KEYS },
      conceptAppeal: { ...CONCEPT_APPEAL },
      categoricalKeys: [...CATEGORICAL_KEYS],
      demographicKeys: Object.keys(DEMOGRAPHIC_KEYS),
      allNumericKeys: [...ALL_NUMERIC_KEYS],
    },
    founderBrief: {
      founderBrief: FOUNDER_BRIEF,
      discoverySystemPrompt: DISCOVERY_SYSTEM_PROMPT,
    },
    apiSettings: {
      models: { ...MODELS },
      maxRetries: MAX_RETRIES,
      defaultTemperature: DEFAULT_TEMPERATURE,
      defaultMaxTokens: DEFAULT_MAX_TOKENS,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      respondentsPerSegmentPerModel: RESPONDENTS_PER_SEGMENT_PER_MODEL,
      maxConcurrentApiCalls: MAX_CONCURRENT_API_CALLS,
      modelBias: { ...MODEL_BIAS },
    },
    benchmarks: {
      purchaseInterest: benchmarks.BENCHMARK_PURCHASE_INTEREST,
      purchaseLikelihood: benchmarks.BENCHMARK_PURCHASE_LIKELIHOOD,
      useCase: benchmarks.BENCHMARK_USE_CASE,
      greatestBarrier: benchmarks.BENCHMARK_GREATEST_BARRIER,
      bestConcept: benchmarks.BENCHMARK_BEST_CONCEPT,
      valueDrivers: benchmarks.BENCHMARK_VALUE_DRIVERS,
      topValueDriver: benchmarks.BENCHMARK_TOP_VALUE_DRIVER,
      barrierSeverity: benchmarks.BENCHMARK_BARRIER_SEVERITY,
      pricing: benchmarks.BENCHMARK_PRICING,
      demographics: benchmarks.BENCHMARK_DEMOGRAPHICS,
      outreach: benchmarks.BENCHMARK_OUTREACH,
      partnership: benchmarks.BENCHMARK_PARTNERSHIP,
    },
  };
}

// ─── Config Resolution ───────────────────────────────────────────────────

/**
 * Get a single config section. Returns override from Supabase if it exists,
 * otherwise returns the default from constants.ts.
 */
export async function getConfigSection<K extends PipelineConfigSection>(
  supabase: SupabaseClient,
  section: K,
): Promise<PipelineConfig[K]> {
  const defaults = getDefaultConfig();

  const { data, error } = await supabase
    .from('pipeline_config')
    .select('config')
    .eq('section', section)
    .single();

  if (error || !data) {
    return defaults[section];
  }

  return data.config as PipelineConfig[K];
}

/**
 * Get the full merged config (all sections, overrides + defaults).
 * Used at pipeline run start to create the config snapshot.
 */
export async function getFullConfig(
  supabase: SupabaseClient,
): Promise<PipelineConfig> {
  const defaults = getDefaultConfig();

  const { data: overrides } = await supabase
    .from('pipeline_config')
    .select('section, config');

  if (!overrides || overrides.length === 0) {
    return defaults;
  }

  // Merge overrides into defaults
  const config = { ...defaults };
  for (const row of overrides) {
    const section = row.section as PipelineConfigSection;
    if (section in config) {
      (config as Record<string, unknown>)[section] = row.config;
    }
  }

  return config;
}

/**
 * Get the config snapshot from a completed pipeline run.
 * Falls back to current config if no snapshot exists (for runs before this feature).
 */
export async function getRunConfig(
  supabase: SupabaseClient,
  runId: string,
): Promise<PipelineConfig> {
  const { data } = await supabase
    .from('pipeline_runs')
    .select('config_snapshot')
    .eq('id', runId)
    .single();

  if (data?.config_snapshot) {
    return data.config_snapshot as PipelineConfig;
  }

  // Fallback for runs created before config system existed
  return getFullConfig(supabase);
}

/**
 * Export defaults for use by the config API (to show what the defaults are).
 */
export { getDefaultConfig };
