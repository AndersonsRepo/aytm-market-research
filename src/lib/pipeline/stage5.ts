/**
 * Stage 5: Data Analysis
 *
 * Runs statistical analysis on survey responses from Stage 4.
 * Pure computation — no API calls needed.
 *
 * Analysis types:
 * 1. Descriptive statistics by segment (Likert variables)
 * 2. Descriptive statistics by model
 * 3. Model comparison: pairwise Mann-Whitney U + Kruskal-Wallis H
 * 4. Barrier heatmap (segment × barrier mean matrix)
 * 5. Segment profiles (key variable means per segment)
 * 6. Categorical distributions by segment
 *
 * Ported from analytics.py
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { Stage5Result, AnalysisType } from "@/lib/pipeline/types";
import { mannWhitneyU, kruskalWallisH, krippendorffAlpha } from "@/lib/pipeline/stats";
import {
  BENCHMARK_PURCHASE_INTEREST,
  BENCHMARK_PURCHASE_LIKELIHOOD,
  BENCHMARK_USE_CASE,
  BENCHMARK_GREATEST_BARRIER,
  BENCHMARK_BEST_CONCEPT,
} from "@/lib/pipeline/benchmark";
import {
  LIKERT_KEYS,
  BARRIER_KEYS,
  CONCEPT_APPEAL,
  CATEGORICAL_KEYS,
  ALL_NUMERIC_KEYS,
  SEGMENT_PROFILE_KEYS,
  MODEL_IDS,
  MODEL_LABELS,
} from "@/lib/pipeline/constants";
import { callOpenRouterWithUsage, parseJsonResponse, estimateCost } from "@/lib/pipeline/openrouter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All numeric keys excluding attention check Q30 */
const NUMERIC_KEYS = ALL_NUMERIC_KEYS.filter((k) => k !== "Q30");

/** Get display label for a variable key */
function getLabel(key: string): string {
  return LIKERT_KEYS[key] ?? BARRIER_KEYS[key] ?? CONCEPT_APPEAL[key] ?? key;
}

/** Safely extract a numeric value from a response record */
function getNumeric(
  responses: Record<string, unknown>,
  key: string
): number | null {
  const val = responses[key];
  if (val == null) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

/** Compute mean, SD, median, IQR */
function descriptiveStats(values: number[]): {
  n: number;
  mean: number;
  sd: number;
  median: number;
  iqr: number;
} {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0, median: 0, iqr: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;

  // Sample SD (ddof=1, matching pandas .std())
  const variance =
    n > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);

  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  return { n, mean: round3(mean), sd: round3(sd), median, iqr };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/** Group items by a key function */
function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    (groups[key] ??= []).push(item);
  }
  return groups;
}

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
      { run_id: runId, stage: 5, ...update },
      { onConflict: "run_id,stage" }
    );
}

