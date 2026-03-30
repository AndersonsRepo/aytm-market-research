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
  FollowUpExchange,
} from '@/lib/pipeline/types';
import {
  MODEL_IDS,
  MODEL_LABELS,
  INTERVIEW_PERSONAS,
  INTERVIEW_QUESTIONS,
  INTERVIEW_RESPONSE_KEYS,
  FOLLOW_UP_PROBES,
  EMOTION_TAXONOMY,
  MAX_CONCURRENT_API_CALLS,
} from '@/lib/pipeline/constants';
import { callOpenRouterWithUsage, parseJsonResponse, estimateCost } from '@/lib/pipeline/openrouter';
import { vaderSentiment } from '@/lib/pipeline/vader';
import { krippendorffAlpha } from '@/lib/pipeline/stats';

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

// ─── Shared cost accumulator ──────────────────────────────────────────────

let _totalTokens = 0;
let _totalCost = 0;

function trackUsage(model: string, usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) {
  _totalTokens += usage.total_tokens;
  _totalCost += estimateCost(model, usage);
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

// ─── Follow-up Probe Logic ────────────────────────────────────────────────

const COST_KEYWORDS = ['cost', 'expensive', 'price', 'afford', '$23', 'budget', 'money', 'financing', 'payment', 'pricey'];
const SKEPTICISM_KEYWORDS = ['doubt', 'skeptic', 'not sure', 'hesitant', 'questionable', 'gimmick', 'unnecessary', 'don\'t need', 'wouldn\'t', 'hard sell'];
const SPACE_KEYWORDS = ['space', 'small yard', 'tiny', 'not enough room', 'footprint', 'backyard is small', 'limited'];
const HOA_KEYWORDS = ['hoa', 'homeowner association', 'community rules', 'deed restriction', 'covenant', 'approval', 'neighborhood rules'];

/** Detect which follow-up probes should fire based on interview responses */
function detectFollowUpTriggers(responses: Record<string, string>): string[] {
  const triggers: string[] = [];
  const iq6 = (responses.IQ6 || '').toLowerCase();
  const iq7 = (responses.IQ7 || '').toLowerCase();

  // Cost concern in IQ7
  if (COST_KEYWORDS.some(kw => iq7.includes(kw))) {
    triggers.push('FU1');
  }

  // High interest in IQ6 (positive language without major concerns)
  const positiveWords = ['love', 'amazing', 'excited', 'perfect', 'great', 'fantastic', 'absolutely', 'sign me up', 'want one'];
  if (positiveWords.some(kw => iq6.includes(kw)) && !SKEPTICISM_KEYWORDS.some(kw => iq6.includes(kw))) {
    triggers.push('FU2');
  }

  // Skepticism in IQ6
  if (SKEPTICISM_KEYWORDS.some(kw => iq6.includes(kw))) {
    triggers.push('FU3');
  }

  // Space concern in IQ7
  if (SPACE_KEYWORDS.some(kw => iq7.includes(kw))) {
    triggers.push('FU4');
  }

  // HOA concern in IQ7
  if (HOA_KEYWORDS.some(kw => iq7.includes(kw))) {
    triggers.push('FU5');
  }

  // Max 2 follow-ups per interview to control cost/length
  return triggers.slice(0, 2);
}

/** Generate follow-up responses in a second turn */
async function generateFollowUps(
  apiKey: string,
  modelId: string,
  persona: InterviewPersona,
  originalResponses: Record<string, string>,
  probeKeys: string[],
): Promise<FollowUpExchange[]> {
  if (probeKeys.length === 0) return [];

  const probes = probeKeys
    .map(k => FOLLOW_UP_PROBES[k])
    .filter(Boolean);

  const questionBlock = probes
    .map((p, i) => `Follow-up ${i + 1}: ${p.question}`)
    .join('\n\n');

  const contextBlock = `Your earlier answers for context:
IQ6 (Product Reaction): ${originalResponses.IQ6 || '[No response]'}
IQ7 (Barriers & Drivers): ${originalResponses.IQ7 || '[No response]'}`;

  const system = buildPersonaSystemPrompt(persona);
  const user = `The interviewer has follow-up questions based on your earlier responses. Answer each as your persona — stay consistent with what you said before but go deeper.

${contextBlock}

${questionBlock}

Return a JSON object with keys ${probeKeys.map(k => `"${k}"`).join(', ')}. Each value is your 3-5 sentence response.`;

  const result = await callOpenRouterWithUsage(apiKey, modelId, system, user, {
    temperature: 0.8,
    maxTokens: 1500,
  });

  trackUsage(modelId, result.usage);

  const parsed = parseJsonResponse<Record<string, string>>(result.content);

  return probeKeys.map(k => {
    const probe = FOLLOW_UP_PROBES[k];
    return {
      probe_key: k as FollowUpExchange['probe_key'],
      trigger: probe.trigger,
      question: probe.question,
      response: typeof parsed[k] === 'string' && parsed[k].trim().length > 0
        ? parsed[k]
        : '[No response]',
    };
  });
}

interface GeneratedInterview {
  interviewId: string;
  modelId: string;
  modelLabel: string;
  persona: InterviewPersona;
  responses: Record<string, string>;
  followUps: FollowUpExchange[];
}

async function generateInterview(
  apiKey: string,
  modelId: string,
  persona: InterviewPersona,
): Promise<GeneratedInterview> {
  // Turn 1: Core interview questions
  const result = await callOpenRouterWithUsage(
    apiKey,
    modelId,
    buildPersonaSystemPrompt(persona),
    buildInterviewUserPrompt(),
    { temperature: 0.8, maxTokens: 3000 },
  );

  trackUsage(modelId, result.usage);

  const parsed = parseJsonResponse(result.content);
  const responses = validateResponses(parsed);
  const modelLabel = MODEL_LABELS[modelId];

  // Turn 2: Conditional follow-up probes based on IQ6/IQ7 content
  const probeKeys = detectFollowUpTriggers(responses);
  let followUps: FollowUpExchange[] = [];
  if (probeKeys.length > 0) {
    try {
      followUps = await generateFollowUps(apiKey, modelId, persona, responses, probeKeys);
    } catch {
      // Non-fatal: follow-ups are additive, don't fail the interview
      followUps = [];
    }
  }

  return {
    interviewId: `${persona.persona_id}_${modelLabel}`,
    modelId,
    modelLabel,
    persona,
    responses,
    followUps,
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
  modelId: string,
  personaId: string,
  personaName: string,
  iq6: string,
  iq7: string,
): Promise<EmotionClassification> {
  const taxonomyStr = EMOTION_TAXONOMY.join(', ');

  const system = `You are a qualitative research analyst classifying emotional tone in interview responses.

Classify the respondent's emotional reaction to the Tahoe Mini product concept.

Use ONLY these emotions: ${taxonomyStr}

CLASSIFICATION CODEBOOK:
- "excitement": Respondent expresses enthusiasm, eagerness, or positive anticipation about the product concept
- "skepticism": Respondent questions claims, doubts value proposition, or expresses distrust
- "anxiety": Respondent worries about cost, risk, complexity, or making the wrong decision
- "curiosity": Respondent asks questions, wants to learn more, but hasn't formed a strong opinion yet
- "indifference": Respondent shows little engagement — the product doesn't connect to their needs
- "aspiration": Respondent connects the product to their ideal lifestyle or future goals
- "frustration": Respondent expresses annoyance at barriers, limitations, or unmet needs
- "pragmatism": Respondent evaluates purely on practical terms — cost/benefit, ROI, logistics

BOUNDARY CASES:
- If the respondent mixes excitement about the concept with anxiety about cost, classify primary as "anxiety" if cost dominates their language, "excitement" if the vision dominates
- "Curiosity" requires genuine questions or information-seeking. Polite interest without questions is "indifference"
- "Pragmatism" vs "skepticism": pragmatism accepts the product category but evaluates this specific offer; skepticism questions whether the category itself makes sense

Return ONLY a JSON object with:
- "primary_emotion": one of the emotions above
- "secondary_emotion": one of the emotions above, or null
- "intensity": integer 1-5 (1=subtle, 5=very strong)
- "reasoning": 1-2 sentences explaining your classification`;

  const user = `Respondent ${personaId} (${personaName}):

IQ6 (Product reaction): ${iq6}

IQ7 (Barriers & drivers): ${iq7}

Classify the emotional tone.`;

  const result = await callOpenRouterWithUsage(apiKey, modelId, system, user, {
    temperature: 0.3,
    maxTokens: 300,
  });

  trackUsage(modelId, result.usage);

  const parsed = parseJsonResponse<EmotionClassification>(result.content);

  // Validate against taxonomy
  const validEmotions = EMOTION_TAXONOMY as readonly string[];
  if (!validEmotions.includes(parsed.primary_emotion)) {
    parsed.primary_emotion = 'pragmatism';
  }
  if (parsed.secondary_emotion && !validEmotions.includes(parsed.secondary_emotion)) {
    parsed.secondary_emotion = null;
  }
  parsed.intensity = Math.max(1, Math.min(5, Math.round(parsed.intensity ?? 3)));

  return parsed;
}

async function extractThemesWithModel(
  apiKey: string,
  modelId: string,
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

  const result = await callOpenRouterWithUsage(apiKey, modelId, system, user, {
    temperature: 0.3,
    maxTokens: 4000,
  });

  trackUsage(modelId, result.usage);

  return parseJsonResponse(result.content);
}

// ─── Main Stage Function ──────────────────────────────────────────────────

export async function runStage2(
  supabase: SupabaseClient,
  runId: string,
  apiKey: string,
) {
  // Reset accumulators
  _totalTokens = 0;
  _totalCost = 0;

  await updateProgress(supabase, runId, 0, 'Starting consumer interviews...');

  // ── Part A: Generate 30 interviews ────────────────────────────────────

  const totalInterviews = INTERVIEW_PERSONAS.length; // 30
  let interviewsCompleted = 0;
  const allInterviews: GeneratedInterview[] = [];

  const interviewTasks = INTERVIEW_PERSONAS.map((persona, i) => async () => {
    const modelId = getModelForPersona(i);
    const interview = await generateInterview(apiKey, modelId, persona);

    // Persist to Supabase (include follow-ups if column exists)
    const transcriptRow: Record<string, unknown> = {
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
      follow_ups: interview.followUps.length > 0 ? interview.followUps : null,
    };
    const { error: insertErr } = await supabase.from('interview_transcripts').insert(transcriptRow);
    if (insertErr?.code === '42703') {
      // follow_ups column doesn't exist yet — retry without it
      delete transcriptRow.follow_ups;
      await supabase.from('interview_transcripts').insert(transcriptRow);
    }

    interviewsCompleted++;
    const fuNote = interview.followUps.length > 0
      ? ` + ${interview.followUps.length} follow-up${interview.followUps.length > 1 ? 's' : ''}`
      : '';
    const pct = Math.round((interviewsCompleted / totalInterviews) * 60);
    await updateProgress(
      supabase,
      runId,
      pct,
      `Interview ${interviewsCompleted}/${totalInterviews} (${interview.modelLabel} — ${interview.persona.name}${fuNote})`,
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

  // ── Part B2: Emotional tone — 3-model STAMP classification ───────────

  await updateProgress(supabase, runId, 70, 'Classifying emotions (3-model STAMP)...');

  // Map emotion labels to numeric indices for Krippendorff's alpha
  const emotionToIndex: Record<string, number> = {};
  for (let i = 0; i < EMOTION_TAXONOMY.length; i++) {
    emotionToIndex[EMOTION_TAXONOMY[i]] = i + 1;
  }

  let emotionsCompleted = 0;
  const totalEmotionCalls = allInterviews.length * MODEL_IDS.length;

  // Store all classifications: interview → model → classification
  const allEmotionResults: Map<string, Map<string, EmotionClassification>> = new Map();

  const emotionTasks = allInterviews.flatMap((iv) =>
    MODEL_IDS.map((modelId) => async () => {
      const emotion = await classifyEmotion(
        apiKey,
        modelId,
        iv.persona.persona_id,
        iv.persona.name,
        iv.responses.IQ6 || '',
        iv.responses.IQ7 || '',
      );

      if (!allEmotionResults.has(iv.interviewId)) {
        allEmotionResults.set(iv.interviewId, new Map());
      }
      allEmotionResults.get(iv.interviewId)!.set(modelId, emotion);

      emotionsCompleted++;
      const pct = 70 + Math.round((emotionsCompleted / totalEmotionCalls) * 18);
      await updateProgress(
        supabase,
        runId,
        pct,
        `Emotion ${emotionsCompleted}/${totalEmotionCalls} (${MODEL_LABELS[modelId]} — ${emotion.primary_emotion})`,
      );

      return emotion;
    })
  );

  await withConcurrency(emotionTasks, MAX_CONCURRENT_API_CALLS);

  // Persist the consensus (majority vote) emotion per interview
  const emotionMap = new Map<string, EmotionClassification>();
  for (const iv of allInterviews) {
    const modelResults = allEmotionResults.get(iv.interviewId);
    if (!modelResults) continue;

    // Majority vote on primary_emotion
    const emotionCounts: Record<string, number> = {};
    const allClassifications = Array.from(modelResults.values());
    for (const cls of allClassifications) {
      emotionCounts[cls.primary_emotion] = (emotionCounts[cls.primary_emotion] ?? 0) + 1;
    }
    const sorted = Object.entries(emotionCounts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]; // majority vote
      const avgA = allClassifications.filter(c => c.primary_emotion === a[0])
        .reduce((s, c) => s + c.intensity, 0) / a[1];
      const avgB = allClassifications.filter(c => c.primary_emotion === b[0])
        .reduce((s, c) => s + c.intensity, 0) / b[1];
      if (avgB !== avgA) return avgB - avgA; // highest intensity
      return a[0].localeCompare(b[0]); // alphabetical
    });
    const consensusEmotion = sorted[0][0];
    const consensusResult = allClassifications.find(c => c.primary_emotion === consensusEmotion) || allClassifications[0];

    emotionMap.set(iv.interviewId, consensusResult);

    const sentiment = sentimentResults.find((s) => s.interviewId === iv.interviewId);
    await supabase.from('interview_analysis').insert({
      run_id: runId,
      interview_id: iv.interviewId,
      sentiment_scores: {
        ...sentiment?.scores,
        overall: sentiment?.overall,
        label: sentiment?.label,
      },
      primary_emotion: consensusResult.primary_emotion,
      secondary_emotion: consensusResult.secondary_emotion,
      emotion_intensity: consensusResult.intensity,
      emotion_reasoning: consensusResult.reasoning,
    });
  }

  // ── STAMP: Compute Krippendorff's alpha on emotion classifications ───

  await updateProgress(supabase, runId, 89, 'Computing emotion classification reliability (STAMP)...');

  // Build ratings matrices for primary_emotion and intensity
  const interviewIds = allInterviews.map(iv => iv.interviewId);
  const modelList = [...MODEL_IDS].sort();

  // Primary emotion alpha (nominal → treated as ordinal via index)
  const emotionRatings: (number | null)[][] = modelList.map(modelId =>
    interviewIds.map(ivId => {
      const cls = allEmotionResults.get(ivId)?.get(modelId);
      return cls ? (emotionToIndex[cls.primary_emotion] ?? null) : null;
    })
  );
  const { alpha: emotionAlpha } = krippendorffAlpha(emotionRatings);

  // Intensity alpha (ordinal 1-5)
  const intensityRatings: (number | null)[][] = modelList.map(modelId =>
    interviewIds.map(ivId => {
      const cls = allEmotionResults.get(ivId)?.get(modelId);
      return cls?.intensity ?? null;
    })
  );
  const { alpha: intensityAlpha } = krippendorffAlpha(intensityRatings);

  // Per-interview agreement detail
  const perInterviewAgreement: Record<string, unknown>[] = interviewIds.map(ivId => {
    const modelResults = allEmotionResults.get(ivId);
    const emotions = modelList.map(m => modelResults?.get(m)?.primary_emotion ?? 'unknown');
    const allSame = emotions.every(e => e === emotions[0]);
    return {
      interview_id: ivId,
      classifications: Object.fromEntries(modelList.map((m, i) => [MODEL_LABELS[m], emotions[i]])),
      unanimous: allSame,
    };
  });

  const unanimousCount = perInterviewAgreement.filter(p => p.unanimous).length;

  // Store STAMP emotion results in analysis_results
  await supabase.from('analysis_results').insert({
    run_id: runId,
    analysis_type: 'stamp_emotion_classification',
    results: {
      methodology: 'STAMP: 3-model independent emotion classification with codebook prompt',
      models: modelList.map(m => MODEL_LABELS[m]),
      emotion_alpha: Math.round(emotionAlpha * 10000) / 10000,
      emotion_interpretation: emotionAlpha >= 0.8 ? 'excellent' : emotionAlpha >= 0.667 ? 'acceptable' : emotionAlpha >= 0.4 ? 'moderate' : 'poor',
      emotion_passes_stamp: emotionAlpha >= 0.667,
      intensity_alpha: Math.round(intensityAlpha * 10000) / 10000,
      intensity_interpretation: intensityAlpha >= 0.8 ? 'excellent' : intensityAlpha >= 0.667 ? 'acceptable' : intensityAlpha >= 0.4 ? 'moderate' : 'poor',
      unanimous_classifications: unanimousCount,
      total_classifications: interviewIds.length,
      unanimous_rate: Math.round((unanimousCount / interviewIds.length) * 1000) / 10,
      per_interview: perInterviewAgreement,
    },
  });

  // ── Part B3: Theme extraction — 3-model STAMP ────────────────────────

  await updateProgress(supabase, runId, 92, 'Extracting themes (3-model STAMP)...');

  // Run theme extraction on all 3 models independently
  const themesByModel: Map<string, string[]> = new Map();
  const allThemeResults = await withConcurrency(
    MODEL_IDS.map((modelId) => async () => {
      const result = await extractThemesWithModel(apiKey, modelId, allInterviews);
      const themeNames = (result.themes || []).map((t: { theme_name: string }) => t.theme_name.toLowerCase().trim());
      themesByModel.set(modelId, themeNames);
      return { modelId, themes: result.themes || [] };
    }),
    MODEL_IDS.length,
  );

  // Persist themes from ALL models (not just the first)
  const allThemes: typeof allThemeResults[0]['themes'] = [];
  for (const { modelId, themes: modelThemes } of allThemeResults) {
    for (const theme of modelThemes) {
      await supabase.from('interview_themes').insert({
        run_id: runId,
        source: 'llm',
        theme_name: theme.theme_name,
        description: theme.description || null,
        frequency: theme.frequency || null,
        keywords: theme.keywords || null,
        supporting_quotes: theme.supporting_quotes || null,
        model: MODEL_LABELS[modelId],
      });
      allThemes.push(theme);
    }
  }
  const themes = allThemes;

  // Compute theme overlap: how many models identified similar themes
  const allModelThemes = allThemeResults.map(r => ({
    model: MODEL_LABELS[r.modelId],
    themes: (r.themes || []).map((t: { theme_name: string }) => t.theme_name),
  }));

  // Simple overlap metric: for each pair of models, count shared theme keywords
  const themeOverlap: Record<string, unknown>[] = [];
  for (let i = 0; i < allModelThemes.length; i++) {
    for (let j = i + 1; j < allModelThemes.length; j++) {
      const a = new Set(allModelThemes[i].themes.map((t: string) => t.toLowerCase()));
      const b = new Set(allModelThemes[j].themes.map((t: string) => t.toLowerCase()));
      const intersection = [...a].filter(x => b.has(x)).length;
      const union = new Set([...a, ...b]).size;
      const jaccard = union > 0 ? Math.round((intersection / union) * 1000) / 1000 : 0;
      themeOverlap.push({
        pair: `${allModelThemes[i].model} vs ${allModelThemes[j].model}`,
        shared: intersection,
        total_unique: union,
        jaccard_similarity: jaccard,
      });
    }
  }

  const avgJaccard = themeOverlap.length > 0
    ? Math.round((themeOverlap.reduce((s, o) => s + (o.jaccard_similarity as number), 0) / themeOverlap.length) * 1000) / 1000
    : 0;

  await supabase.from('analysis_results').insert({
    run_id: runId,
    analysis_type: 'stamp_theme_extraction',
    results: {
      methodology: 'STAMP: 3-model independent theme extraction with Jaccard overlap',
      models: allModelThemes.map(m => m.model),
      themes_per_model: allModelThemes.map(m => ({ model: m.model, count: m.themes.length, themes: m.themes })),
      pairwise_overlap: themeOverlap,
      average_jaccard: avgJaccard,
      interpretation: avgJaccard >= 0.5 ? 'strong_overlap' : avgJaccard >= 0.3 ? 'moderate_overlap' : 'weak_overlap',
    },
  });

  await updateProgress(supabase, runId, 100, 'Interviews and analysis complete', 'completed');

  return {
    interviewCount: allInterviews.length,
    sentimentSummary: {
      positive: sentimentResults.filter((s) => s.label === 'Positive').length,
      neutral: sentimentResults.filter((s) => s.label === 'Neutral').length,
      negative: sentimentResults.filter((s) => s.label === 'Negative').length,
    },
    themeCount: themes.length,
    totalTokens: _totalTokens,
    totalCost: _totalCost,
  };
}
