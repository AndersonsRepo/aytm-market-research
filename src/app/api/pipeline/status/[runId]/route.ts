import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const supabase = createAdminClient();

  const [runResult, stagesResult] = await Promise.all([
    supabase.from("pipeline_runs").select("*").eq("id", runId).single(),
    supabase
      .from("stage_progress")
      .select("stage, status, progress_pct, message, error_message, started_at, completed_at, tokens_used, cost_estimate")
      .eq("run_id", runId)
      .order("stage"),
  ]);

  if (runResult.error) {
    return NextResponse.json(
      { error: runResult.error.message },
      { status: 404 }
    );
  }

  return NextResponse.json({
    run: runResult.data,
    stages: stagesResult.data || [],
  });
}
