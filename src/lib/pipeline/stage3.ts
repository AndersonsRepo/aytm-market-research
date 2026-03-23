// ============================================================================
// Stage 3 — Survey Design
// Generates a quantitative survey instrument from interview themes using 3 LLMs,
// then analyzes cross-model coverage to identify consensus and gaps.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MODELS,
  MODEL_IDS,
  MODEL_LABELS,
  MAX_CONCURRENT_API_CALLS,
} from '@/lib/pipeline/constants';
import { callOpenRouter, parseJsonResponse } from '@/lib/pipeline/openrouter';

// ─── Progress Helper ──────────────────────────────────────────────────────

async function updateProgress(
  supabase: SupabaseClient,
  runId: string,
  pct: number,
  message: string,
  status: 'running' | 'completed' | 'error' = 'running',
) {
  const update: Record<string, unknown> = {
    progress_pct: Math.round(pct),
    message,
    status,
  };
  if (status === 'running' && pct === 0) {
    update.started_at = new Date().toISOString();
  }
  if (status === 'completed') {
    update.completed_at = new Date().toISOString();
  }

  await supabase
    .from('stage_progress')
    .upsert(
      { run_id: runId, stage: 3, ...update },
      { onConflict: 'run_id,stage' },
    );
}

// ─── Survey Design Prompt ─────────────────────────────────────────────────

function buildSurveyDesignPrompt(
  themes: Array<{
    theme_name: string;
    description: string | null;
    frequency: number | null;
    keywords: string[] | null;
  }>,
): { system: string; user: string } {
  const themeBlock = themes
    .map(
      (t, i) =>
        `${i + 1}. **${t.theme_name}** (frequency: ${t.frequency ?? 'unknown'})\n   ${t.description ?? ''}\n   Keywords: ${(t.keywords ?? []).join(', ')}`,
    )
    .join('\n\n');

  const system = `You are an expert survey methodologist designing quantitative research instruments for consumer product studies. You specialize in survey design for prefabricated housing and home improvement products.

Return ONLY a JSON object — no explanations, no markdown.`;

  const user = `Design a quantitative survey instrument for the Tahoe Mini by Neo Smart Living — a ~120 sq ft prefabricated backyard structure, professionally installed in one day, priced at $23,000.

The survey should be informed by these themes discovered during qualitative depth interviews:

${themeBlock}

Design a comprehensive survey with the following structure. Output as a JSON object with a "sections" array. Each section should have:
- "section_id": short identifier (e.g., "S1", "Q5_series")
- "section_label": descriptive name
- "instructions": instructions for the respondent
- "questions": array of question objects

Each question object should have:
- "id": question identifier (e.g., "Q1", "Q5a")
- "text": the question text
- "type": one of "screening", "likert_5", "multiple_choice", "ranking", "open_ended", "matrix"
- "options": array of options (for multiple_choice, likert labels, matrix rows, etc.)
- "required": boolean

Include these section types:
1. **Screening questions** — qualify respondents (homeowners, backyard access, income bracket)
2. **Awareness & consideration** — familiarity with backyard structures, consideration stage
3. **Likert scales (1-5)** — attitudes toward key themes (space needs, work-life boundaries, home investment)
4. **Barrier assessment (Q5 series)** — rate each barrier's importance (price, permits, HOA, aesthetics, size, installation trust)
5. **Concept testing** — present 5 concepts derived from themes and rate appeal:
   a. "The Private Office" — dedicated remote work sanctuary
   b. "The Wellness Retreat" — meditation/yoga/personal wellness space
   c. "The Creative Studio" — art, music, content creation space
   d. "The Family Flex Room" — kids play, guest suite, multipurpose
   e. "The Entrepreneur's HQ" — home business, storage, shipping
6. **Value proposition testing** — rate messaging statements on persuasiveness
7. **Purchase intent & pricing** — willingness to buy, acceptable price range, financing interest
8. **Demographics** — age, income, household size, home type, work arrangement

Also include in the top-level JSON:
- "estimated_duration_minutes": integer
- "total_questions": integer count`;

  return { system, user };
}

// ─── Coverage Analysis ────────────────────────────────────────────────────

interface SurveyDesignResult {
  modelId: string;
  modelLabel: string;
  design: Record<string, unknown>;
  sections: Array<{
    section_id: string;
    section_label: string;
    questions?: unknown[];
  }>;
  totalQuestions: number;
  estimatedDuration: number;
}

interface CoverageEntry {
  sectionId: string;
  sectionLabel: string;
  modelsIncluding: string[];
  questionCounts: Record<string, number>;
}

