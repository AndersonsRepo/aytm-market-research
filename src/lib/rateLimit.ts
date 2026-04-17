import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function enforceRateLimit(
  req: NextRequest,
  endpoint: string,
  limit: number,
  windowSec: number
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const key = `${endpoint}:${ip}`;
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - windowSec * 1000).toISOString();

  const { count, error } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", cutoff);

  if (error) {
    console.error("rateLimit: count query failed", error);
    return null;
  }

  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded: ${limit} requests per ${Math.round(windowSec / 60)} minutes. Try again later.`,
      },
      { status: 429, headers: { "Retry-After": String(windowSec) } }
    );
  }

  await supabase.from("rate_limits").insert({ key });
  return null;
}
