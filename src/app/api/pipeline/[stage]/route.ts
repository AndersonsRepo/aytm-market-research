import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { runId, openrouterKey } = body;

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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
