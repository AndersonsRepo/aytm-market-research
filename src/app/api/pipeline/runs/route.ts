import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  const [liveResult, demoResult] = await Promise.all([
    supabase
      .from("pipeline_runs")
      .select("id, mode, status, current_stage, started_at, completed_at, total_cost")
      .eq("mode", "live")
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("pipeline_runs")
      .select("id, mode, status, current_stage, started_at, completed_at, total_cost")
      .eq("mode", "demo")
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  if (liveResult.error || demoResult.error) {
    const msg = liveResult.error?.message || demoResult.error?.message || "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    liveRuns: liveResult.data || [],
    demoRuns: demoResult.data || [],
    // Backward compat: flat list for any code still using `runs`
    runs: [...(liveResult.data || []), ...(demoResult.data || [])].sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    ),
  });
}
