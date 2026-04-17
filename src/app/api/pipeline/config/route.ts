import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFullConfig, getDefaultConfig } from "@/lib/pipeline/config";
import { PIPELINE_CONFIG_SECTIONS } from "@/lib/pipeline/types";
import type { PipelineConfigSection } from "@/lib/pipeline/types";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * GET /api/pipeline/config
 * Returns the full merged config (defaults + any overrides).
 * Optionally accepts ?defaults=true to return only defaults.
 */
export async function GET(req: NextRequest) {
  const showDefaults = req.nextUrl.searchParams.get("defaults") === "true";

  if (showDefaults) {
    return NextResponse.json({ config: getDefaultConfig() });
  }

  const supabase = createAdminClient();
  const config = await getFullConfig(supabase);

  // Also return which sections have overrides
  const { data: overrides } = await supabase
    .from("pipeline_config")
    .select("section, updated_at");

  const overriddenSections = (overrides || []).map((o) => o.section);

  return NextResponse.json({ config, overriddenSections });
}

/**
 * PUT /api/pipeline/config
 * Saves an override for a specific config section.
 * Body: { section: string, config: object }
 */
export async function PUT(req: NextRequest) {
  const limited = await enforceRateLimit(req, "config_put", 5, 3600);
  if (limited) return limited;

  const body = await req.json();
  const { section, config } = body;

  if (!section || !config) {
    return NextResponse.json(
      { error: "section and config are required" },
      { status: 400 },
    );
  }

  if (!PIPELINE_CONFIG_SECTIONS.includes(section as PipelineConfigSection)) {
    return NextResponse.json(
      { error: `Invalid section: ${section}. Valid: ${PIPELINE_CONFIG_SECTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("pipeline_config")
    .upsert(
      {
        section,
        config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "section" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, section });
}
