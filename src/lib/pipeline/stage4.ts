/**
 * Stage 4: Survey Response Generation
 *
 * Generates 90 synthetic survey respondents (5 segments × 6 respondents × 3 models)
 * using OpenRouter. Each respondent answers a full quantitative survey in-character.
 *
 * Ported from synthetic_respondents.py
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { Segment, RespondentConfig, Stage4Result } from "@/lib/pipeline/types";
import {
  MODEL_IDS,
  MODEL_LABELS,
  SEGMENTS,
  RESPONDENTS_PER_SEGMENT_PER_MODEL,
  MAX_CONCURRENT_API_CALLS,
  ALL_NUMERIC_KEYS,
  RESPONSE_SCHEMA,
  AGE_OPTIONS,
  INCOME_OPTIONS,
  WORK_OPTIONS,
  OUTDOOR_OPTIONS,
  VARIATION_SEEDS,
  FIRST_NAMES,
} from "@/lib/pipeline/constants";
import { callOpenRouter, parseJsonResponse } from "@/lib/pipeline/openrouter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateProgress(
  supabase: SupabaseClient,
  runId: string,
  pct: number,
  message: string,
  status: "running" | "completed" | "error" = "running"
) {
  const update: Record<string, unknown> = {
    progress_pct: pct,
    message,
    status,
  };
  if (status === "running" && pct === 0) {
    update.started_at = new Date().toISOString();
  }
  if (status === "completed") {
    update.completed_at = new Date().toISOString();
  }

  await supabase
    .from("stage_progress")
    .upsert(
      { run_id: runId, stage: 4, ...update },
      { onConflict: "run_id,stage" }
    );
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let idx = 0;

  async function next(): Promise<void> {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        const value = await tasks[i]();
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    next()
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Seeded RNG (deterministic per respondent)
// ---------------------------------------------------------------------------

/** Mulberry32 seeded PRNG */
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(
  segmentId: number,
  respondentIndex: number,
  modelId: string
): number {
  let hash = 0;
  const str = `${segmentId}:${respondentIndex}:${modelId}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededChoice<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Respondent Config Generation
// ---------------------------------------------------------------------------

function getRespondentConfig(
  segment: Segment,
  respondentIndex: number,
  modelId: string
): RespondentConfig {
  const rng = seededRng(hashSeed(segment.id, respondentIndex, modelId));

  const name = seededChoice(rng, FIRST_NAMES);

  const demo: Record<string, string> = {};

  // Vary demographics within segment's option range
  demo.Q21 = AGE_OPTIONS[segment.id]
    ? seededChoice(rng, AGE_OPTIONS[segment.id])
    : segment.demographics.Q21;

  demo.Q22 = INCOME_OPTIONS[segment.id]
    ? seededChoice(rng, INCOME_OPTIONS[segment.id])
    : segment.demographics.Q22;

  demo.Q23 = WORK_OPTIONS[segment.id]
    ? seededChoice(rng, WORK_OPTIONS[segment.id])
    : segment.demographics.Q23;

  // HOA: pick from segment options
  const q24 = segment.demographics.Q24;
  demo.Q24 = Array.isArray(q24) ? seededChoice(rng, q24) : q24;

  // Outdoor frequency variation for applicable segments
  demo.Q25 = OUTDOOR_OPTIONS[segment.id]
    ? seededChoice(rng, OUTDOOR_OPTIONS[segment.id])
    : segment.demographics.Q25;

  demo.Q26 = segment.demographics.Q26;

  const variation = seededChoice(rng, VARIATION_SEEDS);

  return {
    name,
    demographics: demo,
    psychographic: segment.psychographic,
    variation,
    segment_id: segment.id,
    segment_name: segment.name,
  };
}

// ---------------------------------------------------------------------------
// Prompt Construction
// ---------------------------------------------------------------------------

function buildSystemPrompt(config: RespondentConfig): string {
  const d = config.demographics;
  return `You are role-playing as a synthetic survey respondent named ${config.name}.

PERSONA:
- Segment: ${config.segment_name}
- Age: ${d.Q21}
- Household income: ${d.Q22}
- Work arrangement: ${d.Q23}
- HOA status: ${d.Q24}
- Outdoor recreation: ${d.Q25}
- Outdoor club member: ${d.Q26}

PSYCHOGRAPHIC PROFILE:
${config.psychographic}

PERSONALITY VARIATION:
${config.variation}

INSTRUCTIONS:
1. Answer every survey question from the perspective of this persona.
2. Your demographic answers (Q21-Q26) MUST match the persona demographics above exactly.
3. For Q30 (attention check), you MUST answer 3 (Moderately interested).
4. For all other questions, answer authentically as this persona would — vary your responses naturally, do not always pick the midpoint or extreme.
5. Return ONLY a single JSON object with the exact keys specified. No explanations, no markdown.`;
}

function buildUserPrompt(): string {
  return `Complete the following survey as the persona described. Return ONLY a valid JSON object.

Return a JSON object with exactly these keys and valid values:
${RESPONSE_SCHEMA}

IMPORTANT: Q20 must be a JSON array of 1-2 strings. All Likert-scale questions must be integers 1-5. Q30 must be 3. Return ONLY JSON, no other text.`;
}

// ---------------------------------------------------------------------------
// Response Validation
// ---------------------------------------------------------------------------

function validateResponse(
  data: Record<string, unknown>,
  config: RespondentConfig
): Record<string, string | number | string[]> {
  const result = { ...data } as Record<string, string | number | string[]>;

  // Clamp Likert values to 1-5
  for (const key of ALL_NUMERIC_KEYS) {
    if (key in result) {
      const val = Number(result[key]);
      result[key] = Number.isNaN(val) ? 3 : Math.max(1, Math.min(5, Math.round(val)));
    }
  }

  // Force Q30 attention check
  result.Q30 = 3;

  // Force demographics to match persona
  const d = config.demographics;
  result.Q21 = d.Q21;
  result.Q22 = d.Q22;
  result.Q23 = d.Q23;
  result.Q24 = d.Q24;
  result.Q25 = d.Q25;
  result.Q26 = d.Q26;

  // Ensure Q20 is an array
  if (typeof result.Q20 === "string") {
    result.Q20 = [result.Q20];
  } else if (!Array.isArray(result.Q20)) {
    result.Q20 = ["Social media ads (Facebook, Instagram)"];
  }

  return result;
}

// ---------------------------------------------------------------------------
// Single Respondent Generation
// ---------------------------------------------------------------------------

interface GeneratedResponse {
  respondentId: string;
  model: string;
  segmentId: number;
  segmentName: string;
  responses: Record<string, string | number | string[]>;
}

async function generateOne(
  apiKey: string,
  modelId: string,
  modelLabel: string,
  segment: Segment,
  respondentIndex: number,
  userPrompt: string
): Promise<GeneratedResponse> {
  const config = getRespondentConfig(segment, respondentIndex, modelId);
  const systemPrompt = buildSystemPrompt(config);

  const raw = await callOpenRouter(apiKey, modelId, systemPrompt, userPrompt);
  const parsed = parseJsonResponse(raw);
  const validated = validateResponse(parsed, config);

  return {
    respondentId: `S${segment.id}_${modelLabel}_${respondentIndex + 1}`,
    model: modelLabel,
    segmentId: segment.id,
    segmentName: segment.name,
    responses: validated,
  };
}

// ---------------------------------------------------------------------------
// Main Stage Function
// ---------------------------------------------------------------------------

export async function runStage4(
  supabase: SupabaseClient,
  runId: string,
  apiKey: string
): Promise<Stage4Result> {
  const userPrompt = buildUserPrompt();

  // Build task list: model × segment × respondent_index
  interface TaskDef {
    modelId: string;
    modelLabel: string;
    segment: Segment;
    respondentIndex: number;
  }

  const taskDefs: TaskDef[] = [];
  for (const modelId of MODEL_IDS) {
    const modelLabel = MODEL_LABELS[modelId];
    for (const segment of SEGMENTS) {
      for (let i = 0; i < RESPONDENTS_PER_SEGMENT_PER_MODEL; i++) {
        taskDefs.push({ modelId, modelLabel, segment, respondentIndex: i });
      }
    }
  }

  const totalTasks = taskDefs.length; // 90
  let completed = 0;

  await updateProgress(supabase, runId, 0, `Generating ${totalTasks} synthetic respondents...`);

  // Build concurrent task closures
  const tasks = taskDefs.map(
    (def) => async () => {
      const result = await generateOne(
        apiKey,
        def.modelId,
        def.modelLabel,
        def.segment,
        def.respondentIndex,
        userPrompt
      );
      completed++;
      const pct = Math.round((completed / totalTasks) * 100);
      await updateProgress(
        supabase,
        runId,
        pct,
        `Generated ${completed}/${totalTasks} respondents`
      );
      return result;
    }
  );

  const settled = await runWithConcurrency(tasks, MAX_CONCURRENT_API_CALLS);

  // Collect successful results
  const results: GeneratedResponse[] = [];
  const errors: string[] = [];

  for (const r of settled) {
    if (r.status === "fulfilled") {
      results.push(r.value);
    } else {
      errors.push(
        r.reason instanceof Error ? r.reason.message : String(r.reason)
      );
    }
  }

  if (results.length === 0) {
    throw new Error(
      `All ${totalTasks} respondent generations failed. First error: ${errors[0]}`
    );
  }

  // Save to Supabase in batches of 20
  const rows = results.map((r) => ({
    run_id: runId,
    respondent_id: r.respondentId,
    model: r.model,
    segment_id: r.segmentId,
    segment_name: r.segmentName,
    responses: r.responses,
  }));

  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20);
    const { error } = await supabase.from("survey_responses").insert(batch);
    if (error) {
      throw new Error(`Failed to save survey responses (batch ${i}): ${error.message}`);
    }
  }

  await updateProgress(
    supabase,
    runId,
    100,
    `Saved ${results.length}/${totalTasks} survey responses${errors.length > 0 ? ` (${errors.length} failed)` : ""}`,
    "completed"
  );

  return {
    stage: 4,
    responses: results.map((r) => ({
      run_id: runId,
      respondent_id: r.respondentId,
      model: r.model,
      segment_id: r.segmentId,
      segment_name: r.segmentName,
      responses: r.responses,
    })),
    respondentCount: results.length,
  };
}
