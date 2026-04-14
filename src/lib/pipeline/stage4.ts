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
import { callOpenRouterWithUsage, parseJsonResponse, estimateCost } from "@/lib/pipeline/openrouter";

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
  return `You are a survey research analyst predicting how a specific consumer would respond to a product survey. You are modeling this person's likely behavior — not expressing your own opinions or trying to be helpful.

THE CONSUMER:
- Name: ${config.name}
- Segment: ${config.segment_name}
- Age: ${d.Q21}
- Household income: ${d.Q22}
- Work arrangement: ${d.Q23}
- HOA status: ${d.Q24}
- Outdoor recreation: ${d.Q25}
- Outdoor club member: ${d.Q26}

PSYCHOGRAPHIC PROFILE:
${config.psychographic}

PERSONALITY CONTEXT:
${config.variation}

PREDICTION METHODOLOGY:
Before generating responses, reason through these questions about the consumer:
- What are this person's competing financial priorities given their income and life stage?
- What would make this person say NO or rate something low?
- Does this person actually need this product, or are they content with their current situation?
- How would this person's personality and risk tolerance shape their purchase behavior?

Let the answers to those questions drive every rating. A prediction that defaults to agreement is a bad prediction — real consumers are selective, distracted, price-sensitive, and often uninterested.

CRITICAL: Do NOT default to 3 (neutral/moderate) as a safe choice. Real consumers have opinions — they either want something or they don't. A response pattern with many 3s is unrealistic. Most responses should be 1-2 (disinterested/negative) or 4-5 (interested/positive), not clustered at the midpoint. Midpoint responses (3) should be the EXCEPTION, not the default.

CALIBRATION PRINCIPLES (based on consumer behavior for major discretionary purchases):
- $23,000 is a major purchase that competes with kitchen renovations, used cars, and emergency funds. Most homeowners are NOT actively interested at this price point.
- Purchase likelihood within 24 months is even lower than general interest — converting interest to action is a high bar for a non-essential product.
- Cost overwhelmingly dominates as the #1 barrier for premium backyard structures. It is the default concern unless a consumer has a specific competing issue.
- Primary use case: Most homeowners think practically first — storage, workshop, overflow from cluttered garages — before aspirational uses like home office or wellness. LLMs tend to over-predict "home office" because of training data saturation with remote work content.
- Many consumers are unmotivated by ANY product framing at this price point. An uninterested consumer should reject all concepts rather than picking one to be agreeable.
- Use the full 1-5 scale. A realistic respondent has some strong opinions (1 or 5) and some moderate ones (2 or 4), but rarely rates everything at the midpoint.

STAMP CODEBOOK — QUESTION-SPECIFIC GUIDANCE:

Q1 (Purchase Interest at $23K):
- DEFINITION: How interested would this consumer be in purchasing a $23K prefabricated backyard structure?
- BOUNDARY: A consumer earning <$100K who has no pressing space need should rate 1-2. A consumer earning $150K+ with a clear use case might rate 3-4. Only someone with urgent need, high income, AND enthusiasm rates 5.
- EXCLUSION: Do NOT assume interest just because the consumer has a backyard. Most homeowners have many competing priorities.
- ANCHOR: Very few real consumers would rate 5 for a $23K discretionary purchase. The majority lean skeptical.

Q3 (Primary Use Case):
- DEFINITION: If this consumer could add a ~120 sq ft private backyard space, what would they MOST LIKELY use it for?
- BOUNDARY: Storage and practical uses (tools, seasonal items, gear overflow) are the most common real-world need for backyard structures. Home office is secondary — only choose this if the consumer works from home and explicitly lacks workspace.
- EXCLUSION: Do NOT default to "home office" because it sounds modern or aspirational. Real homeowners think about cluttered garages and full closets before they think about Instagram-worthy offices.

Q6 (Greatest Single Barrier):
- DEFINITION: What is the SINGLE biggest factor that would prevent this consumer from purchasing?
- BOUNDARY: Cost is overwhelmingly the dominant barrier for any $23K discretionary purchase. Even high-income consumers cite cost because they compare it to other home investments (kitchens, bathrooms, landscaping).
- EXCLUSION: Only choose a non-cost barrier if this consumer has a SPECIFIC reason: active HOA conflict, genuinely tiny yard (<200 sqft), or existing structure that makes a new one redundant.

Q14 (Most Motivating Concept):
- DEFINITION: Which ONE concept framing would most motivate this consumer to learn more?
- BOUNDARY: "None of the above" is a valid and common choice — many consumers are genuinely uninterested at $23K regardless of framing. This especially applies to consumers who rated Q1 as 1-2.
- EXCLUSION: Do NOT always pick a concept just to be helpful. A consumer who rated purchase interest 1-2 should often choose "None of the above."

RESPONSE RULES:
1. Every rating must be justified by the consumer's profile. Enthusiasm and skepticism are both valid — the profile determines which.
2. For Q6 (greatest barrier): Cost is the default barrier for a $23K purchase. Only choose a non-cost barrier if this consumer has a specific competing concern.
3. For Q14 (best concept): If Q1 was 1-2, strongly consider "None of the above." Only choose a concept if this consumer has a clear lifestyle match.
4. $23,000 is a significant purchase. Most consumers compare it to kitchen renovations, used cars, emergency funds, or paying down debt.
5. Demographic answers (Q21-Q26) MUST match the consumer profile above exactly.
6. Q30 (attention check) MUST be 3.
7. Return ONLY a single JSON object with the exact keys specified. No explanations, no markdown.`;
}

