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

  // Collect responses for synthesis
  const responsesByQuestion: Record<string, Record<string, string>> = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { key, modelLabel, response } = r.value;
      (responsesByQuestion[key] ??= {})[modelLabel] = response;
    }
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

  const brief = parseJsonResponse(synthesisResult.content);

  // Persist brief
  const modelsUsed = MODEL_IDS.map((id) => MODEL_LABELS[id]);
  await supabase.from('discovery_briefs').insert({
    run_id: runId,
    brief,
    models_used: modelsUsed,
  });

  await updateProgress(supabase, runId, 100, 'Client discovery complete', 'completed');

  return {
    totalResponses: completedCalls,
    brief,
    modelsUsed,
    totalTokens,
    totalCost,
  };
}