async function saveAnalysis(
  supabase: SupabaseClient,
  runId: string,
  analysisType: AnalysisType,
  results: Record<string, unknown>,
  groupByField?: string
) {
  const { error } = await supabase.from("analysis_results").insert({
    run_id: runId,
    analysis_type: analysisType,
    group_by: groupByField ?? null,
    results,
  });
  if (error) {
    throw new Error(`Failed to save ${analysisType}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

interface ResponseRow {
  respondent_id: string;
  model: string;
  segment_id: number;
  segment_name: string;
  responses: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Main Stage Function
// ---------------------------------------------------------------------------

export async function runStage5(
  supabase: SupabaseClient,
  runId: string,
  apiKey: string,
): Promise<Stage5Result> {
  // Fetch all survey responses for this run
  const { data: rows, error: fetchError } = await supabase
    .from("survey_responses")
    .select("*")
    .eq("run_id", runId);

  if (fetchError) {
    throw new Error(`Failed to fetch survey responses: ${fetchError.message}`);
  }
  if (!rows || rows.length === 0) {
    throw new Error("No survey responses found for this run");
  }

  const responses = rows as ResponseRow[];

  await updateProgress(
    supabase,
    runId,
    0,
    `Analyzing ${responses.length} survey responses...`
  );

  // ── 1. Descriptive statistics by segment ──────────────────────────────

  const bySegment = groupBy(responses, (r) => r.segment_name);
  const segmentDescriptives: Record<string, Record<string, unknown>[]> = {};

  for (const [segName, segRows] of Object.entries(bySegment)) {
    const varStats: Record<string, unknown>[] = [];
    for (const key of NUMERIC_KEYS) {
      const values = segRows
        .map((r) => getNumeric(r.responses, key))
        .filter((v): v is number => v !== null);
      if (values.length === 0) continue;
      varStats.push({
        variable: key,
        label: getLabel(key),
        ...descriptiveStats(values),
      });
    }
    segmentDescriptives[segName] = varStats;
  }

  await saveAnalysis(
    supabase,
    runId,
    "descriptive_likert",
    { by: "segment", data: segmentDescriptives },
    "segment"
  );

  // ── 2. Descriptive statistics by model ────────────────────────────────

  const byModel = groupBy(responses, (r) => r.model);
  const modelDescriptives: Record<string, Record<string, unknown>[]> = {};

  for (const [modelName, modelRows] of Object.entries(byModel)) {
    const varStats: Record<string, unknown>[] = [];
    for (const key of NUMERIC_KEYS) {
      const values = modelRows
        .map((r) => getNumeric(r.responses, key))
        .filter((v): v is number => v !== null);
      if (values.length === 0) continue;
      varStats.push({
        variable: key,
        label: getLabel(key),
        ...descriptiveStats(values),
      });
    }
    modelDescriptives[modelName] = varStats;
  }

  await saveAnalysis(
    supabase,
    runId,
    "descriptive_likert",
    { by: "model", data: modelDescriptives },
    "model"
  );

  await updateProgress(
    supabase,
    runId,
    20,
    "Descriptive statistics complete"
  );

  // ── 3. Model comparison ───────────────────────────────────────────────

  const modelNames = Object.keys(byModel).sort();

  // 3a. Pairwise Mann-Whitney U
  const pairwiseResults: Record<string, unknown>[] = [];

  for (let i = 0; i < modelNames.length; i++) {
    for (let j = i + 1; j < modelNames.length; j++) {
      const m1 = modelNames[i];
      const m2 = modelNames[j];

      for (const key of NUMERIC_KEYS) {
        const g1 = byModel[m1]
          .map((r) => getNumeric(r.responses, key))
          .filter((v): v is number => v !== null);
        const g2 = byModel[m2]
          .map((r) => getNumeric(r.responses, key))
          .filter((v): v is number => v !== null);
        if (g1.length === 0 || g2.length === 0) continue;

        const { U, p, effectSize } = mannWhitneyU(g1, g2);
        const mean1 = g1.reduce((s, v) => s + v, 0) / g1.length;
        const mean2 = g2.reduce((s, v) => s + v, 0) / g2.length;

        pairwiseResults.push({
          comparison: `${m1} vs ${m2}`,
          variable: key,
          label: getLabel(key),
          mean_1: round3(mean1),
          mean_2: round3(mean2),
          U: Math.round(U * 10) / 10,
          p: round4(p),
          effect_size: round3(effectSize),
          significant: p < 0.05,
        });
      }
    }
  }

  await saveAnalysis(supabase, runId, "model_comparison_likert", {
    pairwise: pairwiseResults,
  });

  // 3b. Kruskal-Wallis H test (3+ models)
  if (modelNames.length >= 3) {
    const kwResults: Record<string, unknown>[] = [];

    for (const key of NUMERIC_KEYS) {
      const groups = modelNames.map((m) =>
        byModel[m]
          .map((r) => getNumeric(r.responses, key))
          .filter((v): v is number => v !== null)
      );
      if (groups.some((g) => g.length === 0)) continue;

      const { H, p, epsilonSq } = kruskalWallisH(groups);

      const means: Record<string, number> = {};
      for (let mi = 0; mi < modelNames.length; mi++) {
        means[modelNames[mi]] = round3(
          groups[mi].reduce((s, v) => s + v, 0) / groups[mi].length
        );
      }

      kwResults.push({
        variable: key,
        label: getLabel(key),
        means,
        H: round3(H),
        p: round4(p),
        epsilon_sq: round4(epsilonSq),
        significant: p < 0.05,
      });
    }

    await saveAnalysis(supabase, runId, "kruskal_wallis", {
      results: kwResults,
    });
  }

  await updateProgress(supabase, runId, 50, "Model comparison complete");

  // ── 4. Barrier heatmap ────────────────────────────────────────────────

  const barrierKeys = Object.keys(BARRIER_KEYS);
  const heatmapData: Record<string, Record<string, number>> = {};

  for (const [segName, segRows] of Object.entries(bySegment)) {
    const barrierMeans: Record<string, number> = {};
    for (const bk of barrierKeys) {
      const values = segRows
        .map((r) => getNumeric(r.responses, bk))
        .filter((v): v is number => v !== null);
      barrierMeans[BARRIER_KEYS[bk]] =
        values.length > 0
          ? Math.round(
              (values.reduce((s, v) => s + v, 0) / values.length) * 100
            ) / 100
          : 0;
    }
    heatmapData[segName] = barrierMeans;
  }

  await saveAnalysis(supabase, runId, "barrier_heatmap", {
    matrix: heatmapData,
  });

  // ── 5. Segment profiles ───────────────────────────────────────────────

  const profileData: Record<string, Record<string, number>> = {};

  for (const [segName, segRows] of Object.entries(bySegment)) {
    const profile: Record<string, number> = {};
    for (const key of SEGMENT_PROFILE_KEYS) {
      const values = segRows
        .map((r) => getNumeric(r.responses, key))
        .filter((v): v is number => v !== null);
      const label = getLabel(key);
      profile[label] =
        values.length > 0
          ? round3(values.reduce((s, v) => s + v, 0) / values.length)
          : 0;
    }
    profileData[segName] = profile;
  }

  await saveAnalysis(supabase, runId, "segment_profiles", {
    profiles: profileData,
  });

  await updateProgress(
    supabase,
    runId,
    70,
    "Heatmap and segment profiles complete"
  );

  // ── 6. Categorical distributions ──────────────────────────────────────

  const categoricalData: Record<
    string,
    Record<string, Record<string, { count: number; pct: number }>>
  > = {};

  for (const catKey of CATEGORICAL_KEYS) {
    const bySegCat: Record<
      string,
      Record<string, { count: number; pct: number }>
    > = {};

    for (const [segName, segRows] of Object.entries(bySegment)) {
      const valueCounts: Record<string, number> = {};
      let total = 0;

      for (const row of segRows) {
        let val: unknown = row.responses[catKey];

        // Q20_1 / Q20_2: extract from Q20 array
        if (catKey === "Q20_1") {
          const q20 = row.responses.Q20;
          val = Array.isArray(q20) && q20.length > 0 ? q20[0] : null;
        } else if (catKey === "Q20_2") {
          const q20 = row.responses.Q20;
          val = Array.isArray(q20) && q20.length > 1 ? q20[1] : null;
        }

        if (val == null || val === "") continue;
        const strVal = String(val);
        valueCounts[strVal] = (valueCounts[strVal] ?? 0) + 1;
        total++;
      }

      const dist: Record<string, { count: number; pct: number }> = {};
      for (const [v, c] of Object.entries(valueCounts)) {
        dist[v] = {
          count: c,
          pct: total > 0 ? Math.round((c / total) * 1000) / 10 : 0,
        };
      }
      bySegCat[segName] = dist;
    }

    categoricalData[catKey] = bySegCat;
  }

  await saveAnalysis(
    supabase,
    runId,
    "descriptive_categorical",
    { by: "segment", data: categoricalData },
    "segment"
  );

  await updateProgress(supabase, runId, 72, "Categorical distributions complete");

  // ── 7. Inter-LLM reliability (STAMP: Krippendorff's alpha) ──────────

  await updateProgress(supabase, runId, 75, "Computing inter-LLM reliability (STAMP)...");

  const reliabilityResults: Record<string, unknown>[] = [];
  const modelList = Object.keys(byModel).sort();

  for (const key of NUMERIC_KEYS) {
    // Build ratings matrix: one row per model, one column per item
    // Items are ordered by segment_id + respondent index within segment
    // Each model rates the same "slot" (segment×index)
    const itemMap = new Map<string, Map<string, number>>();

    for (const [model, modelRows] of Object.entries(byModel)) {
      for (const row of modelRows) {
        // Create a canonical item key from segment + respondent index
        const itemKey = `${row.segment_id}_${row.respondent_id.split('_').pop()}`;
        if (!itemMap.has(itemKey)) itemMap.set(itemKey, new Map());
        const val = getNumeric(row.responses, key);
        if (val !== null) itemMap.get(itemKey)!.set(model, val);
      }
    }

    // Build the ratings matrix
    const items = Array.from(itemMap.keys()).sort();
    const ratings: (number | null)[][] = modelList.map(model =>
      items.map(item => itemMap.get(item)?.get(model) ?? null)
    );

    const { alpha } = krippendorffAlpha(ratings);

    reliabilityResults.push({
      variable: key,
      label: getLabel(key),
      alpha: Math.round(alpha * 10000) / 10000,
      passes_threshold: alpha >= 0.667,
      interpretation: alpha >= 0.8 ? 'excellent' : alpha >= 0.667 ? 'acceptable' : alpha >= 0.4 ? 'moderate' : 'poor',
      models: modelList,
    });
  }

  // Overall alpha (average across variables)
  const alphaValues = reliabilityResults.map(r => r.alpha as number).filter(a => !isNaN(a));
  const overallAlpha = alphaValues.length > 0
    ? Math.round((alphaValues.reduce((s, v) => s + v, 0) / alphaValues.length) * 10000) / 10000
    : 0;

  await saveAnalysis(supabase, runId, "inter_llm_reliability", {
    variables: reliabilityResults,
    overall_alpha: overallAlpha,
    overall_interpretation: overallAlpha >= 0.8 ? 'excellent' : overallAlpha >= 0.667 ? 'acceptable' : overallAlpha >= 0.4 ? 'moderate' : 'poor',
    passes_stamp_threshold: overallAlpha >= 0.667,
    methodology: 'STAMP (Structured Taxonomy AI Measurement Protocol)',
    models: modelList,
  });

  // ── 8. Benchmark comparison (synthetic vs real) ─────────────────────

  await updateProgress(supabase, runId, 85, "Comparing synthetic results to real benchmark...");

  // Helper: compute distribution from responses for a given key
  function computeDistribution(key: string, allRows: ResponseRow[]): Record<string, { count: number; pct: number }> {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of allRows) {
      const val = row.responses[key];
      if (val == null || val === '') continue;
      const strVal = String(val);
      counts[strVal] = (counts[strVal] ?? 0) + 1;
      total++;
    }
    const dist: Record<string, { count: number; pct: number }> = {};
    for (const [v, c] of Object.entries(counts)) {
      dist[v] = { count: c, pct: total > 0 ? Math.round((c / total) * 1000) / 10 : 0 };
    }
    return dist;
  }

  const benchmarkComparisons: Record<string, unknown>[] = [];

  // 1. Purchase Interest (Q1)
  const syntheticQ1 = computeDistribution('Q1', responses);
  const q1Delta: Record<string, number> = {};
  for (const k of ['1', '2', '3', '4', '5']) {
    const synPct = syntheticQ1[k]?.pct ?? 0;
    const realPct = BENCHMARK_PURCHASE_INTEREST.distribution[Number(k) as 1|2|3|4|5]?.pct ?? 0;
    q1Delta[k] = Math.round((synPct - realPct) * 10) / 10;
  }
  benchmarkComparisons.push({
    question: BENCHMARK_PURCHASE_INTEREST.question,
    ourQ: 'Q1',
    synthetic: syntheticQ1,
    real: BENCHMARK_PURCHASE_INTEREST.distribution,
    delta: q1Delta,
    syntheticN: responses.length,
    realN: BENCHMARK_PURCHASE_INTEREST.n,
  });

  // 2. Purchase Likelihood (Q2)
  const syntheticQ2 = computeDistribution('Q2', responses);
  const q2Delta: Record<string, number> = {};
  for (const k of ['1', '2', '3', '4', '5']) {
    const synPct = syntheticQ2[k]?.pct ?? 0;
    const realPct = BENCHMARK_PURCHASE_LIKELIHOOD.distribution[Number(k) as 1|2|3|4|5]?.pct ?? 0;
    q2Delta[k] = Math.round((synPct - realPct) * 10) / 10;
  }
  benchmarkComparisons.push({
    question: BENCHMARK_PURCHASE_LIKELIHOOD.question,
    ourQ: 'Q2',
    synthetic: syntheticQ2,
    real: BENCHMARK_PURCHASE_LIKELIHOOD.distribution,
    delta: q2Delta,
    syntheticN: responses.length,
    realN: BENCHMARK_PURCHASE_LIKELIHOOD.n,
  });

  // 3. Primary Use Case (Q3)
  const syntheticQ3 = computeDistribution('Q3', responses);
  const q3Delta: Record<string, number> = {};
  for (const useCase of Object.keys(BENCHMARK_USE_CASE.distribution)) {
    const synPct = syntheticQ3[useCase]?.pct ?? 0;
    const realPct = (BENCHMARK_USE_CASE.distribution as Record<string, { pct: number }>)[useCase]?.pct ?? 0;
    q3Delta[useCase] = Math.round((synPct - realPct) * 10) / 10;
  }
  benchmarkComparisons.push({
    question: BENCHMARK_USE_CASE.question,
    ourQ: 'Q3',
    synthetic: syntheticQ3,
    real: BENCHMARK_USE_CASE.distribution,
    delta: q3Delta,
    syntheticN: responses.length,
    realN: BENCHMARK_USE_CASE.n,
  });

  // 4. Greatest Single Barrier (Q6)
  const syntheticQ6 = computeDistribution('Q6', responses);
  const q6Delta: Record<string, number> = {};
  for (const barrier of Object.keys(BENCHMARK_GREATEST_BARRIER.distribution)) {
    const synPct = syntheticQ6[barrier]?.pct ?? 0;
    const realPct = (BENCHMARK_GREATEST_BARRIER.distribution as Record<string, { pct: number }>)[barrier]?.pct ?? 0;
    q6Delta[barrier] = Math.round((synPct - realPct) * 10) / 10;
  }
  benchmarkComparisons.push({
    question: BENCHMARK_GREATEST_BARRIER.question,
    ourQ: 'Q6',
    synthetic: syntheticQ6,
    real: BENCHMARK_GREATEST_BARRIER.distribution,
    delta: q6Delta,
    syntheticN: responses.length,
    realN: BENCHMARK_GREATEST_BARRIER.n,
  });

  // 5. Most Motivating Concept (Q14)
  const syntheticQ14 = computeDistribution('Q14', responses);
  const q14Delta: Record<string, number> = {};
  for (const concept of Object.keys(BENCHMARK_BEST_CONCEPT.distribution)) {
    const synPct = syntheticQ14[concept]?.pct ?? 0;
    const realPct = (BENCHMARK_BEST_CONCEPT.distribution as Record<string, { pct: number }>)[concept]?.pct ?? 0;
    q14Delta[concept] = Math.round((synPct - realPct) * 10) / 10;
  }
  benchmarkComparisons.push({
    question: BENCHMARK_BEST_CONCEPT.question,
    ourQ: 'Q14',
    synthetic: syntheticQ14,
    real: BENCHMARK_BEST_CONCEPT.distribution,
    delta: q14Delta,
    syntheticN: responses.length,
    realN: BENCHMARK_BEST_CONCEPT.n,
  });

  await saveAnalysis(supabase, runId, "benchmark_comparison", {
    comparisons: benchmarkComparisons,
    methodology: 'Synthetic distributions compared against real aytm survey (N=600)',
  });


  // ── 8.5. STAMP Interpretation Agreement — 3 models classify the same data ──

  await updateProgress(supabase, runId, 88, "Running STAMP interpretation agreement (3-model classification)...");

  // Build a compact data summary for the LLMs to classify
  const totalResponses = responses.length;
  const segmentNames = [...new Set(responses.map(r => r.segment_name))];

  // Compute aggregate stats for the prompt
  const aggStats: Record<string, { mean: number; dist: Record<string, number> }> = {};
  for (const key of ['Q1', 'Q2', 'Q6', 'Q3', 'Q14']) {
    if (['Q6', 'Q3', 'Q14'].includes(key)) {
      // Categorical
      const counts: Record<string, number> = {};
      let total = 0;
      for (const row of responses) {
        const val = String(row.responses[key] || '');
        if (val) { counts[val] = (counts[val] ?? 0) + 1; total++; }
      }
      const dist: Record<string, number> = {};
      for (const [k, c] of Object.entries(counts)) {
        dist[k] = Math.round((c / total) * 1000) / 10;
      }
      aggStats[key] = { mean: 0, dist };
    } else {
      // Numeric
      const vals = responses.map(r => getNumeric(r.responses, key)).filter((v): v is number => v !== null);
      const m = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      const dist: Record<string, number> = {};
      for (const v of vals) {
        const sv = String(v);
        dist[sv] = (dist[sv] ?? 0) + 1;
      }
      for (const k of Object.keys(dist)) {
        dist[k] = Math.round((dist[k] / vals.length) * 1000) / 10;
      }
      aggStats[key] = { mean: Math.round(m * 100) / 100, dist };
    }
  }

  // Per-segment means for key metrics
  const segmentSummary: Record<string, Record<string, number>> = {};
  for (const seg of segmentNames) {
    const segRows = responses.filter(r => r.segment_name === seg);
    segmentSummary[seg] = {};
    for (const key of ['Q1', 'Q2']) {
      const vals = segRows.map(r => getNumeric(r.responses, key)).filter((v): v is number => v !== null);
      segmentSummary[seg][key] = vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
        : 0;
    }
  }

  const interpretationPromptSystem = `You are a market research analyst interpreting survey data about the Tahoe Mini, a $23,000 prefabricated backyard structure by Neo Smart Living. You have been given aggregate survey results from ${totalResponses} respondents across ${segmentNames.length} segments.

Your job is to classify the findings into structured categories. This is a classification task — select from the provided options only. Do not invent new categories.

Return ONLY a JSON object with these exact keys.`;

  const interpretationPromptUser = `AGGREGATE SURVEY DATA (${totalResponses} respondents, ${segmentNames.length} segments):

Q1 Purchase Interest (1-5 Likert): mean=${aggStats['Q1'].mean}, distribution=${JSON.stringify(aggStats['Q1'].dist)}
Q2 Purchase Likelihood (1-5 Likert): mean=${aggStats['Q2'].mean}, distribution=${JSON.stringify(aggStats['Q2'].dist)}
Q3 Primary Use Case: ${JSON.stringify(aggStats['Q3'].dist)}
Q6 Greatest Barrier: ${JSON.stringify(aggStats['Q6'].dist)}
Q14 Most Motivating Concept: ${JSON.stringify(aggStats['Q14'].dist)}

SEGMENT PURCHASE INTEREST MEANS:
${Object.entries(segmentSummary).map(([seg, vals]) => `- ${seg}: Q1=${vals['Q1']}, Q2=${vals['Q2']}`).join('\n')}

CLASSIFY each finding below. Choose ONLY from the listed options.

{
  "dominant_barrier": one of ["cost", "permits", "hoa", "space", "financing", "quality", "resale", "none"],
  "dominant_barrier_confidence": one of ["strong" (>50%), "moderate" (30-50%), "weak" (<30%)],
  "primary_use_case": one of ["home_office", "storage", "wellness", "guest_suite", "creative_studio", "adventure", "playroom"],
  "purchase_intent_level": one of ["very_low" (mean<2.0), "low" (2.0-2.5), "moderate" (2.5-3.5), "high" (3.5-4.0), "very_high" (>4.0)],
  "most_interested_segment": the segment name with highest purchase interest,
  "least_interested_segment": the segment name with lowest purchase interest,
  "best_concept": one of ["home_office", "wellness", "guest_suite", "adventure", "simplicity", "none"],
  "market_readiness": one of ["not_ready", "early_stage", "moderate_interest", "strong_interest"]
}

Return ONLY the JSON object.`;

  // Run on all 3 models
  const interpretationResults: Map<string, Record<string, string>> = new Map();
  let interpTokens = 0;
  let interpCost = 0;

  for (const modelId of MODEL_IDS) {
    try {
      const result = await callOpenRouterWithUsage(apiKey, modelId, interpretationPromptSystem, interpretationPromptUser, {
        temperature: 0.2,
        maxTokens: 500,
      });
      interpTokens += result.usage.total_tokens;
      interpCost += estimateCost(modelId, result.usage);
      const parsed = parseJsonResponse<Record<string, string>>(result.content);
      interpretationResults.set(modelId, parsed);
    } catch {
      // If one model fails, skip it
    }
  }

  // Compute agreement: for each classification field, do all models agree?
  const classificationFields = [
    'dominant_barrier', 'dominant_barrier_confidence', 'primary_use_case',
    'purchase_intent_level', 'most_interested_segment', 'least_interested_segment',
    'best_concept', 'market_readiness',
  ];

  const fieldAgreement: Record<string, unknown>[] = [];
  let agreementCount = 0;

  for (const field of classificationFields) {
    const values = [...interpretationResults.entries()].map(([modelId, result]) => ({
      model: MODEL_LABELS[modelId],
      value: result[field] ?? 'missing',
    }));
    const uniqueValues = new Set(values.map(v => v.value));
    const unanimous = uniqueValues.size === 1;
    if (unanimous) agreementCount++;

    fieldAgreement.push({
      field,
      values: Object.fromEntries(values.map(v => [v.model, v.value])),
      unanimous,
      unique_answers: uniqueValues.size,
    });
  }

  const agreementRate = classificationFields.length > 0
    ? Math.round((agreementCount / classificationFields.length) * 1000) / 10
    : 0;

  // Build ordinal ratings for Krippendorff's alpha on interpretation
  // Map categorical values to ordinal indices for alpha calculation
  const fieldValueMaps: Record<string, string[]> = {
    dominant_barrier: ['cost', 'permits', 'hoa', 'space', 'financing', 'quality', 'resale', 'none'],
    dominant_barrier_confidence: ['weak', 'moderate', 'strong'],
    primary_use_case: ['home_office', 'storage', 'wellness', 'guest_suite', 'creative_studio', 'adventure', 'playroom'],
    purchase_intent_level: ['very_low', 'low', 'moderate', 'high', 'very_high'],
    best_concept: ['home_office', 'wellness', 'guest_suite', 'adventure', 'simplicity', 'none'],
    market_readiness: ['not_ready', 'early_stage', 'moderate_interest', 'strong_interest'],
  };

  // For fields with ordinal mapping, compute alpha
  const modelIds = [...interpretationResults.keys()].sort();
  const alphaFields: Record<string, number> = {};

  for (const [field, valueList] of Object.entries(fieldValueMaps)) {
    const ratings: (number | null)[][] = modelIds.map(modelId => {
      const val = interpretationResults.get(modelId)?.[field] ?? '';
      const idx = valueList.indexOf(val);
      return [idx >= 0 ? idx + 1 : null];
    });
    // Alpha needs at least 2 items, but we only have 1 item per field
    // So instead, track per-field agreement as binary (unanimous vs not)
    const values = modelIds.map(m => interpretationResults.get(m)?.[field]).filter(Boolean);
    const allSame = new Set(values).size === 1;
    alphaFields[field] = allSame ? 1 : 0;
  }

  // Overall interpretation alpha: proportion of unanimous fields
  const interpAlpha = Object.values(alphaFields).length > 0
    ? Math.round((Object.values(alphaFields).reduce((s, v) => s + v, 0) / Object.values(alphaFields).length) * 10000) / 10000
    : 0;

  await saveAnalysis(supabase, runId, "stamp_interpretation_agreement", {
    methodology: 'STAMP: 3-model independent interpretation of aggregate survey data',
    models: modelIds.map(m => MODEL_LABELS[m]),
    classification_fields: fieldAgreement,
    unanimous_fields: agreementCount,
    total_fields: classificationFields.length,
    agreement_rate: agreementRate,
    interpretation_alpha: interpAlpha,
    interpretation: interpAlpha >= 0.75 ? 'strong' : interpAlpha >= 0.5 ? 'moderate' : 'weak',
    passes_stamp: interpAlpha >= 0.667,
    tokens_used: interpTokens,
    cost_estimate: Math.round(interpCost * 10000) / 10000,
  });

  // ── 9. Disagreement analysis (STAMP: where models diverge) ──────────

  await updateProgress(supabase, runId, 95, "Analyzing model disagreements...");

  const disagreements: Record<string, unknown>[] = [];

  for (const key of NUMERIC_KEYS) {
    const modelMeans: Record<string, number> = {};
    for (const [model, modelRows] of Object.entries(byModel)) {
      const values = modelRows
        .map((r) => getNumeric(r.responses, key))
        .filter((v): v is number => v !== null);
      modelMeans[model] = values.length > 0
        ? round3(values.reduce((s, v) => s + v, 0) / values.length)
        : 0;
    }

    const meanValues = Object.values(modelMeans);
    const maxDiff = meanValues.length > 1
      ? round3(Math.max(...meanValues) - Math.min(...meanValues))
      : 0;

    if (maxDiff > 0.5) { // Only flag meaningful disagreements
      const highModel = Object.entries(modelMeans).reduce((a, b) => a[1] > b[1] ? a : b);
      const lowModel = Object.entries(modelMeans).reduce((a, b) => a[1] < b[1] ? a : b);

      disagreements.push({
        variable: key,
        label: getLabel(key),
        model_means: modelMeans,
        max_difference: maxDiff,
        highest: { model: highModel[0], mean: highModel[1] },
        lowest: { model: lowModel[0], mean: lowModel[1] },
        interpretation: maxDiff > 1.0
          ? 'strong_disagreement'
          : maxDiff > 0.75
            ? 'moderate_disagreement'
            : 'mild_disagreement',
      });
    }
  }

  // Sort by magnitude of disagreement
  disagreements.sort((a, b) => (b.max_difference as number) - (a.max_difference as number));

  await saveAnalysis(supabase, runId, "disagreement_analysis", {
    disagreements,
    total_variables: NUMERIC_KEYS.length,
    variables_with_disagreement: disagreements.length,
    methodology: 'STAMP: Inter-LLM disagreement reveals construct ambiguity and hidden assumptions',
  });

  await updateProgress(supabase, runId, 100, "All analysis complete", "completed");

  // ── Return result ─────────────────────────────────────────────────────

  const { data: savedResults, error: resultError } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("run_id", runId);

  if (resultError) {
    throw new Error(
      `Failed to fetch analysis results: ${resultError.message}`
    );
  }

  return {
    stage: 5,
    results: savedResults ?? [],
  };
}