function buildUserPrompt(): string {
  return `Based on the consumer profile above, predict how this person would complete the following survey.

First, consider: What is this person's overall disposition toward this product? Are they a likely buyer, a maybe, or someone who would pass? Let that judgment inform every response.

Return a JSON object with exactly these keys and valid values:
${RESPONSE_SCHEMA}

RESPONSE GUIDANCE:
- For Q3 (use case): Think about this consumer's PRACTICAL needs first. Most homeowners need extra storage (cluttered garages, seasonal items, tools) before they need an office or wellness space. Only choose "home office" if this person works remotely and genuinely lacks workspace. Choose "general storage / premium speed shed" if this person has any accumulation of tools, outdoor gear, hobby supplies, or general overflow.
- For Q6 (greatest barrier): Cost is the dominant barrier for any $23K discretionary purchase. Unless this person has a SPECIFIC competing barrier (active HOA issue, genuinely tiny yard), default to cost.
- For Q14 (best concept): If this consumer rated Q1 (purchase interest) at 1 or 2, they should strongly lean toward "None of the above" — an uninterested consumer isn't motivated by reframing. Choose a specific concept only if this person has a clear lifestyle match AND rated Q1 at 3+.
- For Q1/Q2: Most consumers are skeptical of a $23K discretionary purchase. Only consumers with high income, clear need, AND enthusiasm should rate 4-5.

DISTRIBUTION CHECK: Before finalizing, verify your responses use the full 1-5 scale. A realistic respondent should have:
- At least 2-3 responses at 1 or 2 (things they don't care about)
- At least 2-3 responses at 4 or 5 (things that matter to them)
- No more than ~30% of Likert responses at exactly 3
If your draft has more than 30% of Likert values at 3, redistribute some to stronger opinions that fit this consumer's profile.

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

  // Seeded RNG for fallback values — avoids always defaulting to midpoint 3
  const fallbackRng = seededRng(
    hashSeed(config.segment_id, 999, config.segment_name)
  );

  // Clamp Likert values to 1-5
  // NaN fallback: use segment-seeded random from polarized distribution
  // (weighted toward 1-2 and 4-5, away from 3) instead of always defaulting to 3
  for (const key of ALL_NUMERIC_KEYS) {
    if (key in result) {
      const val = Number(result[key]);
      if (Number.isNaN(val)) {
        // Polarized fallback: 70% chance of 1-2 or 4-5, only 30% chance of 3
        const r = fallbackRng();
        if (r < 0.30) result[key] = 1;
        else if (r < 0.50) result[key] = 2;
        else if (r < 0.65) result[key] = 4;
        else if (r < 0.80) result[key] = 5;
        else result[key] = 3;
      } else {
        result[key] = Math.max(1, Math.min(5, Math.round(val)));
      }
    }
  }

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
  tokens: number;
  cost: number;
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

  const result = await callOpenRouterWithUsage(apiKey, modelId, systemPrompt, userPrompt);
  const parsed = parseJsonResponse(result.content);
  const validated = validateResponse(parsed, config);

  return {
    respondentId: `S${segment.id}_${modelLabel}_${respondentIndex + 1}`,
    model: modelLabel,
    segmentId: segment.id,
    segmentName: segment.name,
    responses: validated,
    tokens: result.usage.total_tokens,
    cost: estimateCost(modelId, result.usage),
  };
}

// ---------------------------------------------------------------------------
// Main Stage Function
// ---------------------------------------------------------------------------

export async function runStage4(
  supabase: SupabaseClient,
  runId: string,
  apiKey: string
): Promise<Stage4Result & { totalTokens: number; totalCost: number }> {
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
  const errors: Array<{ respondent: string; error: string }> = [];
  let totalTokens = 0;
  let totalCost = 0;

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      results.push(r.value);
      totalTokens += r.value.tokens;
      totalCost += r.value.cost;
    } else {
      const def = taskDefs[i];
      const respondentId = `S${def.segment.id}_${def.modelLabel}_${def.respondentIndex + 1}`;
      const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error(`Respondent ${respondentId} failed:`, errMsg);
      errors.push({ respondent: respondentId, error: errMsg });
    }
  }

  const minRequired = Math.ceil(totalTasks * 0.75);
  if (results.length < minRequired) {
    const failedIds = errors.map(e => e.respondent).join(', ');
    throw new Error(
      `Only ${results.length}/${totalTasks} respondents generated (need ${minRequired}). Failed: ${failedIds}. First error: ${errors[0]?.error}`
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

  const failNote = errors.length > 0
    ? ` (${errors.length} failed: ${errors.map(e => e.respondent).join(', ')})`
    : "";
  await updateProgress(
    supabase,
    runId,
    100,
    `Saved ${results.length}/${totalTasks} survey responses${failNote}`,
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
    totalTokens,
    totalCost,
  };
}
