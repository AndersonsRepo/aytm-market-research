import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Run this once to add cost tracking columns.
 * GET /api/pipeline/migrate
 */
export async function GET() {
  const supabase = createAdminClient();

  const queries = [
    `ALTER TABLE stage_progress ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0`,
    `ALTER TABLE stage_progress ADD COLUMN IF NOT EXISTS cost_estimate NUMERIC(10,6) DEFAULT 0`,
    `ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10,6) DEFAULT 0`,
  ];

  const results: string[] = [];
  for (const sql of queries) {
    const { error } = await supabase.rpc("exec_sql", { sql_query: sql }).single();
    if (error) {
      results.push(`Note: ${error.message}`);
    } else {
      results.push("OK");
    }
  }

  return NextResponse.json({ results, note: "If columns don't exist, run the SQL in supabase/migrations/20260324_add_cost_tracking.sql via the Supabase SQL editor." });
}
