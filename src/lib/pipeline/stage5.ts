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
import { mannWhitneyU, kruskalWallisH } from "@/lib/pipeline/stats";
import {
  LIKERT_KEYS,
  BARRIER_KEYS,
  CONCEPT_APPEAL,
  CATEGORICAL_KEYS,
  ALL_NUMERIC_KEYS,
  SEGMENT_PROFILE_KEYS,
} from "@/lib/pipeline/constants";

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
  runId: string
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

  await updateProgress(
    supabase,
    runId,
    100,
    "All analysis complete",
    "completed"
  );

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
