// ============================================================================
// Stage 2 — Consumer Interviews + Analysis
// Part A: Generate 30 synthetic depth interviews across 3 LLMs
// Part B: Analyze interviews — VADER sentiment, emotional tone, theme extraction
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  InterviewPersona,
  EmotionClassification,
  InterviewQuestionKey,
} from '@/lib/pipeline/types';
import {
  MODELS,
  MODEL_IDS,
  MODEL_LABELS,
  INTERVIEW_PERSONAS,
  INTERVIEW_QUESTIONS,
  INTERVIEW_RESPONSE_KEYS,
  EMOTION_TAXONOMY,
  MAX_CONCURRENT_API_CALLS,
} from '@/lib/pipeline/constants';
import { callOpenRouter, parseJsonResponse } from '@/lib/pipeline/openrouter';
import { vaderSentiment } from '@/lib/pipeline/vader';

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
      { run_id: runId, stage: 2, ...update },
      { onConflict: 'run_id,stage' },
    );
}

// ─── Concurrency Limiter ──────────────────────────────────────────────────

async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ─── Part A: Interview Generation ─────────────────────────────────────────

/** Round-robin model assignment: persona index % 3 → model */
function getModelForPersona(index: number): string {
  return MODEL_IDS[index % MODEL_IDS.length];
}

function buildPersonaSystemPrompt(persona: InterviewPersona): string {
  return `You are role-playing as ${persona.name}, a real homeowner in Southern California being interviewed about your home and backyard needs.

PERSONA:
- Age bracket: ${persona.age}
- Household income: ${persona.income}
- Work arrangement: ${persona.work_arrangement}
- Home: ${persona.home_situation}
- Household: ${persona.household}
- Lifestyle: ${persona.lifestyle_note}
- HOA: ${persona.hoa_status}

INSTRUCTIONS:
1. Answer each interview question from the perspective of this persona.
2. Give 3-6 sentence answers that feel like natural spoken responses in a depth interview.
3. Express authentic emotions — excitement, frustration, hesitation, curiosity, etc.
4. Reference specific details from your persona (home type, family, hobbies) to ground your answers.
5. Be honest about concerns and tradeoffs, not uniformly positive or negative.
6. Return ONLY a single JSON object with the exact keys specified. No explanations, no markdown.`;
}

function buildInterviewUserPrompt(): string {
  const qText = Object.entries(INTERVIEW_QUESTIONS)
    .map(([k, v]) => `${k}. ${v}`)
    .join('\n');

  const schema = JSON.stringify(
    Object.fromEntries(
      INTERVIEW_RESPONSE_KEYS.map((k) => [k, 'Your 3-6 sentence answer']),
    ),
    null,
    2,
  );

  return `You are being interviewed about your home, backyard, and potential interest in a backyard structure product. Answer each question thoughtfully as your persona.

--- INTERVIEW QUESTIONS ---
${qText}

Finally, share any additional_thoughts you have about backyard living, home improvement, or this product concept.
--- END ---

Return a JSON object with exactly these keys:
${schema}

IMPORTANT: Each value must be a string of 3-6 sentences. Return ONLY JSON, no other text.`;
}

function validateResponses(data: Record<string, unknown>): Record<string, string> {
  const validated: Record<string, string> = {};
  for (const key of INTERVIEW_RESPONSE_KEYS) {
    const val = data[key];
    validated[key] = typeof val === 'string' && val.trim().length > 0
      ? val
      : '[No response]';
  }
  return validated;
}

interface GeneratedInterview {
  interviewId: string;
  modelId: string;
  modelLabel: string;
  persona: InterviewPersona;
  responses: Record<string, string>;
}

async function generateInterview(
  apiKey: string,
  modelId: string,
  persona: InterviewPersona,
): Promise<GeneratedInterview> {
  const raw = await callOpenRouter(
    apiKey,
    modelId,
    buildPersonaSystemPrompt(persona),
    buildInterviewUserPrompt(),
    { temperature: 0.8, maxTokens: 3000 },
  );

  const parsed = parseJsonResponse(raw);
  const responses = validateResponses(parsed);
  const modelLabel = MODEL_LABELS[modelId];

  return {
    interviewId: `${persona.persona_id}_${modelLabel}`,
    modelId,
    modelLabel,
    persona,
    responses,
  };
}

// ─── Part B: Analysis ─────────────────────────────────────────────────────

