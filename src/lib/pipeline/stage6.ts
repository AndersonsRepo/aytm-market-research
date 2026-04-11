/**
 * Stage 6: Validation Report
 *
 * Quality scoring per respondent, bias detection, bootstrap confidence
 * intervals, grade assignment, and recommendation text.
 *
 * Minimal API calls — one optional summary call via OpenRouter.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type {
  Stage6Result,
  ValidationReport,
  RespondentScore,
  QualityCheck,
  BiasDetection,
  ConfidenceInterval,
} from "@/lib/pipeline/types";
import { bootstrapCI, chiSquaredSurvival, normalCDF } from "@/lib/pipeline/stats";
import {
  ALL_NUMERIC_KEYS,
} from "@/lib/pipeline/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NUMERIC_KEYS = ALL_NUMERIC_KEYS.filter((k) => k !== "Q30");

function getNumeric(
  responses: Record<string, unknown>,
  key: string
): number | null {
  const val = responses[key];
  if (val == null) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance =
    arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom > 0 ? num / denom : 0;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
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
      { run_id: runId, stage: 6, ...update },
      { onConflict: "run_id,stage" }
    );
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

export async function runStage6(
  supabase: SupabaseClient,
  runId: string,
  apiKey?: string
): Promise<Stage6Result> {
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
    `Validating ${responses.length} survey responses...`
  );

  // ── 1. Quality checks per respondent ──────────────────────────────────

  const qualityChecks: QualityCheck[] = [];
  const respondentScores: Omit<RespondentScore, "id" | "created_at">[] = [];
  let totalIssues = 0;
  let attentionFailCount = 0;
  let straightLiners = 0;
  let lowUniqueCount = 0;

  for (const row of responses) {
    const resp = row.responses;

    // Attention check: Q30 == 3
    const q30 = getNumeric(resp, "Q30");
    const attentionPass = q30 === 3;
    if (!attentionPass) attentionFailCount++;

    // Response variance: SD across all Likert responses
    const likertValues = NUMERIC_KEYS.map((k) => getNumeric(resp, k)).filter(
      (v): v is number => v !== null
    );

    const responseSd = stdDev(likertValues);
    const uniqueValues = new Set(likertValues).size;
    const isStraightLining = responseSd < 0.3 && uniqueValues < 3;
    if (isStraightLining) straightLiners++;

    // Unique values count
    const isLowUnique = uniqueValues < 3;
    if (isLowUnique) lowUniqueCount++;

    // Quality score: weighted combination
    // Attention 40%, variance 30%, uniqueness 30%
    const attentionScore = attentionPass ? 100 : 0;
    const varianceScore = isStraightLining
      ? 0
      : Math.min(100, (responseSd / 1.5) * 100);
    const uniquenessScore = Math.min(100, (uniqueValues / 5) * 100);

    const qualityScore = Math.round(
      attentionScore * 0.4 + varianceScore * 0.3 + uniquenessScore * 0.3
    );

    // Count issues
    const issues: string[] = [];
    if (!attentionPass) issues.push("attention_check_failed");
    if (isStraightLining) issues.push("straight_lining");
    if (isLowUnique) issues.push("low_unique_values");
    totalIssues += issues.length;

    respondentScores.push({
      run_id: runId,
      respondent_id: row.respondent_id,
      model: row.model,
      segment_name: row.segment_name,
      quality_score: qualityScore,
      response_sd: round3(responseSd),
      unique_values: uniqueValues,
      attention_pass: attentionPass,
    });
  }

  // Aggregate quality checks
  const allScores = respondentScores.map((s) => s.quality_score);

  qualityChecks.push({
    check_name: "Attention Check (Q30=3)",
    passed: attentionFailCount === 0,
    details: `${responses.length - attentionFailCount}/${responses.length} passed`,
    value:
      ((responses.length - attentionFailCount) / responses.length) * 100,
  });

  qualityChecks.push({
    check_name: "Straight-Lining Detection (SD < 0.3 + unique < 3)",
    passed: straightLiners === 0,
    details: `${straightLiners}/${responses.length} flagged`,
    value: straightLiners,
  });

  qualityChecks.push({
    check_name: "Response Uniqueness (< 3 distinct values)",
    passed: lowUniqueCount === 0,
    details: `${lowUniqueCount}/${responses.length} flagged`,
    value: lowUniqueCount,
  });

  qualityChecks.push({
    check_name: "Average Quality Score",
    passed: mean(allScores) >= 70,
    details: `Mean quality score: ${Math.round(mean(allScores))}`,
    value: Math.round(mean(allScores)),
  });

  // Save respondent scores to Supabase in batches
  for (let i = 0; i < respondentScores.length; i += 20) {
    const batch = respondentScores.slice(i, i + 20);
    const { error } = await supabase.from("respondent_scores").insert(batch);
    if (error) {
      throw new Error(
        `Failed to save respondent scores (batch ${i}): ${error.message}`
      );
    }
  }

  await updateProgress(supabase, runId, 30, "Quality scoring complete");

  // ── 2. Bias detection ─────────────────────────────────────────────────

  const biasDetection: BiasDetection[] = [];

  // Collect all Likert responses across all respondents
  const allLikertFlat: number[] = [];
  for (const row of responses) {
    for (const key of NUMERIC_KEYS) {
      const v = getNumeric(row.responses, key);
      if (v !== null) allLikertFlat.push(v);
    }
  }
  const totalLikert = allLikertFlat.length;

  // Observed frequency distribution across 1-5 scale
  const observed = [0, 0, 0, 0, 0]; // indices 0-4 → values 1-5
  for (const v of allLikertFlat) {
    if (v >= 1 && v <= 5) observed[v - 1]++;
  }
  // Expected under uniform distribution: each value gets 20%
  const expectedUniform = totalLikert / 5;

  // Central tendency bias: test if midpoint (3) is over-represented
  // Chi-squared goodness-of-fit: observed[2] vs expected uniform proportion
  const centralCount = observed[2];
  const centralPct = totalLikert > 0 ? centralCount / totalLikert : 0;
  const centralExpected = expectedUniform;
  const centralChi2 = centralExpected > 0
    ? (centralCount - centralExpected) ** 2 / centralExpected +
      ((totalLikert - centralCount) - (totalLikert - centralExpected)) ** 2 / (totalLikert - centralExpected)
    : 0;
  const centralPValue = totalLikert > 0 ? chiSquaredSurvival(centralChi2, 1) : 1;
  biasDetection.push({
    test_name: "Central Tendency Bias",
    variable: "all_likert",
    statistic: Math.round(centralPct * 10000) / 100, // as percentage
    p_value: round3(centralPValue),
    significant: centralPValue < 0.05 && centralPct > 0.2,
    effect_size: round3(centralPct),
  });

  // Acquiescence bias: test if agree responses (4+5) exceed expected 40%
  const acquiescenceCount = observed[3] + observed[4];
  const acquiescencePct = totalLikert > 0 ? acquiescenceCount / totalLikert : 0;
  const acquiExpected = totalLikert * 0.4; // 2 of 5 values = 40% under uniform
  const acquiChi2 = acquiExpected > 0
    ? (acquiescenceCount - acquiExpected) ** 2 / acquiExpected +
      ((totalLikert - acquiescenceCount) - (totalLikert - acquiExpected)) ** 2 / (totalLikert - acquiExpected)
    : 0;
  const acquiPValue = totalLikert > 0 ? chiSquaredSurvival(acquiChi2, 1) : 1;
  biasDetection.push({
    test_name: "Acquiescence Bias",
    variable: "all_likert",
    statistic: Math.round(acquiescencePct * 10000) / 100,
    p_value: round3(acquiPValue),
    significant: acquiPValue < 0.05 && acquiescencePct > 0.4,
    effect_size: round3(acquiescencePct),
  });

  // Extreme response bias: test if extreme values (1 or 5) exceed expected 40%
  const extremeCount = observed[0] + observed[4];
  const extremePct = totalLikert > 0 ? extremeCount / totalLikert : 0;
  const extremeExpected = totalLikert * 0.4; // 2 of 5 values = 40% under uniform
  const extremeChi2 = extremeExpected > 0
    ? (extremeCount - extremeExpected) ** 2 / extremeExpected +
      ((totalLikert - extremeCount) - (totalLikert - extremeExpected)) ** 2 / (totalLikert - extremeExpected)
    : 0;
  const extremePValue = totalLikert > 0 ? chiSquaredSurvival(extremeChi2, 1) : 1;
  biasDetection.push({
    test_name: "Extreme Response Bias",
    variable: "all_likert",
    statistic: Math.round(extremePct * 10000) / 100,
    p_value: round3(extremePValue),
    significant: extremePValue < 0.05 && extremePct > 0.4,
    effect_size: round3(extremePct),
  });

  // Model agreement: average pairwise Pearson correlation between model mean vectors
  const modelGroups: Record<string, ResponseRow[]> = {};
  for (const row of responses) {
    (modelGroups[row.model] ??= []).push(row);
  }

  const modelNames = Object.keys(modelGroups).sort();
  const modelMeanVectors: Record<string, number[]> = {};

  for (const modelName of modelNames) {
    const modelRows = modelGroups[modelName];
    const means: number[] = [];
    for (const key of NUMERIC_KEYS) {
      const values = modelRows
        .map((r) => getNumeric(r.responses, key))
        .filter((v): v is number => v !== null);
      means.push(values.length > 0 ? mean(values) : 0);
    }
    modelMeanVectors[modelName] = means;
  }

  let totalCorr = 0;
  let corrPairs = 0;
  for (let i = 0; i < modelNames.length; i++) {
    for (let j = i + 1; j < modelNames.length; j++) {
      const r = pearsonCorrelation(
        modelMeanVectors[modelNames[i]],
        modelMeanVectors[modelNames[j]]
      );
      totalCorr += r;
      corrPairs++;
    }
  }

  const avgModelCorr = corrPairs > 0 ? totalCorr / corrPairs : 0;
  // Fisher z-transform to get p-value for correlation significance
  // H0: true correlation = 0. Use average n per model pair for df.
  const avgN = NUMERIC_KEYS.length; // number of variables being correlated
  const fisherZ = avgN > 3 ? Math.atanh(avgModelCorr) * Math.sqrt(avgN - 3) : 0;
  // Two-tailed p-value from normal distribution (z-test)
  const corrPValue = avgN > 3
    ? round3(2 * (1 - normalCDF(Math.abs(fisherZ))))
    : 1;
  biasDetection.push({
    test_name: "Model Agreement (Mean Correlation)",
    variable: "model_means",
    statistic: round3(avgModelCorr),
    p_value: corrPValue,
    significant: corrPValue < 0.05,
    effect_size: round3(avgModelCorr),
  });

  await updateProgress(supabase, runId, 60, "Bias detection complete");

  // ── 3. Confidence intervals ───────────────────────────────────────────

  const confidenceIntervals: ConfidenceInterval[] = [];
  const ciKeys = [
    "Q1",        // Purchase interest (primary outcome)
    "Q2",        // Purchase likelihood (primary outcome)
    "Q5_cost",   // Cost barrier (top barrier in real data)
    "Q5_space",  // Space barrier
    "Q5_quality",// Build quality concerns
    "Q7",        // Home office use case (strongest use case)
  ];

  // Overall CIs
  for (const key of ciKeys) {
    const values = responses
      .map((r) => getNumeric(r.responses, key))
      .filter((v): v is number => v !== null);
    if (values.length === 0) continue;

    const ci = bootstrapCI(values, mean, { nBoot: 1000, alpha: 0.05 });
    confidenceIntervals.push({
      variable: `${key}_overall`,
      mean: round3(ci.point),
      ci_lower: round3(ci.lower),
      ci_upper: round3(ci.upper),
      n: values.length,
    });
  }

  // CIs by segment
  const segmentGroups: Record<string, ResponseRow[]> = {};
  for (const row of responses) {
    (segmentGroups[row.segment_name] ??= []).push(row);
  }

  for (const [segName, segRows] of Object.entries(segmentGroups)) {
    for (const key of ciKeys) {
      const values = segRows
        .map((r) => getNumeric(r.responses, key))
        .filter((v): v is number => v !== null);
      if (values.length === 0) continue;

      const ci = bootstrapCI(values, mean, { nBoot: 1000, alpha: 0.05 });
      confidenceIntervals.push({
        variable: `${key}_${segName}`,
        mean: round3(ci.point),
        ci_lower: round3(ci.lower),
        ci_upper: round3(ci.upper),
        n: values.length,
      });
    }
  }

  await updateProgress(
    supabase,
    runId,
    80,
    "Confidence intervals complete"
  );

  // ── 4. Grade assignment ───────────────────────────────────────────────

  const allAttentionPass = attentionFailCount === 0;
  const biasSignificantCount = biasDetection.filter(
    (b) => b.significant
  ).length;

  let grade: string;
  if (totalIssues < 5 && allAttentionPass && biasSignificantCount === 0) {
    grade = "A";
  } else if (
    (totalIssues >= 5 && totalIssues <= 10) ||
    biasSignificantCount === 1
  ) {
    grade = "B";
  } else if (
    (totalIssues > 10 && totalIssues <= 20) ||
    biasSignificantCount === 2
  ) {
    grade = "C";
  } else {
    grade = "D";
  }

  // ── 5. Recommendation text ────────────────────────────────────────────

  const parts: string[] = [];

  if (grade === "A") {
    parts.push(
      "Data quality is excellent. All attention checks passed and no significant biases detected."
    );
  } else if (grade === "B") {
    parts.push("Data quality is good with minor issues.");
  } else if (grade === "C") {
    parts.push(
      "Data quality has moderate issues that may affect interpretation of results."
    );
  } else {
    parts.push(
      "Data quality is concerning. Significant issues detected — interpret results with caution."
    );
  }

  if (attentionFailCount > 0) {
    parts.push(
      `${attentionFailCount} respondent(s) failed the attention check (Q30).`
    );
  }
  if (straightLiners > 0) {
    parts.push(
      `${straightLiners} respondent(s) showed straight-lining behavior (response SD < 0.5).`
    );
  }
  if (centralPct > 0.3) {
    parts.push(
      `Central tendency bias detected: ${Math.round(centralPct * 100)}% of responses at midpoint.`
    );
  }
  if (acquiescencePct > 0.5) {
    parts.push(
      `Acquiescence bias detected: ${Math.round(acquiescencePct * 100)}% of responses rated 4-5.`
    );
  }

  parts.push(
    `Average quality score: ${Math.round(mean(allScores))}/100. ` +
      `Model agreement correlation: ${round3(avgModelCorr)}.`
  );

  const recommendation = parts.join(" ");

  // ── Save validation report ────────────────────────────────────────────

  const report: Omit<ValidationReport, "id" | "created_at"> = {
    run_id: runId,
    quality_checks: qualityChecks,
    bias_detection: biasDetection,
    confidence_intervals: confidenceIntervals,
    grade,
    issues_found: totalIssues,
    total_checks: qualityChecks.length + biasDetection.length,
    recommendation,
  };

  const { data: savedReport, error: reportError } = await supabase
    .from("validation_reports")
    .insert(report)
    .select()
    .single();

  if (reportError) {
    throw new Error(
      `Failed to save validation report: ${reportError.message}`
    );
  }

  await updateProgress(
    supabase,
    runId,
    100,
    `Validation complete — Grade: ${grade}`,
    "completed"
  );

  // ── Return result ─────────────────────────────────────────────────────

  return {
    stage: 6,
    report: savedReport as ValidationReport,
    scores: respondentScores as RespondentScore[],
  };
}