function analyzeCoverage(designs: SurveyDesignResult[]): CoverageEntry[] {
  const sectionMap = new Map<
    string,
    { label: string; models: string[]; counts: Record<string, number> }
  >();

  for (const design of designs) {
    for (const section of design.sections) {
      const id = (section.section_id || '')
        .toLowerCase()
        .replace(/\s+/g, '_');
      if (!id) continue;

      if (!sectionMap.has(id)) {
        sectionMap.set(id, {
          label: section.section_label || id,
          models: [],
          counts: {},
        });
      }

      const entry = sectionMap.get(id)!;
      entry.models.push(design.modelLabel);
      entry.counts[design.modelLabel] = Array.isArray(section.questions)
        ? section.questions.length
        : 0;
    }
  }

  return Array.from(sectionMap.entries()).map(([sectionId, data]) => ({
    sectionId,
    sectionLabel: data.label,
    modelsIncluding: data.models,
    questionCounts: data.counts,
  }));
}

// ─── Main Stage Function ──────────────────────────────────────────────────

export async function runStage3(
  supabase: SupabaseClient,
  runId: string,
  apiKey: string,
) {
  await updateProgress(supabase, runId, 0, 'Starting survey design...');

  // Fetch interview themes from this run
  const { data: themes, error: themesError } = await supabase
    .from('interview_themes')
    .select('theme_name, description, frequency, keywords')
    .eq('run_id', runId);

  if (themesError) {
    await updateProgress(
      supabase,
      runId,
      0,
      `Error fetching themes: ${themesError.message}`,
      'error',
    );
    throw new Error(`Failed to fetch interview themes: ${themesError.message}`);
  }

  if (!themes || themes.length === 0) {
    await updateProgress(
      supabase,
      runId,
      0,
      'No interview themes found for this run',
      'error',
    );
    throw new Error('No interview themes found — run Stage 2 first');
  }

  const { system, user } = buildSurveyDesignPrompt(themes);

  // Generate a survey design from each of the 3 models
  const designs: SurveyDesignResult[] = [];
  let modelsCompleted = 0;

  for (const modelId of MODEL_IDS) {
    const modelLabel = MODEL_LABELS[modelId];
    const progressPct = Math.round((modelsCompleted / MODEL_IDS.length) * 90);
    await updateProgress(
      supabase,
      runId,
      progressPct,
      `Generating survey design with ${modelLabel}...`,
    );

    try {
      const raw = await callOpenRouter(apiKey, modelId, system, user, {
        temperature: 0.4,
        maxTokens: 6000,
      });

      const parsed = parseJsonResponse<Record<string, unknown>>(raw);
      const sections = (parsed.sections as SurveyDesignResult['sections']) || [];

      // Count questions
      let totalQ = 0;
      for (const section of sections) {
        if (Array.isArray(section.questions)) {
          totalQ += section.questions.length;
        }
      }

      const designResult: SurveyDesignResult = {
        modelId,
        modelLabel,
        design: parsed,
        sections,
        totalQuestions: (parsed.total_questions as number) || totalQ,
        estimatedDuration:
          (parsed.estimated_duration_minutes as number) || Math.ceil(totalQ * 0.5),
      };

      // Persist
      await supabase.from('survey_designs').insert({
        run_id: runId,
        model: modelLabel,
        design: parsed,
        total_questions: designResult.totalQuestions,
        estimated_duration_minutes: designResult.estimatedDuration,
      });

      designs.push(designResult);
    } catch (err) {
      console.error(`Survey design failed for ${modelLabel}:`, err);
      // Continue with remaining models
    }

    modelsCompleted++;
    await updateProgress(
      supabase,
      runId,
      Math.round((modelsCompleted / MODEL_IDS.length) * 90),
      `${modelLabel} survey design complete`,
    );
  }

  if (designs.length === 0) {
    await updateProgress(
      supabase,
      runId,
      90,
      'All survey design attempts failed',
      'error',
    );
    throw new Error('All 3 models failed to generate survey designs');
  }

  // ── Coverage analysis ─────────────────────────────────────────────────

  await updateProgress(
    supabase,
    runId,
    92,
    'Analyzing cross-model survey coverage...',
  );

  const coverage = analyzeCoverage(designs);

  for (const entry of coverage) {
    await supabase.from('survey_coverage').insert({
      run_id: runId,
      section_id: entry.sectionId,
      section_label: entry.sectionLabel,
      models_including: entry.modelsIncluding,
      question_counts: entry.questionCounts,
    });
  }

  await updateProgress(supabase, runId, 100, 'Survey design complete', 'completed');

  return {
    designCount: designs.length,
    designs: designs.map((d) => ({
      model: d.modelLabel,
      totalQuestions: d.totalQuestions,
      estimatedDuration: d.estimatedDuration,
      sectionCount: d.sections.length,
    })),
    coverageSections: coverage.length,
    fullCoverageSections: coverage.filter(
      (c) => c.modelsIncluding.length === designs.length,
    ).length,
  };
}
