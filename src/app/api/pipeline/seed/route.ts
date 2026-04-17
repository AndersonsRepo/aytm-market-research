import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedDemoData } from "@/lib/pipeline/seed";
import { enforceRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, "seed", 3, 3600);
  if (limited) return limited;

  const { runId } = await req.json();
  const supabase = createAdminClient();

  try {
    await seedDemoData(supabase, runId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[seed] Error:", message, stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