interface SentimentResult {
  interviewId: string;
  scores: Record<string, number>;
  overall: number;
  label: string;
}

function analyzeSentiment(
  interviewId: string,
  responses: Record<string, string>,
): SentimentResult {
  const questionKeys = Object.keys(INTERVIEW_QUESTIONS);
  const scores: Record<string, number> = {};

  for (const q of questionKeys) {
    const text = responses[q] || '';
    scores[q] = vaderSentiment(text).compound;
  }

  const values = Object.values(scores);
  const overall = values.length > 0
    ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4))
    : 0;
  const label = overall > 0.05 ? 'Positive' : overall < -0.05 ? 'Negative' : 'Neutral';

  return { interviewId, scores, overall, label };
}

async function classifyEmotion(
  apiKey: string,
  personaId: string,
  personaName: string,
  iq6: string,
  iq7: string,
): Promise<EmotionClassification> {
  const taxonomyStr = EMOTION_TAXONOMY.join(', ');

  const system = `You are a qualitative research analyst classifying emotional tone in interview responses.

Classify the respondent's emotional reaction to the Tahoe Mini product concept.

Use ONLY these emotions: ${taxonomyStr}

Return ONLY a JSON object with:
- "primary_emotion": one of the emotions above
- "secondary_emotion": one of the emotions above, or null
- "intensity": integer 1-5 (1=subtle, 5=very strong)
- "reasoning": 1-2 sentences explaining your classification`;

  const user = `Respondent ${personaId} (${personaName}):

IQ6 (Product reaction): ${iq6}

IQ7 (Barriers & drivers): ${iq7}

Classify the emotional tone.`;

  const raw = await callOpenRouter(apiKey, 'openai/gpt-4.1-mini', system, user, {
    temperature: 0.3,
    maxTokens: 300,
  });

  const result = parseJsonResponse<EmotionClassification>(raw);

  // Validate against taxonomy
  const validEmotions = EMOTION_TAXONOMY as readonly string[];
  if (!validEmotions.includes(result.primary_emotion)) {
    result.primary_emotion = 'pragmatism';
  }
  if (result.secondary_emotion && !validEmotions.includes(result.secondary_emotion)) {
    result.secondary_emotion = null;
  }
  result.intensity = Math.max(1, Math.min(5, Math.round(result.intensity ?? 3)));

  return result;
}

async function extractThemes(
  apiKey: string,
  interviews: GeneratedInterview[],
): Promise<{
  themes: Array<{
    theme_name: string;
    description: string;
    frequency: number;
    keywords: string[];
    supporting_quotes: Array<{ respondent_id: string; quote: string }>;
  }>;
}> {
  let transcriptBlock = '';
  for (const iv of interviews) {
    transcriptBlock += `\n--- ${iv.persona.persona_id} (${iv.persona.name}) ---\n`;
    for (const key of INTERVIEW_RESPONSE_KEYS) {
      const val = iv.responses[key];
      if (val && val !== '[No response]') {
        transcriptBlock += `${key}: ${val}\n`;
      }
    }
  }

  const system = `You are an expert qualitative researcher analyzing depth interview transcripts about homeowner backyard needs and interest in a prefabricated backyard structure (the Tahoe Mini).

Analyze all transcripts and identify emergent themes. Return ONLY a JSON object.`;

  const user = `Analyze these ${interviews.length} depth interview transcripts:

${transcriptBlock}

Return a JSON object with:
"themes": array of objects, each with:
  - "theme_name": concise label
  - "description": 2-3 sentences
  - "frequency": number of respondents showing this theme
  - "keywords": array of 4-6 relevant keywords
  - "supporting_quotes": array of {"respondent_id": "...", "quote": "..."} (2-3 per theme)

Identify 4-8 themes based on observed patterns.`;

  const raw = await callOpenRouter(apiKey, 'openai/gpt-4.1-mini', system, user, {
    temperature: 0.3,
    maxTokens: 4000,
  });

  return parseJsonResponse(raw);
}

// ─── Main Stage Function ──────────────────────────────────────────────────

