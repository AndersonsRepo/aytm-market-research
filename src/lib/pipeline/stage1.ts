// ============================================================================
// Stage 1 — Client Discovery
// Asks 10 foundational questions about the Tahoe Mini to 3 LLMs via OpenRouter
// and synthesizes responses into a structured research brief.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MODEL_IDS,
  MODEL_LABELS,
  DISCOVERY_QUESTIONS,
  DISCOVERY_SYSTEM_PROMPT,
  MAX_CONCURRENT_API_CALLS,
} from '@/lib/pipeline/constants';
import { callOpenRouterWithUsage, parseJsonResponse, estimateCost } from '@/lib/pipeline/openrouter';

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
      { run_id: runId, stage: 1, ...update },
      { onConflict: 'run_id,stage' },
    );
}

// ─── Concurrency Limiter ──────────────────────────────────────────────────

async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        const value = await tasks[i]();
        results[i] = { status: 'fulfilled', value };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main Stage Function ──────────────────────────────────────────────────

export async function runStage1(
  supabase: SupabaseClient,
  runId: string,
  apiKey: string,
) {
  await updateProgress(supabase, runId, 0, 'Starting client discovery...');

  const questionEntries = Object.entries(DISCOVERY_QUESTIONS);
  const totalCalls = questionEntries.length * MODEL_IDS.length; // 10 × 3 = 30
  let completedCalls = 0;
  let totalTokens = 0;
  let totalCost = 0;

  // Build task list: one per (question, model) pair
  const tasks = questionEntries.flatMap(([key, text]) =>
    MODEL_IDS.map((modelId) => async () => {
      const modelLabel = MODEL_LABELS[modelId];

      const result = await callOpenRouterWithUsage(
        apiKey,
        modelId,
        DISCOVERY_SYSTEM_PROMPT,
        text,
        { temperature: 0.7, maxTokens: 2000 },
      );

      totalTokens += result.usage.total_tokens;
      totalCost += estimateCost(modelId, result.usage);

      // Persist to Supabase
      await supabase.from('discovery_responses').insert({
        run_id: runId,
        model: modelLabel,
        question_key: key,
        question_label: key,
        question_text: text,
        response: result.content,
      });

      completedCalls++;
      const pct = Math.round((completedCalls / totalCalls) * 90);
      await updateProgress(
        supabase,
        runId,
        pct,
        `Discovery ${completedCalls}/${totalCalls} (${modelLabel} — ${key})`,
      );

      return { key, modelId, modelLabel, response: result.content };
    }),
  );

  // Execute with bounded concurrency
  const results = await withConcurrency(tasks, MAX_CONCURRENT_API_CALLS);

  // ── Retry failed models ───────────────────────────────────────────────
  // Check which (question, model) pairs failed. If an entire model has 0
  // successes, retry all of that model's calls (up to 2 retries, 3s delay).

  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 3000;

  // Mutable copy of all results so retries can fill in gaps
  const allResults: PromiseSettledResult<{
    key: string;
    modelId: string;
    modelLabel: string;
    response: string;
  }>[] = [...results];

  // Track which original task index maps to which (key, modelId)
  const taskIndex: { key: string; modelId: string }[] = questionEntries.flatMap(
    ([key]) => MODEL_IDS.map((modelId) => ({ key, modelId })),
  );

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Count successes per model
    const successCountByModel: Record<string, number> = {};
    for (const modelId of MODEL_IDS) {
      successCountByModel[modelId] = 0;
    }
    for (let i = 0; i < allResults.length; i++) {
      if (allResults[i].status === 'fulfilled') {
        successCountByModel[taskIndex[i].modelId]++;
      }
    }

    // Find models with 0 successes
    const failedModels = MODEL_IDS.filter(
      (modelId) => successCountByModel[modelId] === 0,
    );

    if (failedModels.length === 0) break;

    const failedLabels = failedModels.map((id) => MODEL_LABELS[id]).join(', ');
    await updateProgress(
      supabase,
      runId,
      90,
      `Retrying failed models (attempt ${attempt}/${MAX_RETRIES}): ${failedLabels}`,
    );

    await delay(RETRY_DELAY_MS);

    // Build retry tasks only for failed (question, model) pairs of failed models
    const retryEntries: { originalIndex: number; task: () => Promise<{
      key: string;
      modelId: string;
      modelLabel: string;
      response: string;
    }> }[] = [];

    for (let i = 0; i < taskIndex.length; i++) {
      const { key, modelId } = taskIndex[i];
      if (!failedModels.includes(modelId)) continue;
      // Only retry pairs that actually failed
      if (allResults[i].status === 'fulfilled') continue;

      const text = DISCOVERY_QUESTIONS[key as keyof typeof DISCOVERY_QUESTIONS];
      const modelLabel = MODEL_LABELS[modelId];

      retryEntries.push({
        originalIndex: i,
        task: async () => {
          const result = await callOpenRouterWithUsage(
            apiKey,
            modelId,
            DISCOVERY_SYSTEM_PROMPT,
            text,
            { temperature: 0.7, maxTokens: 2000 },
          );

          totalTokens += result.usage.total_tokens;
          totalCost += estimateCost(modelId, result.usage);

          await supabase.from('discovery_responses').insert({
            run_id: runId,
            model: modelLabel,
            question_key: key,
            question_label: key,
            question_text: text,
            response: result.content,
          });

          completedCalls++;

          return { key, modelId, modelLabel, response: result.content };
        },
      });
    }

    const retryResults = await withConcurrency(
      retryEntries.map((e) => e.task),
      MAX_CONCURRENT_API_CALLS,
    );

    // Merge retry results back into allResults
    for (let j = 0; j < retryEntries.length; j++) {
      if (retryResults[j].status === 'fulfilled') {
        allResults[retryEntries[j].originalIndex] = retryResults[j];
      }
    }
  }

  // ── Collect responses for synthesis ───────────────────────────────────

  const responsesByQuestion: Record<string, Record<string, string>> = {};
  const finalSuccessByModel: Record<string, number> = {};
  for (const modelId of MODEL_IDS) {
    finalSuccessByModel[modelId] = 0;
  }

  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    if (r.status === 'fulfilled') {
      const { key, modelId, modelLabel, response } = r.value;
      (responsesByQuestion[key] ??= {})[modelLabel] = response;
      finalSuccessByModel[modelId]++;
    }
  }

  // Warn about models that still have 0 responses after retries
  const stillFailedModels = MODEL_IDS.filter(
    (id) => finalSuccessByModel[id] === 0,
  );
  if (stillFailedModels.length > 0) {
    const warnLabels = stillFailedModels.map((id) => MODEL_LABELS[id]).join(', ');
    await updateProgress(
      supabase,
      runId,
      91,
      `Warning: ${warnLabels} returned 0 responses after retries — synthesizing with ${MODEL_IDS.length - stillFailedModels.length}/${MODEL_IDS.length} models`,
    );
  }

  // ── Synthesize into structured brief ──────────────────────────────────

  await updateProgress(supabase, runId, 92, 'Synthesizing discovery brief...');

  let synthesisInput = '';
  for (const [key, text] of questionEntries) {
    synthesisInput += `\n## ${key}: ${text}\n`;
    for (const [label, resp] of Object.entries(responsesByQuestion[key] ?? {})) {
      synthesisInput += `\n**${label}:**\n${resp}\n`;
    }
  }

  const synthesisSystem = `You are a senior market research strategist. Synthesize the multi-model discovery analysis below into a single structured research brief. Return ONLY a JSON object with these exact keys:
- "product_summary": string (2-3 sentences)
- "target_segments": array of strings (3-5 segment descriptions)
- "key_barriers": array of strings (3-5 purchase barriers)
- "positioning_strategy": string (2-3 sentences)
- "recommended_research_focus": array of strings (3-5 research priorities)`;

  const synthesisUser = `Here are expert analyses of the Tahoe Mini from 3 different AI models across 10 strategic questions:\n${synthesisInput}\n\nSynthesize into a unified research brief JSON.`;

  const synthesisResult = await callOpenRouterWithUsage(
    apiKey,
    'openai/gpt-4.1-mini',
    synthesisSystem,
    synthesisUser,
    { temperature: 0.3, maxTokens: 3000 },
  );

  totalTokens += synthesisResult.usage.total_tokens;
  totalCost += estimateCost('openai/gpt-4.1-mini', synthesisResult.usage);

  let brief: Record<string, unknown>;
  try {
    brief = parseJsonResponse(synthesisResult.content);
  } catch {
    brief = {
      product_summary: 'Synthesis JSON parsing failed — raw response preserved below.',
      target_segments: [],
      key_barriers: [],
      positioning_strategy: '',
      recommended_research_focus: [],
      raw_synthesis: synthesisResult.content.slice(0, 2000),
    };
  }

  // Persist brief
  const modelsUsed = MODEL_IDS.map((id) => MODEL_LABELS[id]);
  const { error: briefInsertError } = await supabase.from('discovery_briefs').insert({
    run_id: runId,
    brief,
    models_used: modelsUsed,
  });

  if (briefInsertError) {
    console.error('discovery_briefs insert failed:', briefInsertError);
    await updateProgress(
      supabase,
      runId,
      95,
      `Warning: Failed to persist brief (${briefInsertError.message}) — returning results without DB storage`,
    );
  }

  await updateProgress(supabase, runId, 100, 'Client discovery complete', 'completed');

  return {
    totalResponses: completedCalls,
    brief,
    modelsUsed,
    totalTokens,
    totalCost,
  };
}
