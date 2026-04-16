import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PIPELINE_CONFIG_SECTIONS } from "@/lib/pipeline/types";
import type { PipelineConfigSection } from "@/lib/pipeline/types";

/**
 * POST /api/pipeline/config/reset
 * Reset config section(s) to defaults by deleting overrides.
 * Body: { section: string } — reset one section
 *   OR  { all: true }       — reset all sections
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createAdminClient();

  if (body.all === true) {
    // Delete all overrides
    const { error } = await supabase
      .from("pipeline_config")
      .delete()
      .neq("section", "__never_match__"); // delete all rows

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reset: "all" });
  }

  const { section } = body;

  if (!section) {
    return NextResponse.json(
      { error: "section or all:true required" },
      { status: 400 },
    );
  }

  if (!PIPELINE_CONFIG_SECTIONS.includes(section as PipelineConfigSection)) {
    return NextResponse.json(
      { error: `Invalid section: ${section}` },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("pipeline_config")
    .delete()
    .eq("section", section);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reset: section });
}
