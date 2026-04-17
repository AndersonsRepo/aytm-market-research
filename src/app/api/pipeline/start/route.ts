import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFullConfig } from "@/lib/pipeline/config";
import { enforceRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "start", 20, 3600);
  if (limited) return limited;

  const { mode } = await req.json(); // "demo" | "live"
  const supabase = createAdminClient();

  // Insert pipeline_runs row
  const { data, error } = await supabase
    .from("pipeline_runs")
    .insert({
      mode,
      status: "running",
      current_stage: 0,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const runId = data.id;

  // Snapshot active config for reproducibility
  try {
    const config = await getFullConfig(supabase);
    await supabase
      .from("pipeline_runs")
      .update({ config_snapshot: config })
      .eq("id", runId);
  } catch (e) {
    // Non-fatal: pipeline can still run with defaults if snapshot fails
    console.warn("Config snapshot failed:", e);
  }

  // Create 6 stage_progress rows (all pending)
  const stages = Array.from({ length: 6 }, (_, i) => ({
    run_id: runId,
    stage: i + 1,
    status: "pending" as const,
    progress_pct: 0,
    message: null,
  }));

  const { error: stageError } = await supabase
    .from("stage_progress")
    .insert(stages);

  if (stageError)
    return NextResponse.json({ error: stageError.message }, { status: 500 });

  return NextResponse.json({ runId });
}
