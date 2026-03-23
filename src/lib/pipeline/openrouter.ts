// ============================================================================
// OpenRouter API Client — TypeScript port of Python call_openrouter + parse_json_response
// Uses native fetch() (available in Next.js server context)
// ============================================================================

import type {
  OpenRouterConfig,
  OpenRouterRequest,
  OpenRouterResponse,
} from './types';
import {
  OPENROUTER_URL,
  MAX_RETRIES,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  REQUEST_TIMEOUT_MS,
} from './constants';

export interface CallOpenRouterOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Call the OpenRouter API with retry logic and exponential backoff.
 *
 * - Sets response_format: json_object for OpenAI and Anthropic models (not Gemini)
 * - Retries up to MAX_RETRIES (3) times with exponential backoff
 * - 120s timeout per request
 */
export async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: CallOpenRouterOptions,
): Promise<string> {
  const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;

  const body: OpenRouterRequest = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  // GPT and Claude support response_format; Gemini does not
  if (model.startsWith('openai/') || model.startsWith('anthropic/')) {
    body.response_format = { type: 'json_object' };
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown error');
        throw new Error(
          `OpenRouter API error ${response.status}: ${errorText}`,
        );
      }

      const data = (await response.json()) as OpenRouterResponse;

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('OpenRouter returned empty response');
      }

      return data.choices[0].message.content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES - 1) {
        // Exponential backoff with jitter: 2^attempt + random(0,1)
        const wait = Math.min(65, Math.pow(2, attempt) + Math.random());
        console.warn(
          `OpenRouter retry ${attempt + 1}/${MAX_RETRIES} for ${model}: ${lastError.message}. Waiting ${wait.toFixed(1)}s`,
        );
        await sleep(wait * 1000);
      }
    }
  }

  throw new Error(
    `OpenRouter call failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
  );
}

/**
 * Parse JSON from an LLM response, handling:
 * 1. Direct JSON parse
 * 2. Markdown fence stripping (```json ... ```)
 * 3. Regex extraction of first {...} block
 */
export function parseJsonResponse<T = Record<string, unknown>>(raw: string): T {
  // Attempt 1: direct parse
  try {
    return JSON.parse(raw) as T;
  } catch {
    // continue to next strategy
  }

  // Attempt 2: strip markdown fences
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
  cleaned = cleaned.replace(/\n?```\s*$/, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // continue to next strategy
  }

  // Attempt 3: regex extract first {...}
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      // fall through
    }
  }

  throw new Error(
    `Could not parse JSON from response: ${raw.slice(0, 200)}`,
  );
}

/**
 * Call OpenRouter and parse the response as JSON in one step.
 */
export async function callOpenRouterJson<T = Record<string, unknown>>(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: CallOpenRouterOptions,
): Promise<T> {
  const raw = await callOpenRouter(apiKey, model, systemPrompt, userPrompt, options);
  return parseJsonResponse<T>(raw);
}

/**
 * Create a configured OpenRouter caller with a bound API key and model.
 * Useful for pipeline stages that make many calls with the same config.
 */
export function createOpenRouterClient(config: OpenRouterConfig) {
  return {
    call: (systemPrompt: string, userPrompt: string, options?: CallOpenRouterOptions) =>
      callOpenRouter(config.apiKey, config.model, systemPrompt, userPrompt, {
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        ...options,
      }),

    callJson: <T = Record<string, unknown>>(
      systemPrompt: string,
      userPrompt: string,
      options?: CallOpenRouterOptions,
    ) =>
      callOpenRouterJson<T>(config.apiKey, config.model, systemPrompt, userPrompt, {
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        ...options,
      }),
  };
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