export async function runStage2(
  supabase: SupabaseClient,
  runId: string,
  apiKey: string,
) {
  await updateProgress(supabase, runId, 0, 'Starting consumer interviews...');

  // ── Part A: Generate 30 interviews ────────────────────────────────────

  const totalInterviews = INTERVIEW_PERSONAS.length; // 30
  let interviewsCompleted = 0;
  const allInterviews: GeneratedInterview[] = [];

  const interviewTasks = INTERVIEW_PERSONAS.map((persona, i) => async () => {
    const modelId = getModelForPersona(i);
    const interview = await generateInterview(apiKey, modelId, persona);

    // Persist to Supabase
    await supabase.from('interview_transcripts').insert({
      run_id: runId,
      interview_id: interview.interviewId,
      model: interview.modelLabel,
      persona_id: interview.persona.persona_id,
      persona_name: interview.persona.name,
      demographics: {
        age: interview.persona.age,
        income: interview.persona.income,
        work_arrangement: interview.persona.work_arrangement,
        home_situation: interview.persona.home_situation,
        household: interview.persona.household,
        lifestyle_note: interview.persona.lifestyle_note,
        hoa_status: interview.persona.hoa_status,
      },
      responses: interview.responses,
    });

    interviewsCompleted++;
    const pct = Math.round((interviewsCompleted / totalInterviews) * 60);
    await updateProgress(
      supabase,
      runId,
      pct,
      `Interview ${interviewsCompleted}/${totalInterviews} (${interview.modelLabel} — ${interview.persona.name})`,
    );

    allInterviews.push(interview);
    return interview;
  });

  await withConcurrency(interviewTasks, MAX_CONCURRENT_API_CALLS);

  // ── Part B1: VADER sentiment ──────────────────────────────────────────

  await updateProgress(supabase, runId, 62, 'Running sentiment analysis...');

  const sentimentResults: SentimentResult[] = [];
  for (const iv of allInterviews) {
    sentimentResults.push(analyzeSentiment(iv.interviewId, iv.responses));
  }

  await updateProgress(supabase, runId, 70, 'Sentiment complete. Classifying emotions...');

  // ── Part B2: Emotional tone (LLM calls) ───────────────────────────────

  let emotionsCompleted = 0;
  const emotionMap = new Map<string, EmotionClassification>();

  const emotionTasks = allInterviews.map((iv) => async () => {
    const emotion = await classifyEmotion(
      apiKey,
      iv.persona.persona_id,
      iv.persona.name,
      iv.responses.IQ6 || '',
      iv.responses.IQ7 || '',
    );

    emotionMap.set(iv.interviewId, emotion);

    // Persist analysis row (sentiment + emotion combined)
    const sentiment = sentimentResults.find((s) => s.interviewId === iv.interviewId);
    await supabase.from('interview_analysis').insert({
      run_id: runId,
      interview_id: iv.interviewId,
      sentiment_scores: {
        ...sentiment?.scores,
        overall: sentiment?.overall,
        label: sentiment?.label,
      },
      primary_emotion: emotion.primary_emotion,
      secondary_emotion: emotion.secondary_emotion,
      emotion_intensity: emotion.intensity,
      emotion_reasoning: emotion.reasoning,
    });

    emotionsCompleted++;
    const pct = 70 + Math.round((emotionsCompleted / allInterviews.length) * 20);
    await updateProgress(
      supabase,
      runId,
      pct,
      `Emotion ${emotionsCompleted}/${allInterviews.length} (${emotion.primary_emotion})`,
    );

    return emotion;
  });

  await withConcurrency(emotionTasks, MAX_CONCURRENT_API_CALLS);

  // ── Part B3: Theme extraction ─────────────────────────────────────────

  await updateProgress(supabase, runId, 92, 'Extracting themes from transcripts...');

  const themeResult = await extractThemes(apiKey, allInterviews);
  const themes = themeResult.themes || [];

  for (const theme of themes) {
    await supabase.from('interview_themes').insert({
      run_id: runId,
      source: 'llm',
      theme_name: theme.theme_name,
      description: theme.description || null,
      frequency: theme.frequency || null,
      keywords: theme.keywords || null,
      supporting_quotes: theme.supporting_quotes || null,
    });
  }

  await updateProgress(supabase, runId, 100, 'Interviews and analysis complete', 'completed');

  return {
    interviewCount: allInterviews.length,
    sentimentSummary: {
      positive: sentimentResults.filter((s) => s.label === 'Positive').length,
      neutral: sentimentResults.filter((s) => s.label === 'Neutral').length,
      negative: sentimentResults.filter((s) => s.label === 'Negative').length,
    },
    themeCount: themes.length,
  };
}
