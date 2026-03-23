/**
 * Simplified VADER-like sentiment analysis for TypeScript.
 *
 * This is a lightweight port of the VADER sentiment analysis approach.
 * It uses a lexicon-based approach with valence scores for common words.
 * For a production system you would use the full VADER lexicon; this
 * covers the key terms relevant to consumer product research.
 */

import { VaderScores } from "@/lib/pipeline/types";

// Condensed sentiment lexicon (word → valence score, -4 to +4)
const LEXICON: Record<string, number> = {
  // Positive
  love: 3.2, great: 3.1, amazing: 3.1, awesome: 3.1, excellent: 3.2,
  fantastic: 3.1, wonderful: 3.0, perfect: 3.0, beautiful: 2.7, exciting: 2.8,
  excited: 2.7, happy: 2.7, enjoy: 2.0, good: 1.9, nice: 1.8, like: 1.5,
  interested: 1.8, convenient: 1.5, professional: 1.5, worth: 1.5, quality: 1.8,
  useful: 1.5, helpful: 1.5, comfortable: 1.8, affordable: 1.8, easy: 1.7,
  quick: 1.2, fast: 1.2, appeal: 1.8, attractive: 1.9, impressive: 2.2,
  innovative: 2.0, modern: 1.3, sleek: 1.5, clean: 1.3, smart: 1.8,
  value: 1.5, benefit: 1.5, ideal: 2.0, practical: 1.3, functional: 1.3,
  definitely: 1.2, absolutely: 1.8, sure: 0.8,
  // Negative
  hate: -3.0, terrible: -3.2, awful: -3.0, horrible: -3.1, bad: -2.5,
  expensive: -1.8, costly: -1.8, pricey: -1.5, overpriced: -2.2,
  concern: -1.3, worried: -1.8, worry: -1.5, fear: -2.0, afraid: -1.8,
  doubt: -1.5, skeptical: -1.5, hesitant: -1.2, uncertain: -1.3,
  difficult: -1.5, hard: -0.8, problem: -1.8, issue: -1.5, restriction: -1.3,
  restrict: -1.3, frustrating: -2.2, frustrated: -2.0, annoying: -1.8,
  disappoint: -2.0, disappointing: -2.2, disappointed: -2.0,
  ugly: -2.5, cheap: -1.5, flimsy: -2.0, small: -0.5, tiny: -0.8,
  cramped: -1.5, noisy: -1.3, hot: -0.3, cold: -0.3,
  never: -1.0, no: -0.5, not: -0.7, cant: -0.8, wont: -0.8, dont: -0.5,
  dealbreaker: -2.5, barrier: -1.5,
};

// Booster words amplify or dampen the next sentiment word
const BOOSTERS: Record<string, number> = {
  very: 0.293, really: 0.293, extremely: 0.293, absolutely: 0.293,
  incredibly: 0.293, so: 0.293, totally: 0.293, especially: 0.293,
  somewhat: -0.293, slightly: -0.293, barely: -0.293, hardly: -0.293,
  kind: -0.293, sort: -0.293,
};

const NEGATIONS = new Set([
  "not", "no", "never", "neither", "nor", "none", "nobody",
  "nothing", "nowhere", "hardly", "barely", "scarcely",
  "dont", "doesnt", "didnt", "isnt", "wasnt", "arent",
  "werent", "wont", "wouldnt", "shouldnt", "couldnt", "cant",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function normalizeScore(score: number, alpha = 15): number {
  return score / Math.sqrt(score * score + alpha);
}

/**
 * Compute VADER-like sentiment scores for a text string.
 */
export function vaderSentiment(text: string): VaderScores {
  const tokens = tokenize(text);
  const sentiments: number[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    let valence = LEXICON[word];

    if (valence === undefined) continue;

    // Check for negation in prior 3 words
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATIONS.has(tokens[j])) {
        valence *= -0.74;
        break;
      }
    }

    // Check for booster in prior word
    if (i > 0) {
      const booster = BOOSTERS[tokens[i - 1]];
      if (booster !== undefined) {
        valence += valence > 0 ? booster : -booster;
      }
    }

    sentiments.push(valence);
  }

  if (sentiments.length === 0) {
    return { neg: 0, neu: 1, pos: 0, compound: 0 };
  }

  const sum = sentiments.reduce((a, b) => a + b, 0);
  const compound = Number(normalizeScore(sum).toFixed(4));

  let posSum = 0;
  let negSum = 0;
  let neuCount = 0;

  for (const s of sentiments) {
    if (s > 0.05) posSum += s;
    else if (s < -0.05) negSum += Math.abs(s);
    else neuCount++;
  }

  const total = posSum + negSum + neuCount;
  const pos = total > 0 ? Number((posSum / total).toFixed(3)) : 0;
  const neg = total > 0 ? Number((negSum / total).toFixed(3)) : 0;
  const neu = total > 0 ? Number((1 - pos - neg).toFixed(3)) : 1;

  return { neg, neu, pos, compound };
}

/** Alias for vaderSentiment — used by seed.ts */
export const sentimentScores = vaderSentiment;

/** Classify compound score as Positive, Negative, or Neutral */
export function sentimentLabel(compound: number): "Positive" | "Negative" | "Neutral" {
  if (compound > 0.05) return "Positive";
  if (compound < -0.05) return "Negative";
  return "Neutral";
}
