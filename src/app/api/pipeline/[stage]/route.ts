import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Allow up to 300s (5min) for long-running stages (2 and 4 generate many LLM calls)
export const maxDuration = 600;

interface StageResultWithCost {
  totalTokens?: number;
  totalCost?: number;
  [key: string]: unknown;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ stage: string }> }
) {
  const { stage } = await params;
  const stageNum = parseInt(stage, 10);
  if (isNaN(stageNum) || stageNum < 1 || stageNum > 6) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const body = await req.json();
  const { runId, openrouterKey: clientKey } = body;
  const openrouterKey = clientKey || process.env.OPENROUTER_API_KEY || "";

  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Mark stage as running
  await supabase
    .from("stage_progress")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      progress_pct: 0,
    })
    .eq("run_id", runId)
    .eq("stage", stageNum);

  // Ensure pipeline run status is "running" (important for retries after error)
  await supabase
    .from("pipeline_runs")
    .update({ status: "running" })
    .eq("id", runId);

  // ── Fix 8: Clean previous data on stage retry ──────────────────────────
  const STAGE_TABLES: Record<number, string[]> = {
    1: ["discovery_responses", "discovery_briefs"],
    2: ["interview_transcripts", "interview_analysis", "interview_themes"],
    3: ["survey_designs", "survey_coverage"],
    4: ["survey_responses"],
    5: [], // analysis_results handled specially below
    6: ["respondent_scores", "validation_reports"],
  };
  const tablesToClean = STAGE_TABLES[stageNum] || [];
  for (const table of tablesToClean) {
    await supabase.from(table).delete().eq("run_id", runId);
  }
  if (stageNum === 5) {
    const stage5Types = [
      "descriptive_likert", "model_comparison_likert", "kruskal_wallis",
      "barrier_heatmap", "segment_profiles", "descriptive_categorical",
      "inter_llm_reliability", "benchmark_comparison", "stamp_interpretation_agreement", "disagreement_analysis",
    ];
    await supabase.from("analysis_results").delete().eq("run_id", runId).in("analysis_type", stage5Types);
  } else if (stageNum === 2) {
    const stage2Types = ["stamp_emotion_classification", "stamp_theme_extraction"];
    await supabase.from("analysis_results").delete().eq("run_id", runId).in("analysis_type", stage2Types);
  }
  else if (stageNum === 3) {
    const stage3Types = ["survey_coverage_validation"];
    await supabase.from("analysis_results").delete().eq("run_id", runId).in("analysis_type", stage3Types);
  }
  // ── Fix 10: Cost ceiling check ──────────────────────────────────────────
  const COST_CEILING = 15.00;
  const { data: priorStages } = await supabase
    .from("stage_progress").select("cost_estimate").eq("run_id", runId);
  const accumulatedCost = (priorStages || []).reduce(
    (sum: number, s: { cost_estimate: string | number | null }) =>
      sum + (parseFloat(String(s.cost_estimate)) || 0), 0);
  if (accumulatedCost >= COST_CEILING) {
    await supabase.from("stage_progress").update({
      status: "error",
      error_message: `Cost ceiling exceeded: $${accumulatedCost.toFixed(2)} >= $${COST_CEILING}`,
      completed_at: new Date().toISOString(),
    }).eq("run_id", runId).eq("stage", stageNum);
    return NextResponse.json(
      { error: `Cost ceiling of $${COST_CEILING} exceeded` }, { status: 429 });
  }

  try {
    // Dynamic import to avoid loading all stages upfront
    const runners: Record<
      number,
      (supabase: ReturnType<typeof createAdminClient>, runId: string, apiKey: string) => Promise<unknown>
    > = {
      1: (await import("@/lib/pipeline/stage1")).runStage1,
      2: (await import("@/lib/pipeline/stage2")).runStage2,
      3: (await import("@/lib/pipeline/stage3")).runStage3,
      4: (await import("@/lib/pipeline/stage4")).runStage4,
      5: (await import("@/lib/pipeline/stage5")).runStage5,
      6: (await import("@/lib/pipeline/stage6")).runStage6,
    };

    const result = (await runners[stageNum](supabase, runId, openrouterKey)) as StageResultWithCost;

    // Extract cost data if returned by the stage
    const tokens = result?.totalTokens ?? 0;
    const cost = result?.totalCost ?? 0;

    // Mark stage as completed with cost data
    await supabase
      .from("stage_progress")
      .update({
        status: "completed",
        progress_pct: 100,
        completed_at: new Date().toISOString(),
        message: "Stage completed successfully",
        ...(tokens > 0 ? { tokens_used: tokens } : {}),
        ...(cost > 0 ? { cost_estimate: cost } : {}),
      })
      .eq("run_id", runId)
      .eq("stage", stageNum);

    // Update pipeline_runs current_stage
    await supabase
      .from("pipeline_runs")
      .update({ current_stage: stageNum })
      .eq("id", runId);

    // If stage 6, mark pipeline as completed and aggregate total cost
    if (stageNum === 6) {
      // Sum all stage costs for this run
      const { data: allStages } = await supabase
        .from("stage_progress")
        .select("cost_estimate")
        .eq("run_id", runId);

      const totalCost = (allStages || []).reduce(
        (sum: number, s: { cost_estimate: string | number | null }) =>
          sum + (parseFloat(String(s.cost_estimate)) || 0),
        0
      );

      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          ...(totalCost > 0 ? { total_cost: totalCost } : {}),
        })
        .eq("id", runId);
    }

    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Mark stage as error
    await supabase
      .from("stage_progress")
      .update({
        status: "error",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("run_id", runId)
      .eq("stage", stageNum);

    // Fix 9: Update current_stage and status on error
    await supabase.from("pipeline_runs")
      .update({ current_stage: stageNum, status: "error" })
      .eq("id", runId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
