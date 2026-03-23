/**
 * Deterministic demo data seeder for the AYTM Research Pipeline.
 * Generates all 6 stages of data without API calls.
 * Ported from generate_test_data.py and generate_test_interviews.py.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { sentimentScores, sentimentLabel } from "@/lib/pipeline/vader";
import {
  MODEL_IDS,
  MODEL_LABELS,
  DISCOVERY_QUESTIONS,
  INTERVIEW_PERSONAS,
  INTERVIEW_QUESTIONS,
  INTERVIEW_RESPONSE_KEYS,
} from "@/lib/pipeline/constants";
import type { InterviewPersona, DiscoveryBrief } from "@/lib/pipeline/types";

// ─── Seeded PRNG (Mulberry32) ───────────────────────────────────────────────

class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 1;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Gaussian via Box-Muller */
  gauss(mean: number, sd: number): number {
    const u1 = this.next();
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
    return mean + z * sd;
  }

  /** Pick uniformly from array */
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted random choice */
  choices<T>(arr: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }

  /** Random int in [min, max] inclusive */
  randint(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// ─── Deterministic hash for seeding ──────────────────────────────────────────

function seedHash(...args: (string | number | null)[]): number {
  let h = 0x811c9dc5;
  const str = args.map((a) => String(a ?? "null")).join("|");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ─── Segment definitions (from segments.py) ──────────────────────────────────

interface Segment {
  id: number;
  name: string;
  demographics: Record<string, string | string[]>;
}

const SEGMENTS: Segment[] = [
  {
    id: 1, name: "Remote Professional",
    demographics: { Q21: "25-34", Q22: "$100,000-$149,999", Q23: "I work remotely full-time (5 days/week from home)", Q24: ["Yes", "No"], Q25: "About once a month", Q26: "No" },
  },
  {
    id: 2, name: "Active Adventurer",
    demographics: { Q21: "25-34", Q22: "$75,000-$99,999", Q23: "I work on-site / in-person full-time", Q24: ["No", "I'm not sure"], Q25: "Weekly or more", Q26: "Yes" },
  },
  {
    id: 3, name: "Wellness Seeker",
    demographics: { Q21: "35-44", Q22: "$100,000-$149,999", Q23: "I work a hybrid schedule (at least part of my week is remote)", Q24: ["Yes", "No"], Q25: "2-3 times per month", Q26: "No" },
  },
  {
    id: 4, name: "Property Maximizer",
    demographics: { Q21: "45-54", Q22: "$150,000-$199,999", Q23: "I work on-site / in-person full-time", Q24: ["Yes", "No"], Q25: "A few times a year", Q26: "No" },
  },
  {
    id: 5, name: "Budget-Conscious DIYer",
    demographics: { Q21: "25-34", Q22: "$50,000-$74,999", Q23: "I work on-site / in-person full-time", Q24: ["No", "I'm not sure"], Q25: "A few times a year", Q26: "No" },
  },
];

// ─── Demographic variation options (from segments.py) ────────────────────────

const AGE_OPTIONS: Record<number, string[]> = {
  1: ["25-34", "35-44"], 2: ["25-34", "35-44"], 3: ["35-44", "45-54"],
  4: ["45-54", "55-64"], 5: ["25-34", "35-44"],
};

const INCOME_OPTIONS: Record<number, string[]> = {
  1: ["$100,000-$149,999", "$150,000-$199,999"],
  2: ["$75,000-$99,999", "$100,000-$149,999"],
  3: ["$100,000-$149,999", "$150,000-$199,999"],
  4: ["$150,000-$199,999", "$200,000 or more"],
  5: ["$50,000-$74,999", "$75,000-$99,999"],
};

const WORK_OPTIONS: Record<number, string[]> = {
  1: ["I work remotely full-time (5 days/week from home)", "I work a hybrid schedule (at least part of my week is remote)"],
  2: ["I work on-site / in-person full-time", "I work a hybrid schedule (at least part of my week is remote)"],
  3: ["I work a hybrid schedule (at least part of my week is remote)", "I am self-employed / freelance (primarily work from home)"],
  4: ["I work on-site / in-person full-time", "I am retired"],
  5: ["I work on-site / in-person full-time", "I work a hybrid schedule (at least part of my week is remote)"],
};

const OUTDOOR_OPTIONS: Record<number, string[]> = {
  3: ["About once a month", "2-3 times per month"],
  5: ["A few times a year", "About once a month"],
};

function getRespondentDemographics(segmentId: number, respondentIndex: number, modelId: string): Record<string, string> {
  const rng = new SeededRNG(seedHash(segmentId, respondentIndex, modelId));
  const segment = SEGMENTS.find((s) => s.id === segmentId)!;
  const demo: Record<string, string> = {};

  demo.Q21 = rng.choice(AGE_OPTIONS[segmentId]);
  demo.Q22 = rng.choice(INCOME_OPTIONS[segmentId]);
  demo.Q23 = rng.choice(WORK_OPTIONS[segmentId]);

  const q24 = segment.demographics.Q24;
  demo.Q24 = Array.isArray(q24) ? rng.choice(q24) : q24;
  demo.Q25 = OUTDOOR_OPTIONS[segmentId] ? rng.choice(OUTDOOR_OPTIONS[segmentId]) : segment.demographics.Q25 as string;
  demo.Q26 = segment.demographics.Q26 as string;

  return demo;
}

// ─── Segment profiles (from generate_test_data.py) ───────────────────────────

type LikertProfile = [number, number]; // [mean, spread]

interface SegmentProfile {
  Q0a: string[];
  Q0b: LikertProfile; Q1: LikertProfile; Q2: LikertProfile;
  Q3: string[];
  Q5_cost: LikertProfile; Q5_hoa: LikertProfile; Q5_permit: LikertProfile;
  Q5_space: LikertProfile; Q5_financing: LikertProfile; Q5_quality: LikertProfile; Q5_resale: LikertProfile;
  Q6: string[];
  Q7: LikertProfile;
  Q9a: LikertProfile; Q9b: LikertProfile;
  Q10a: LikertProfile; Q10b: LikertProfile;
  Q11a: LikertProfile; Q11b: LikertProfile;
  Q12a: LikertProfile; Q12b: LikertProfile;
  Q13a: LikertProfile; Q13b: LikertProfile;
  Q14: string[];
  Q15: LikertProfile; Q16: LikertProfile; Q17: LikertProfile;
  Q18: string[];
  Q19: LikertProfile;
  Q20: string[][];
}

const SEGMENT_PROFILES: Record<number, SegmentProfile> = {
  1: {
    Q0a: ["Yes, I have thought about it but not researched it", "I'm aware it's possible but haven't seriously considered it"],
    Q0b: [3.8, 0.8], Q1: [3.9, 0.7], Q2: [3.3, 0.9],
    Q3: ["Home office / remote workspace", "Home office / remote workspace", "Home office / remote workspace", "Home office / remote workspace", "Home office / remote workspace", "Creative studio (music, podcast, art)"],
    Q5_cost: [2.5, 0.9], Q5_hoa: [3.2, 1.0], Q5_permit: [2.8, 0.9],
    Q5_space: [2.2, 0.8], Q5_financing: [2.0, 0.7], Q5_quality: [2.4, 0.8], Q5_resale: [2.6, 0.9],
    Q6: ["HOA restrictions or community rules", "HOA restrictions or community rules", "HOA restrictions or community rules", "The total cost (~$23,000)", "The total cost (~$23,000)", "Uncertainty about whether a building permit is required"],
    Q7: [4.0, 0.7],
    Q9a: [4.3, 0.6], Q9b: [3.8, 0.7],
    Q10a: [2.8, 0.9], Q10b: [2.4, 0.8],
    Q11a: [3.0, 0.8], Q11b: [2.6, 0.9],
    Q12a: [2.2, 0.8], Q12b: [1.9, 0.7],
    Q13a: [3.8, 0.7], Q13b: [3.4, 0.8],
    Q14: ["Concept 1: Backyard Home Office", "Concept 1: Backyard Home Office", "Concept 1: Backyard Home Office", "Concept 1: Backyard Home Office", "Concept 5: Message-First", "Concept 5: Message-First"],
    Q15: [3.9, 0.7], Q16: [3.5, 0.8], Q17: [3.8, 0.7],
    Q18: ["Permit-light positioning", "Permit-light positioning", "Permit-light positioning", "Build quality and details", "Build quality and details", "Installation speed"],
    Q19: [2.8, 0.8],
    Q20: [
      ["Social media ads (Facebook, Instagram)", "Google / Search ads"],
      ["Google / Search ads", "Friend / family referral"],
      ["Social media ads (Facebook, Instagram)", "Home improvement expos"],
      ["Google / Search ads"],
      ["Friend / family referral", "Social media ads (Facebook, Instagram)"],
      ["Home improvement expos", "Google / Search ads"],
    ],
  },
  2: {
    Q0a: ["I'm aware it's possible but haven't seriously considered it", "No, I have never considered this", "Yes, I have thought about it but not researched it"],
    Q0b: [3.2, 0.9], Q1: [3.4, 0.8], Q2: [2.8, 0.9],
    Q3: ["Adventure basecamp (gear storage, bike workshop, hangout space)", "Adventure basecamp (gear storage, bike workshop, hangout space)", "Adventure basecamp (gear storage, bike workshop, hangout space)", "Adventure basecamp (gear storage, bike workshop, hangout space)", "General storage / premium speed shed", "Creative studio (music, podcast, art)"],
    Q5_cost: [3.5, 0.8], Q5_hoa: [2.5, 0.9], Q5_permit: [2.3, 0.8],
    Q5_space: [2.8, 0.9], Q5_financing: [3.2, 0.8], Q5_quality: [2.6, 0.8], Q5_resale: [2.4, 0.9],
    Q6: ["The total cost (~$23,000)", "The total cost (~$23,000)", "The total cost (~$23,000)", "Lack of financing options", "Lack of financing options", "Limited backyard space or access"],
    Q7: [3.6, 0.8],
    Q9a: [2.5, 0.8], Q9b: [2.2, 0.8],
    Q10a: [2.3, 0.9], Q10b: [2.0, 0.8],
    Q11a: [2.8, 0.8], Q11b: [2.4, 0.8],
    Q12a: [4.4, 0.5], Q12b: [3.9, 0.7],
    Q13a: [3.2, 0.8], Q13b: [2.8, 0.9],
    Q14: ["Concept 4: Adventure Lifestyle / Community", "Concept 4: Adventure Lifestyle / Community", "Concept 4: Adventure Lifestyle / Community", "Concept 4: Adventure Lifestyle / Community", "Concept 4: Adventure Lifestyle / Community", "Concept 3: Wellness / Studio Space"],
    Q15: [3.2, 0.8], Q16: [3.6, 0.7], Q17: [3.4, 0.8],
    Q18: ["Installation speed", "Installation speed", "Installation speed", "Build quality and details", "Build quality and details", "Permit-light positioning"],
    Q19: [4.2, 0.6],
    Q20: [
      ["Outdoor club sponsorships / community events", "Social media ads (Facebook, Instagram)"],
      ["Outdoor club sponsorships / community events", "Friend / family referral"],
      ["Social media ads (Facebook, Instagram)", "Outdoor club sponsorships / community events"],
      ["Outdoor club sponsorships / community events"],
      ["Friend / family referral", "Outdoor club sponsorships / community events"],
      ["Social media ads (Facebook, Instagram)", "Friend / family referral"],
    ],
  },
  3: {
    Q0a: ["Yes, I have thought about it but not researched it", "I'm aware it's possible but haven't seriously considered it"],
    Q0b: [3.6, 0.8], Q1: [3.7, 0.7], Q2: [3.1, 0.9],
    Q3: ["Wellness studio (gym, yoga, meditation)", "Wellness studio (gym, yoga, meditation)", "Wellness studio (gym, yoga, meditation)", "Wellness studio (gym, yoga, meditation)", "Creative studio (music, podcast, art)", "Home office / remote workspace"],
    Q5_cost: [2.8, 0.8], Q5_hoa: [3.0, 0.9], Q5_permit: [2.6, 0.8],
    Q5_space: [2.5, 0.8], Q5_financing: [2.3, 0.7], Q5_quality: [2.8, 0.8], Q5_resale: [2.5, 0.8],
    Q6: ["HOA restrictions or community rules", "HOA restrictions or community rules", "The total cost (~$23,000)", "The total cost (~$23,000)", "Concerns about build quality or durability", "None — I have no significant concerns"],
    Q7: [3.8, 0.7],
    Q9a: [3.2, 0.8], Q9b: [2.8, 0.8],
    Q10a: [2.6, 0.9], Q10b: [2.3, 0.8],
    Q11a: [4.5, 0.5], Q11b: [4.0, 0.6],
    Q12a: [2.6, 0.8], Q12b: [2.2, 0.8],
    Q13a: [3.5, 0.7], Q13b: [3.1, 0.8],
    Q14: ["Concept 3: Wellness / Studio Space", "Concept 3: Wellness / Studio Space", "Concept 3: Wellness / Studio Space", "Concept 3: Wellness / Studio Space", "Concept 1: Backyard Home Office", "Concept 5: Message-First"],
    Q15: [3.6, 0.7], Q16: [3.3, 0.8], Q17: [4.0, 0.6],
    Q18: ["Build quality and details", "Build quality and details", "Build quality and details", "Build quality and details", "Permit-light positioning", "Installation speed"],
    Q19: [3.2, 0.8],
    Q20: [
      ["Social media ads (Facebook, Instagram)", "Friend / family referral"],
      ["Home improvement expos", "Social media ads (Facebook, Instagram)"],
      ["Friend / family referral", "Social media ads (Facebook, Instagram)"],
      ["Social media ads (Facebook, Instagram)"],
      ["Google / Search ads", "Friend / family referral"],
      ["Home improvement expos", "Friend / family referral"],
    ],
  },
  4: {
    Q0a: ["Yes, I have actively researched or priced options", "Yes, I have thought about it but not researched it"],
    Q0b: [4.0, 0.7], Q1: [4.1, 0.6], Q2: [3.6, 0.8],
    Q3: ["Guest suite / short-term rental (STR) income", "Guest suite / short-term rental (STR) income", "Guest suite / short-term rental (STR) income", "Guest suite / short-term rental (STR) income", "Guest suite / short-term rental (STR) income", "Home office / remote workspace"],
    Q5_cost: [1.8, 0.7], Q5_hoa: [3.8, 0.7], Q5_permit: [3.5, 0.8],
    Q5_space: [1.6, 0.6], Q5_financing: [1.5, 0.5], Q5_quality: [3.0, 0.8], Q5_resale: [3.4, 0.8],
    Q6: ["HOA restrictions or community rules", "HOA restrictions or community rules", "HOA restrictions or community rules", "Uncertainty about whether a building permit is required", "Uncertainty about whether a building permit is required", "Uncertainty about resale value"],
    Q7: [4.2, 0.6],
    Q9a: [3.0, 0.8], Q9b: [2.6, 0.8],
    Q10a: [4.4, 0.5], Q10b: [4.0, 0.6],
    Q11a: [2.4, 0.8], Q11b: [2.0, 0.7],
    Q12a: [1.8, 0.7], Q12b: [1.5, 0.5],
    Q13a: [3.6, 0.7], Q13b: [3.2, 0.8],
    Q14: ["Concept 2: Guest Suite / STR Income", "Concept 2: Guest Suite / STR Income", "Concept 2: Guest Suite / STR Income", "Concept 2: Guest Suite / STR Income", "Concept 2: Guest Suite / STR Income", "Concept 5: Message-First"],
    Q15: [4.0, 0.6], Q16: [3.8, 0.7], Q17: [4.2, 0.5],
    Q18: ["Build quality and details", "Build quality and details", "Build quality and details", "Permit-light positioning", "Permit-light positioning", "Installation speed"],
    Q19: [2.4, 0.8],
    Q20: [
      ["Real estate partner referrals", "Home improvement expos"],
      ["Google / Search ads", "Real estate partner referrals"],
      ["Home improvement expos", "Real estate partner referrals"],
      ["Real estate partner referrals"],
      ["Home improvement expos", "Google / Search ads"],
      ["Real estate partner referrals", "Friend / family referral"],
    ],
  },
  5: {
    Q0a: ["I'm aware it's possible but haven't seriously considered it", "No, I have never considered this"],
    Q0b: [2.8, 0.9], Q1: [2.6, 0.9], Q2: [2.1, 0.8],
    Q3: ["General storage / premium speed shed", "General storage / premium speed shed", "General storage / premium speed shed", "Creative studio (music, podcast, art)", "Creative studio (music, podcast, art)", "Children's playroom"],
    Q5_cost: [4.3, 0.6], Q5_hoa: [2.4, 0.9], Q5_permit: [2.8, 0.8],
    Q5_space: [3.0, 0.9], Q5_financing: [4.0, 0.7], Q5_quality: [3.2, 0.8], Q5_resale: [3.0, 0.9],
    Q6: ["The total cost (~$23,000)", "The total cost (~$23,000)", "The total cost (~$23,000)", "Lack of financing options", "Lack of financing options", "Limited backyard space or access"],
    Q7: [3.8, 0.7],
    Q9a: [2.6, 0.8], Q9b: [2.2, 0.8],
    Q10a: [2.2, 0.8], Q10b: [1.8, 0.7],
    Q11a: [2.4, 0.8], Q11b: [2.0, 0.7],
    Q12a: [2.2, 0.8], Q12b: [1.8, 0.7],
    Q13a: [4.0, 0.6], Q13b: [3.5, 0.8],
    Q14: ["Concept 5: Message-First", "Concept 5: Message-First", "Concept 5: Message-First", "Concept 5: Message-First", "Concept 1: Backyard Home Office", "None of the above"],
    Q15: [4.2, 0.6], Q16: [3.8, 0.7], Q17: [3.0, 0.8],
    Q18: ["Permit-light positioning", "Permit-light positioning", "Permit-light positioning", "Permit-light positioning", "Installation speed", "Installation speed"],
    Q19: [2.6, 0.9],
    Q20: [
      ["Google / Search ads", "Social media ads (Facebook, Instagram)"],
      ["Social media ads (Facebook, Instagram)", "Friend / family referral"],
      ["Google / Search ads"],
      ["Friend / family referral", "Google / Search ads"],
      ["Social media ads (Facebook, Instagram)"],
      ["Home improvement expos", "Google / Search ads"],
    ],
  },
};

const MODEL_BIAS: Record<string, number> = {
  "GPT-4.1-mini": 0.15,
  "Gemini-2.5-Flash": -0.10,
  "Claude-Sonnet-4": 0.05,
};

const S3_OPTIONS = ["Yes", "I'm not sure, but possibly"];

// ─── Stage 4: Likert helper ──────────────────────────────────────────────────

function likert(mean: number, spread: number, rng: SeededRNG, modelLabel: string): number {
  const val = rng.gauss(mean + (MODEL_BIAS[modelLabel] ?? 0), spread);
  return Math.max(1, Math.min(5, Math.round(val)));
}

// ─── Interview tendencies (from generate_test_interviews.py) ─────────────────

interface Tendency {
  responses: Record<string, string[]>;
  primary_emotion: string;
  secondary_emotion: string | null;
  emotion_intensity: number;
}

const TENDENCY_KEYWORDS: Record<string, string[]> = {
  "remote-worker": ["remote", "work from home", "software", "video calls", "editing suite", "soundproof", "accounting", "tech lead", "accountant"],
  "active-lifestyle": ["bik", "trail", "surf", "climb", "outdoor", "fitness", "coach", "gear"],
  "wellness": ["yoga", "meditat", "journal", "sanctuary", "decompression", "wellness", "birdwatch"],
  "investment": ["real estate", "property", "e-commerce", "inventory", "entertain", "client", "executive", "rental"],
  "practical-value": ["DIY", "budget", "craft", "gamer", "stream", "musician", "guitar", "Etsy", "tutor"],
};

function assignTendency(persona: InterviewPersona): string {
  const note = (persona.lifestyle_note + " " + persona.work_arrangement).toLowerCase();
  for (const [tendency, keywords] of Object.entries(TENDENCY_KEYWORDS)) {
    for (const kw of keywords) {
      if (note.includes(kw.toLowerCase())) return tendency;
    }
  }
  return "practical-value";
}

const SENTIMENT_BASELINES: Record<string, Record<string, number>> = {
  "remote-worker": { IQ1: -0.1, IQ2: -0.3, IQ3: -0.2, IQ4: 0.7, IQ5: -0.2, IQ6: 0.6, IQ7: 0.1, IQ8: 0.1 },
  "active-lifestyle": { IQ1: 0.5, IQ2: -0.1, IQ3: -0.1, IQ4: 0.8, IQ5: 0.3, IQ6: 0.3, IQ7: 0.0, IQ8: 0.5 },
  "wellness": { IQ1: 0.4, IQ2: -0.2, IQ3: -0.2, IQ4: 0.8, IQ5: -0.1, IQ6: 0.7, IQ7: 0.2, IQ8: 0.4 },
  "investment": { IQ1: 0.2, IQ2: -0.1, IQ3: -0.3, IQ4: 0.6, IQ5: 0.3, IQ6: 0.5, IQ7: 0.1, IQ8: 0.0 },
  "practical-value": { IQ1: 0.0, IQ2: -0.3, IQ3: -0.2, IQ4: 0.5, IQ5: -0.1, IQ6: 0.2, IQ7: -0.1, IQ8: 0.0 },
};

const TENDENCY_EMOTIONS: Record<string, { primary: string; secondary: string | null; intensity: number }> = {
  "remote-worker": { primary: "excitement", secondary: "frustration", intensity: 4 },
  "active-lifestyle": { primary: "curiosity", secondary: "skepticism", intensity: 3 },
  "wellness": { primary: "aspiration", secondary: "anxiety", intensity: 4 },
  "investment": { primary: "pragmatism", secondary: null, intensity: 3 },
  "practical-value": { primary: "pragmatism", secondary: "anxiety", intensity: 3 },
};

// Simplified response templates per tendency per question
const TENDENCY_RESPONSES: Record<string, Record<string, string[]>> = {
  "remote-worker": {
    IQ1: [
      "My backyard is decent but I rarely use it during work hours. I mostly see it through the window while I'm on calls. It feels like wasted potential honestly.",
      "I have a backyard that I enjoy on weekends. During the week it just sits there while I'm stuck inside working. I feel guilty not using it more.",
    ],
    IQ2: [
      "My biggest unmet need is a proper workspace. I'm currently working from the dining table and it's not ideal. The noise is constant. I desperately need a dedicated, quiet office space.",
      "I need separation between work and home. Right now my desk is in a shared space and I can hear everything. When I'm on video calls it's embarrassing.",
    ],
    IQ3: [
      "I've definitely thought about it — probably looked at those prefab office pods online a dozen times. The cost always held me back though. And I wasn't sure about permits in my area.",
      "Yeah, I've researched backyard offices before. I even got a quote from a local contractor once. It was way more than I expected — like $40K+. So I shelved the idea.",
    ],
    IQ4: [
      "A home office, no question. I'd set up my standing desk, dual monitors, and finally have a door I can close. The commute would be 30 seconds across the yard.",
      "I'd make it my dedicated work studio immediately. I'd soundproof it, add good lighting, and set up my equipment. It would transform my work-from-home experience.",
    ],
    IQ5: [
      "I struggle with boundaries honestly. Working from home means I'm never really 'off.' Having a physical boundary like a separate structure would be life-changing.",
      "I try to keep boundaries but it's hard. My workspace is shared so there's always overlap. I don't have a dedicated workspace — more like a corner I've claimed.",
    ],
    IQ6: [
      "$23K is less than I expected for something like this! One-day installation is amazing. The permit-light part is clutch because that was my biggest worry. I'm genuinely excited.",
      "My immediate reaction is positive. The price point feels reasonable compared to contractors. One-day install means minimal disruption to my work schedule.",
    ],
    IQ7: [
      "I'd need to know it's well-insulated and can handle weather. Good electrical for my equipment is non-negotiable. If the HOA blocks it, that's a dealbreaker.",
      "Financing options would help — $23K is doable but not easy to drop all at once. I'd need good WiFi connectivity from the main house.",
    ],
    IQ8: [
      "Sponsorship wouldn't really affect me either way. I'd probably find something like this through a targeted ad or a work-from-home forum. Word of mouth would be most convincing.",
      "I'm neutral on sponsorship but it wouldn't hurt. I'd trust a review from another remote worker more than any ad.",
    ],
    additional_thoughts: [
      "The remote work shift is permanent for me. Companies that solve the home office problem well are going to do great.",
      "I've been waiting for a product like this. The ADU trend priced me out but this size and price make sense.",
    ],
  },
  "active-lifestyle": {
    IQ1: [
      "My backyard is my staging area. I've got bikes leaning against the fence, a cooler always ready. It's where I prep for weekend rides. It's chaotic but I love it.",
      "I use my backyard constantly — stretching before runs, hosing off gear, hanging out after a ride. It's functional but not organized.",
    ],
    IQ2: [
      "Gear storage is my number one issue. My garage is packed and I can't fit my car in there anymore. I need a place to store bikes, boards, camping gear — all of it.",
      "I need a dedicated space for my outdoor equipment. Right now it's spread between the garage, a shed, and the living room.",
    ],
    IQ3: [
      "I've looked at sheds from Home Depot but they feel flimsy. A real structure with power and lighting would be awesome. Cost and effort held me back.",
      "I actually started building a shed once but ran out of time and motivation halfway through. I'd love something turnkey.",
    ],
    IQ4: [
      "A gear basecamp — bike workshop with a stand, tool wall, and space to wrench. Maybe a small fridge for post-ride beers. It would be my happy place.",
      "Half workshop, half hangout. Pegboard for tools, rack for bikes, and a bench to sit and plan the next adventure.",
    ],
    IQ5: [
      "I work on-site so the boundaries are pretty clear. I don't really need an office — I need a workshop. My garage is my current workspace for gear and it's overflowing.",
      "Work boundaries aren't my issue — activity space boundaries are. My gear takes over the house.",
    ],
    IQ6: [
      "Interesting. $23K is real money but not crazy. One-day install is cool. My concern is whether 120 sq ft is big enough. Can I customize the interior?",
      "The speed is appealing — I'm impatient with projects. $23K is steep for my budget though. I'm curious about the build quality.",
    ],
    IQ7: [
      "Price would need to come with financing. I'd want to see that it can handle real use — not just a pretty garden office. Heavy-duty flooring and ventilation are musts.",
      "I'd need to see one in real life with a workshop setup. If it's just marketed as a home office, I'd skip it. Show me it can be a basecamp.",
    ],
    IQ8: [
      "Outdoor event sponsorship would actually impress me. If I saw this at a mountain bike event or a trail running expo, I'd stop and look.",
      "Yeah, if they sponsored my local cycling club or a trail race, I'd notice. That shows they understand the customer.",
    ],
    additional_thoughts: [
      "I think there's a huge market for people like me who need gear space, not office space. Don't just market this as a home office.",
      "My dream is a backyard that's functional, not just pretty. If this product delivers on durability and customization, I'm interested.",
    ],
  },
  "wellness": {
    IQ1: [
      "My backyard is my escape. I do yoga out there when the weather is nice. It's peaceful but I can still hear the neighbors. I wish it felt more private.",
      "I love my backyard but it's not set up for what I really want. I use it for morning meditation when I can, but it's not comfortable year-round.",
    ],
    IQ2: [
      "I need a dedicated wellness space — somewhere I can practice yoga, meditate, or just breathe without interruption. I crave a personal sanctuary.",
      "My biggest need is privacy and calm. I don't have a room where I can close the door and do my practice. A separate space would be transformative.",
    ],
    IQ3: [
      "I've thought about converting the garage but it's too hot in summer. A yoga studio in the backyard has been my Pinterest board dream for years.",
      "I looked into building a she-shed or a yoga studio. The quotes were $30K-$50K and that felt insane. I gave up but the desire never went away.",
    ],
    IQ4: [
      "A wellness studio — bamboo flooring, natural light, a little altar for meditation. I'd do my morning yoga there rain or shine.",
      "A personal retreat for mind and body. I'd set up my yoga mat permanently, add some plants, soft lighting. Having a dedicated space would make my practice consistent.",
    ],
    IQ5: [
      "I'm home a lot. The boundaries blur constantly. I don't have a dedicated workspace and honestly, work isn't the issue — it's having no space for ME.",
      "Boundaries are a constant struggle. I need a space that's exclusively mine — not the office, not the kids' area, mine. For wellness and creative renewal.",
    ],
    IQ6: [
      "$23K is an investment I could see making for my wellbeing. One-day installation is wonderful. My concern is aesthetics — can I make it feel warm and inviting?",
      "My heart says yes. The concept is exactly what I've been wanting. $23K is less than contractor quotes I got before. My worry is about climate control.",
    ],
    IQ7: [
      "It needs to feel like a sanctuary, not a shed. Good insulation, climate control, and natural light are non-negotiable. I'd want to see material quality in person.",
      "I'd need to feel confident it's well-built and beautiful. Financing would make it easier to commit. I'd want testimonials from people using it for wellness.",
    ],
    IQ8: [
      "Community event sponsorship would resonate with me — especially wellness events, farmers markets, or yoga festivals. I trust my wellness community more than ads.",
      "If they sponsored a local wellness retreat or meditation event, I'd feel aligned with the brand.",
    ],
    additional_thoughts: [
      "There's a growing movement of people who want wellness spaces at home. The pandemic made us realize how important personal sanctuaries are.",
      "I think the wellness angle is undersold in the backyard structure market. A personal retreat space speaks to something deeper.",
    ],
  },
  "investment": {
    IQ1: [
      "My backyard is large. I see it as an asset. I maintain it well because property value matters to me. But I always think about how to get more ROI from the space.",
      "I have a well-maintained backyard. I think about my property as an investment portfolio. The backyard is underutilized square footage.",
    ],
    IQ2: [
      "I need a guest space. When family visits, we're cramped. A flexible space that could be a guest suite or an Airbnb unit would be ideal.",
      "I want to maximize my property's potential. Additional livable space — for guests, for rental income — is my biggest need.",
    ],
    IQ3: [
      "I've researched ADUs extensively. The $100K+ cost and 6-month timeline killed my interest. I want something simpler, faster, and more affordable.",
      "I've had contractors out to quote an ADU. Minimum $80K, 4-6 months. I've been waiting for a better option.",
    ],
    IQ4: [
      "A guest suite that could double as an Airbnb. I'd put in a murphy bed and make it feel like a boutique hotel room. The ROI would be excellent.",
      "An income-generating space. I'd list it on Airbnb. Even at $75/night for weekends, it pays for itself in under two years.",
    ],
    IQ5: [
      "I work on-site so this isn't about my workspace. It's about maximizing property value and income potential. The backyard is the untapped opportunity.",
      "Work boundaries aren't my concern. I think about this purely from an investment angle. What adds the most value per dollar spent?",
    ],
    IQ6: [
      "$23K is remarkably reasonable compared to ADU alternatives. One-day install eliminates my biggest frustration. My concern is quality at that price point.",
      "Very interested. The price-to-value ratio is compelling. My questions are about durability, resale impact, and tax benefits.",
    ],
    IQ7: [
      "I need data on property value impact. Show me comps. Build quality must be excellent. Financing at reasonable rates would seal it.",
      "Clear ROI documentation. I want to know the resale value impact and rental income potential. Dealbreaker is if it doesn't appraise.",
    ],
    IQ8: [
      "Community event sponsorship doesn't affect my decision — I buy based on value and quality. Real estate agent recommendations would carry the most weight.",
      "I'm not influenced by sponsorship. A partnership with real estate agents would be more effective than event marketing for someone like me.",
    ],
    additional_thoughts: [
      "The ADU market has been overpriced and slow. There's a massive opportunity for a product that delivers 80% of the value at 20% of the cost.",
      "Think about partnering with real estate agents and property managers. The $23K price point is in impulse-buy territory for serious investors.",
    ],
  },
  "practical-value": {
    IQ1: [
      "My backyard is small. The kids play out there sometimes but it's nothing fancy. I'd like to do more with it but we're on a budget.",
      "We've got a backyard. It's fine but nothing special. I mow it and that's about it. Every project seems expensive.",
    ],
    IQ2: [
      "Storage, storage, storage. We have too much stuff and not enough space. I also wish I had a hobby space but the house can't accommodate it.",
      "We need more room for the kids' stuff and my projects. Every room is shared. A dedicated space would solve a lot of arguments.",
    ],
    IQ3: [
      "I've looked at Costco and Home Depot sheds but they're either flimsy or expensive. I thought about building something myself but I don't have the skills or time.",
      "I priced out a couple of shed options. The cheap ones look terrible and the nice ones are $15K+. I got sticker shock.",
    ],
    IQ4: [
      "A multipurpose room — craft space for me, play area for the kids, and overflow storage. Nothing fancy, just functional.",
      "I'd use it for my projects. Having a dedicated space where I can leave things set up without cleaning up every night would be incredible.",
    ],
    IQ5: [
      "I work on-site so work boundaries aren't the main issue. Home boundaries are — finding personal space when you have a family.",
      "The issue isn't work-life balance, it's life-life balance. With family, someone always needs the table, the couch, the TV.",
    ],
    IQ6: [
      "$23K is a lot of money for us. That's not pocket change. But if it's genuinely installed in one day, that's really appealing. Does it come with financing?",
      "Honestly, the price makes me wince a bit. We could do a lot with $23K. But the one-day install is a huge selling point.",
    ],
    IQ7: [
      "Financing is the make-or-break. If I could do $200-300/month, I'd seriously consider it. It needs to be durable — not something that falls apart in 5 years.",
      "Monthly payment option under $300. That's my threshold. I'd also need to know it can handle rough use.",
    ],
    IQ8: [
      "Sponsorship doesn't really matter to me. Honestly, a neighbor having one would be the best marketing. If I could see it before buying, that would help a lot.",
      "I don't pay attention to sponsorships much. Price and value drive my decisions. If a friend recommended it, I'd be sold.",
    ],
    additional_thoughts: [
      "There are a lot of families like mine who need more space but can't afford a home addition. Keep the price competitive and the quality honest.",
      "I think the market for practical, affordable backyard structures is huge. Not everyone needs a fancy home office or yoga studio.",
    ],
  },
};

// ─── Stage 1: Discovery seed data ────────────────────────────────────────────

const DISCOVERY_RESPONSES: Record<string, Record<string, string>> = {
  "openai/gpt-4.1-mini": {
    DQ1: "The Tahoe Mini offers homeowners a premium, turnkey solution for expanding their living space without the complexity of traditional construction. Its core value proposition centers on three pillars: speed (one-day professional installation), simplicity (permit-light in most jurisdictions), and versatility (adaptable to office, wellness, guest suite, or storage use cases). At $23,000, it occupies a strategic price point between flimsy DIY sheds ($3-8K) and full ADU construction ($80-150K+).",
    DQ2: "Profile 1: The Remote Professional (30-45, $100K+ household income) — Works from home full-time or hybrid, struggles with makeshift workspace, values productivity and quiet. Profile 2: The Active Lifestyle Enthusiast (25-40, $75-150K) — Needs gear storage, workshop space, values durability and functionality over aesthetics. Profile 3: The Property-Minded Homeowner (40-60, $150K+) — Sees backyard structures as property value enhancers, interested in guest suite or STR income potential.",
    DQ3: "1) Sticker shock at the $23,000 price point — many homeowners initially compare to $2-5K Home Depot sheds without understanding the quality difference. 2) HOA uncertainty — fear of community pushback or outright prohibition, especially in planned communities. 3) Permit anxiety — despite 'permit-light' positioning, homeowners worry about legal compliance and potential fines.",
    DQ4: "Permit-light positioning is a significant differentiator because it directly addresses one of the top 3 purchase barriers. Traditional contractors require weeks of permit processing, multiple inspections, and often architectural drawings. The Tahoe Mini's design (under 120 sq ft, no permanent foundation, no plumbing) allows it to avoid full building permit requirements in most jurisdictions. This reduces both cost and timeline dramatically.",
    DQ5: "Primary emotional triggers: 1) Frustration with current space constraints — the daily pain of a cramped home office or cluttered garage. 2) Aspiration for a 'room of one's own' — the dream of personal space for wellness, creativity, or work. 3) Pride of ownership — a beautiful, modern structure that enhances the property. 4) Relief from complexity — the one-day install removes the dread of a lengthy construction project.",
    DQ6: "Professional installation is a critical differentiator that serves multiple strategic functions: 1) It eliminates the competence anxiety that stops DIY-averse buyers. 2) It creates a premium perception that justifies the price point over shed kits. 3) One-day completion is a powerful marketing claim that reduces the perceived disruption. 4) It ensures quality control and enables warranty backing.",
    DQ7: "HOA restrictions could significantly constrain the addressable market. Approximately 25-30% of US homeowners live in HOA-governed communities, and many have restrictive covenants about outbuildings. However, the Tahoe Mini's design can be positioned favorably: its modern aesthetic, professional installation, and small footprint make it more likely to gain HOA approval than DIY alternatives.",
    DQ8: "Based on market analysis: 1) Home Office has the broadest appeal due to the permanent remote work shift — this is the primary use case for marketing. 2) Wellness/Studio has strong emotional resonance and growing demand. 3) Guest Suite appeals to property-minded buyers but may face more regulatory scrutiny. 4) Adventure/Storage is niche but passionate. 5) Storage alone is the weakest positioning as it invites price comparison with basic sheds.",
    DQ9: "Against traditional contractors: emphasize speed (1 day vs. 3-6 months), predictable pricing ($23K vs. $80-150K+ with overruns), and minimal disruption. Against DIY sheds: emphasize quality, aesthetics, professional installation, and warranty. The sweet spot is positioning as 'contractor quality at a fraction of the time and cost, without the DIY hassle.' Avoid competing on price with Costco sheds — compete on value, experience, and outcome.",
    DQ10: "1) Social media (Instagram, Facebook) — visual product with aspirational lifestyle positioning. 2) Google Search — capture high-intent buyers searching for 'backyard office,' 'prefab studio,' etc. 3) Home improvement expos and local events — physical presence for touch-and-feel. 4) Referral program — satisfied customers are the strongest advocates. 5) Outdoor/community event sponsorship — effective for adventure and wellness segments.",
  },
  "google/gemini-2.5-flash": {
    DQ1: "The Tahoe Mini addresses a fundamental tension in the modern homeowner's life: the need for additional functional space without the cost, complexity, and disruption of traditional construction. Its value proposition is a trifecta of accessibility — affordable ($23K vs. $100K+ ADUs), fast (one-day install), and hassle-free (permit-light). It democratizes the backyard structure market, making what was previously a luxury accessible to middle-income homeowners.",
    DQ2: "Profile 1: Wellness-Focused Homeowner (35-55, $100-200K) — Practices yoga, meditation, or creative arts and craves a personal sanctuary separate from family spaces. Values aesthetics, natural light, and calm. Profile 2: Budget-Conscious Family (28-40, $50-100K) — Needs practical extra space for kids, hobbies, or storage. Highly price-sensitive, needs financing options. Profile 3: The Suburban Hustler (30-45, $100-175K) — Side hustles, content creation, or e-commerce from home. Needs a professional space that doubles as a studio or inventory room.",
    DQ3: "1) Cost justification — $23K requires household budget allocation and often financing; buyers need clear ROI framing. 2) Quality perception risk — 'prefabricated' carries negative connotations of flimsy, temporary structures; buyers need to see and touch quality materials. 3) HOA/permit uncertainty — even 'permit-light' isn't 'permit-free,' and buyers fear navigating bureaucracy or neighbor complaints.",
    DQ4: "Permit-light is perhaps the single most important competitive moat. Most homeowners have heard permit horror stories — months of delays, unexpected costs, failed inspections. By designing under the threshold (typically <120 sq ft, no permanent foundation, no plumbing), Neo Smart Living eliminates the most anxiety-inducing part of the buying journey. This should be front and center in all marketing — it's not just a feature, it's emotional relief.",
    DQ5: "The purchase decision is fundamentally emotional with rational justification. Key triggers: 1) The 'I deserve this' moment — years of making do with inadequate space reaches a breaking point. 2) Life transition catalysts — new remote job, new baby, retirement, kids leaving home. 3) Social proof envy — seeing a neighbor's or friend's backyard structure creates desire. 4) Frustration threshold — the 10th time you trip over bikes in the garage or can't find quiet for a video call.",
    DQ6: "Professional installation transforms the Tahoe Mini from a product into a service. This is critical because: 1) It removes the primary objection of 'I'm not handy.' 2) The one-day promise is a powerful story — 'wake up without it, go to bed with it.' 3) It enables premium pricing — buyers accept paying more for turnkey solutions. 4) It creates a controlled brand experience from start to finish.",
    DQ7: "HOA impact is geography-dependent and represents a real market constraint. In HOA-heavy markets like Southern California, potentially 40% of single-family homeowners face restrictions. Mitigation strategies: 1) Provide HOA-ready documentation packages. 2) Offer architectural review support. 3) Design options that align with common CC&R requirements. 4) Consider a 'HOA guarantee' — if HOA denies approval, offer a full refund.",
    DQ8: "Ranking by market size × purchase intent: 1) Home Office — largest addressable market in the post-COVID era. 2) Guest Suite — strong appeal among higher-income homeowners, potential rental income angle. 3) Wellness Studio — growing market with passionate, vocal advocates. 4) Adventure/Gear Storage — smaller but deeply engaged community. 5) General Storage — weakest as standalone positioning but works as secondary use case.",
    DQ9: "Neo Smart Living should position as the 'Third Way' — neither the hassle of contractors nor the compromise of DIY. Key messaging: 'We built the product so you don't have to build anything.' Against contractors: time savings (1 day vs. months) and cost certainty. Against DIY: quality, warranty, and zero effort. Critical: never say 'shed' in marketing — this is a 'backyard studio,' 'home office,' or 'private retreat.'",
    DQ10: "Channel strategy should be segmented by persona: 1) Remote workers — LinkedIn ads, WFH community partnerships, coworking space partnerships. 2) Wellness seekers — Instagram, wellness influencers, yoga studio partnerships. 3) Property investors — real estate agent referral programs, Zillow/Redfin partnerships. 4) Adventure enthusiasts — outdoor event sponsorship, REI-style partnerships. 5) Budget-conscious — Google search ads, home improvement content marketing, financing partner co-marketing.",
  },
  "anthropic/claude-sonnet-4-20250514": {
    DQ1: "The Tahoe Mini's value proposition operates on three levels: functional (additional usable space), emotional (personal sanctuary and autonomy), and financial (property value enhancement without ADU-level investment). The $23,000 price point is strategic — high enough to signal quality and differentiate from commodity sheds, but low enough to be accessible with financing. The one-day installation narrative is the most compelling element: it converts what is typically a months-long anxiety-inducing project into a single-day transformation.",
    DQ2: "Profile 1: The Space-Starved Remote Worker (28-42, dual income $120K+) — Educated professional whose employer went permanent remote/hybrid. Has been 'making do' with a dining table or bedroom corner office for years. Decision trigger: another embarrassing video call interruption. Profile 2: The Wellness Investor (35-55, $100-200K) — Prioritizes mental and physical health. Wants a dedicated space for yoga, meditation, art, or journaling. Views the purchase as self-care investment, not home improvement. Profile 3: The Pragmatic Property Owner (42-62, $150K+) — Analytical buyer who thinks in terms of cost-per-square-foot and ROI. Interested in guest accommodation and potential STR income.",
    DQ3: "1) Sticker shock relative to mental anchoring — buyers unconsciously compare to Home Depot shed prices ($2-8K) before understanding the quality gap. The solution is reframing: compare to contractor costs ($80K+), not shed costs. 2) HOA/regulatory fear — this is an emotional barrier as much as a practical one. Even when permits aren't required, buyers fear 'getting in trouble.' 3) Commitment anxiety — $23K is a significant decision, and buyers worry about making the wrong choice (wrong size, wrong use case, buyer's remorse). A satisfaction guarantee would address this directly.",
    DQ4: "Permit-light positioning is a masterstroke of product design meeting market strategy. By staying under the typical permit threshold (<120 sq ft, no foundation, no plumbing), Neo Smart Living has effectively removed the most complex, unpredictable, and anxiety-inducing step from the customer journey. Competitors who build larger or require foundations cannot match this. The key is education: most buyers don't know that sub-120 sq ft structures are often exempt. This positioning turns a regulatory constraint into a competitive advantage.",
    DQ5: "The emotional purchase journey follows a predictable arc: 1) Chronic frustration (months/years of inadequate space). 2) Trigger event (new job, life change, specific incident). 3) Research phase (often starts with 'ADU' or 'backyard office' search). 4) Sticker shock from ADU/contractor quotes. 5) Discovery of alternatives like the Tahoe Mini. 6) Permission-granting moment ('I deserve this' or 'this actually makes financial sense'). Marketing should target stages 1-3 with awareness content and stages 4-6 with conversion content.",
    DQ6: "Professional installation is both a product feature and a trust signal. It communicates: 'We stand behind this product enough to install it ourselves.' For risk-averse buyers (which most homeowners are for $23K purchases), this eliminates the fear of assembly errors, structural concerns, and the 'pile of parts in my driveway' nightmare. The one-day timeline is the cherry on top — it converts installation from a dreaded disruption into a exciting transformation event. Consider: customers could take a 'before and after' photo the same day.",
    DQ7: "HOA constraints represent the single largest addressable market risk. In suburban Southern California specifically, HOA prevalence is estimated at 40-50% of single-family homes. Strategy: 1) Proactively build an HOA approval toolkit with architectural renderings, material specs, and template request letters. 2) Position the Tahoe Mini's modern design as an aesthetic upgrade that enhances community appearance. 3) Gather success stories of HOA approvals for social proof. 4) Consider designing a 'HOA-optimized' variant with subdued aesthetics if needed.",
    DQ8: "Use case appeal, ranked by addressable market size and purchase urgency: 1) Home Office — largest market, highest urgency due to permanent remote work shift. The 'I need this for my sanity and productivity' framing drives immediate action. 2) Wellness/Studio — second in emotional appeal, especially post-pandemic. Strong among women 35-55 with disposable income. 3) Guest Suite — strong financial appeal but lower urgency; works well as secondary pitch. 4) Adventure Basecamp — niche but passionate buyers with strong community word-of-mouth. 5) Premium Storage — weakest standalone but strengthens as 'also does' messaging.",
    DQ9: "Positioning framework: The Tahoe Mini is not competing in the 'shed' category or the 'ADU' category — it creates a new category: the 'backyard room.' Against contractors: 'Same quality room, 1/4 the price, installed in hours not months.' Against sheds: 'This isn't storage — it's living space, professionally designed and installed.' The brand should own the concept of the 'backyard room' as a distinct product category. Avoid price wars with either end — compete on the unique value of speed + quality + simplicity.",
    DQ10: "Multi-channel strategy: 1) Google Search (highest intent) — own keywords like 'backyard office,' 'prefab studio,' 'one day install backyard.' 2) Instagram/Pinterest (aspiration) — beautiful lifestyle imagery of the Tahoe Mini in use. 3) Facebook (targeting) — custom audiences based on remote work, home improvement, property investment interests. 4) Local partnerships (trust) — real estate agents, interior designers, landscape architects. 5) Community events (awareness) — outdoor expos, wellness fairs, home shows. 6) Referral program (conversion) — most powerful channel for $23K considered purchases.",
  },
};

const DISCOVERY_BRIEF: Record<string, unknown> = {
  product_summary: "The Tahoe Mini by Neo Smart Living is a ~120 sq ft prefabricated backyard structure priced at $23,000, professionally installed in one day, and designed to be permit-light in most jurisdictions. It targets homeowners seeking additional functional space without the cost and complexity of traditional construction or ADUs.",
  target_segments: [
    "Remote Professionals (28-45, $100K+) seeking dedicated home office space",
    "Wellness-Focused Homeowners (35-55, $100-200K) wanting personal sanctuary space",
    "Property-Minded Owners (40-60, $150K+) interested in guest suites and property value",
    "Active Lifestyle Enthusiasts (25-40, $75-150K) needing gear storage and workshop space",
    "Budget-Conscious Families (28-40, $50-100K) seeking practical multipurpose space",
  ],
  key_barriers: [
    "Price perception — $23K triggers sticker shock when mentally anchored to shed prices, requires reframing against contractor/ADU costs ($80-150K+)",
    "HOA/permit uncertainty — even 'permit-light' creates anxiety about compliance, neighbor complaints, and potential penalties",
    "Quality perception risk — 'prefabricated' carries negative connotations; buyers need physical proof of build quality before committing",
  ],
  positioning_strategy: "Position as a new category — the 'backyard room' — distinct from both commodity sheds and expensive ADUs. Lead with speed (one-day install), simplicity (permit-light), and versatility (office, wellness, guest, adventure). Never use the word 'shed.' Compete on the unique value proposition of contractor quality at a fraction of the time, cost, and hassle.",
  recommended_research_focus: [
    "Quantify segment size and willingness to pay across the 5 identified personas",
    "Test emotional vs. rational messaging approaches for each segment",
    "Measure HOA concern severity and evaluate effectiveness of mitigation strategies",
    "Assess concept appeal for 5 use-case positionings (office, wellness, guest, adventure, simplicity)",
    "Identify optimal marketing channels and messaging by segment",
  ],
};

// ─── Survey design seed data (Stage 3) ───────────────────────────────────────

function getSurveyDesign(modelLabel: string): Record<string, unknown> {
  const baseDesign = {
    title: `Tahoe Mini Market Research Survey — ${modelLabel}`,
    sections: [
      {
        id: "screening",
        label: "Screening & Qualification",
        questions: [
          { id: "S3", type: "single_choice", text: "Do you own a single-family home with a private backyard in Southern California?", options: ["Yes", "I'm not sure, but possibly", "No"] },
        ],
      },
      {
        id: "category_interest",
        label: "Category Interest & Awareness",
        questions: [
          { id: "Q0a", type: "single_choice", text: "Have you ever considered adding a separate structure to your backyard?", options: ["Yes, I have actively researched or priced options", "Yes, I have thought about it but not researched it", "I'm aware it's possible but haven't seriously considered it", "No, I have never considered this"] },
          { id: "Q0b", type: "likert_5", text: "How appealing is the idea of having an additional private room in your backyard?" },
          { id: "Q1", type: "likert_5", text: "How interested are you in a prefabricated backyard structure that can be installed in one day?" },
          { id: "Q2", type: "likert_5", text: "How likely would you be to purchase a ~120 sq ft backyard structure priced at approximately $23,000?" },
          { id: "Q3", type: "single_choice", text: "What would be your PRIMARY use for this kind of backyard space?", options: ["Home office / remote workspace", "Wellness studio (gym, yoga, meditation)", "Guest suite / short-term rental (STR) income", "Adventure basecamp (gear storage, bike workshop, hangout space)", "Creative studio (music, podcast, art)", "General storage / premium speed shed", "Children's playroom", "Other"] },
        ],
      },
      {
        id: "barriers",
        label: "Purchase Barriers",
        questions: [
          { id: "Q5_cost", type: "likert_5", text: "How much of a barrier is the total cost (~$23,000)?" },
          { id: "Q5_hoa", type: "likert_5", text: "How much of a barrier are HOA restrictions or community rules?" },
          { id: "Q5_permit", type: "likert_5", text: "How much of a barrier is uncertainty about building permits?" },
          { id: "Q5_space", type: "likert_5", text: "How much of a barrier is limited backyard space or access?" },
          { id: "Q5_financing", type: "likert_5", text: "How much of a barrier is the lack of financing options?" },
          { id: "Q5_quality", type: "likert_5", text: "How much of a barrier are concerns about build quality or durability?" },
          { id: "Q5_resale", type: "likert_5", text: "How much of a barrier is uncertainty about resale value impact?" },
          { id: "Q6", type: "single_choice", text: "What is your SINGLE BIGGEST concern about purchasing?", options: ["The total cost (~$23,000)", "HOA restrictions or community rules", "Uncertainty about whether a building permit is required", "Limited backyard space or access", "Lack of financing options", "Concerns about build quality or durability", "Uncertainty about resale value", "None — I have no significant concerns"] },
          { id: "Q7", type: "likert_5", text: "How important is professional installation (vs. DIY assembly) for a product like this?" },
        ],
      },
      {
        id: "concept_testing",
        label: "Concept Testing",
        questions: [
          { id: "Q9a", type: "likert_5", text: "Concept 1 — Backyard Home Office: How appealing is this concept?" },
          { id: "Q9b", type: "likert_5", text: "How likely would you be to purchase under this concept?" },
          { id: "Q10a", type: "likert_5", text: "Concept 2 — Guest Suite / STR Income: How appealing is this concept?" },
          { id: "Q10b", type: "likert_5", text: "How likely would you be to purchase under this concept?" },
          { id: "Q11a", type: "likert_5", text: "Concept 3 — Wellness / Studio Space: How appealing is this concept?" },
          { id: "Q11b", type: "likert_5", text: "How likely would you be to purchase under this concept?" },
          { id: "Q12a", type: "likert_5", text: "Concept 4 — Adventure Lifestyle / Community: How appealing is this concept?" },
          { id: "Q12b", type: "likert_5", text: "How likely would you be to purchase under this concept?" },
          { id: "Q13a", type: "likert_5", text: "Concept 5 — Message-First (Speed, Simplicity, Value): How appealing is this concept?" },
          { id: "Q13b", type: "likert_5", text: "How likely would you be to purchase under this concept?" },
          { id: "Q14", type: "single_choice", text: "Which concept resonates with you MOST?", options: ["Concept 1: Backyard Home Office", "Concept 2: Guest Suite / STR Income", "Concept 3: Wellness / Studio Space", "Concept 4: Adventure Lifestyle / Community", "Concept 5: Message-First", "None of the above"] },
        ],
      },
      {
        id: "value_props",
        label: "Value Propositions & Purchase Drivers",
        questions: [
          { id: "Q15", type: "likert_5", text: "How important is 'permit-light' (no full building permit required) in your decision?" },
          { id: "Q16", type: "likert_5", text: "How important is 'one-day professional installation' in your decision?" },
          { id: "Q17", type: "likert_5", text: "How important is build quality and materials in your decision?" },
          { id: "Q18", type: "single_choice", text: "What is the MOST important value proposition?", options: ["Permit-light positioning", "Build quality and details", "Installation speed", "Price point", "Versatility of use cases"] },
          { id: "Q19", type: "likert_5", text: "Would brand sponsorship of outdoor/community events positively influence your perception?" },
          { id: "Q20", type: "multi_choice", text: "How would you most likely discover a product like this? (Select up to 2)", options: ["Social media ads (Facebook, Instagram)", "Google / Search ads", "Friend / family referral", "Home improvement expos", "Outdoor club sponsorships / community events", "Real estate partner referrals"] },
        ],
      },
      {
        id: "demographics",
        label: "Demographics",
        questions: [
          { id: "Q21", type: "single_choice", text: "Age range", options: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] },
          { id: "Q22", type: "single_choice", text: "Household income", options: ["Under $50,000", "$50,000-$74,999", "$75,000-$99,999", "$100,000-$149,999", "$150,000-$199,999", "$200,000 or more"] },
          { id: "Q23", type: "single_choice", text: "Work arrangement", options: ["I work remotely full-time (5 days/week from home)", "I work a hybrid schedule (at least part of my week is remote)", "I work on-site / in-person full-time", "I am self-employed / freelance (primarily work from home)", "I am retired", "Other"] },
          { id: "Q24", type: "single_choice", text: "Is your home part of a Homeowners Association (HOA)?", options: ["Yes", "No", "I'm not sure"] },
          { id: "Q25", type: "single_choice", text: "How often do you participate in outdoor recreation?", options: ["Weekly or more", "2-3 times per month", "About once a month", "A few times a year", "Rarely or never"] },
          { id: "Q26", type: "single_choice", text: "Are you a member of any outdoor clubs or groups?", options: ["Yes", "No"] },
          { id: "Q30", type: "attention_check", text: "For quality assurance, please select '3' for this question." },
        ],
      },
    ],
    metadata: {
      total_questions: 32,
      estimated_duration_minutes: 12,
      model: modelLabel,
    },
  };
  return baseDesign;
}

// ─── Interview themes seed data (Stage 2) ────────────────────────────────────

function getInterviewThemes(): Record<string, unknown> {
  return {
    lda_topics: {
      num_topics: 6,
      coherence_score: 0.42,
      topics: [
        { topic_id: 0, label: "Remote Work Space", keywords: ["work", "office", "desk", "quiet", "space", "home", "remote", "calls", "noise", "dedicated"] },
        { topic_id: 1, label: "Outdoor Activity Storage", keywords: ["gear", "bike", "storage", "garage", "workshop", "outdoor", "equipment", "tools", "space", "organize"] },
        { topic_id: 2, label: "Personal Wellness Retreat", keywords: ["yoga", "meditation", "peace", "sanctuary", "wellness", "calm", "practice", "studio", "retreat", "personal"] },
        { topic_id: 3, label: "Property Value & Investment", keywords: ["value", "property", "invest", "rental", "income", "adu", "cost", "roi", "quality", "appraisal"] },
        { topic_id: 4, label: "Family Space Needs", keywords: ["kids", "family", "storage", "play", "room", "house", "space", "budget", "practical", "affordable"] },
        { topic_id: 5, label: "Creative Studio", keywords: ["studio", "creative", "music", "art", "record", "film", "design", "content", "setup", "equipment"] },
      ],
    },
    llm_themes: [
      {
        theme_name: "The Desperate Home Office",
        description: "Remote and hybrid workers frustrated with makeshift workspaces, craving physical separation between work and personal life.",
        frequency: 10,
        supporting_quotes: [
          { respondent_id: "INT01", quote: "I'm currently working from the dining table and it's not ideal." },
          { respondent_id: "INT06", quote: "Working from the guest bedroom means I'm never really off." },
          { respondent_id: "INT12", quote: "I need better work-life separation — my desk is in the living room." },
        ],
      },
      {
        theme_name: "The Gear Overflow Problem",
        description: "Active lifestyle enthusiasts whose equipment has taken over garages, closets, and living spaces, seeking dedicated storage and workshop space.",
        frequency: 6,
        supporting_quotes: [
          { respondent_id: "INT04", quote: "My garage is packed and I can't fit my car in there anymore." },
          { respondent_id: "INT14", quote: "I need gear storage and an editing station for outdoor photography." },
        ],
      },
      {
        theme_name: "The Wellness Sanctuary Dream",
        description: "Health-conscious individuals seeking a personal retreat space for yoga, meditation, and creative practices away from household interruptions.",
        frequency: 5,
        supporting_quotes: [
          { respondent_id: "INT06", quote: "I dream of a proper wellness space separate from the house." },
          { respondent_id: "INT21", quote: "I crave a personal sanctuary at home for decompression after long shifts." },
        ],
      },
      {
        theme_name: "The Smart Investment Angle",
        description: "Property-minded homeowners who view backyard structures as value-add investments, comparing favorably to expensive ADU alternatives.",
        frequency: 5,
        supporting_quotes: [
          { respondent_id: "INT08", quote: "I follow property values closely — every improvement should add value." },
          { respondent_id: "INT22", quote: "I want an impressive, private meeting space that also adds to property value." },
        ],
      },
      {
        theme_name: "The Budget-Practical Family",
        description: "Cost-conscious families needing multipurpose space for kids, hobbies, and storage, where $23K is a significant but potentially worthwhile investment.",
        frequency: 4,
        supporting_quotes: [
          { respondent_id: "INT10", quote: "We have too much stuff and not enough space." },
          { respondent_id: "INT17", quote: "I need somewhere to practice guitar without bothering neighbors." },
        ],
      },
    ],
    segment_suggestions: [
      { segment_name: "Remote Work Refugees", description: "Professionals working from home full-time or hybrid who lack dedicated workspace.", estimated_size: "30-35%", representative_respondents: ["INT01", "INT06", "INT12", "INT16", "INT23", "INT27"], key_driver: "Physical separation of work and home", primary_barrier: "HOA restrictions and cost justification" },
      { segment_name: "Adventure Basecamp Seekers", description: "Outdoor enthusiasts drowning in gear who want workshop/storage space.", estimated_size: "15-20%", representative_respondents: ["INT04", "INT14", "INT28"], key_driver: "Gear organization and hobby workspace", primary_barrier: "Budget and 120 sqft size limitations" },
      { segment_name: "Wellness Retreat Builders", description: "Health-focused individuals seeking a personal sanctuary.", estimated_size: "15-20%", representative_respondents: ["INT05", "INT06", "INT19", "INT21"], key_driver: "Privacy and personal renewal space", primary_barrier: "Interior aesthetics and climate control" },
      { segment_name: "Property Value Maximizers", description: "Investment-oriented homeowners who see structures as affordable ADU alternatives.", estimated_size: "15-20%", representative_respondents: ["INT08", "INT11", "INT18", "INT22"], key_driver: "ROI, rental income, property appreciation", primary_barrier: "Quality perception and appraisal impact" },
      { segment_name: "Budget-Practical Families", description: "Cost-sensitive households needing multipurpose space.", estimated_size: "15-20%", representative_respondents: ["INT10", "INT17", "INT26", "INT30"], key_driver: "Affordable additional space for family needs", primary_barrier: "Price and financing availability" },
    ],
    existing_segment_mapping: {
      "Remote Work Refugees": "Remote Professional",
      "Adventure Basecamp Seekers": "Active Adventurer",
      "Wellness Retreat Builders": "Wellness Seeker",
      "Property Value Maximizers": "Property Maximizer",
      "Budget-Practical Families": "Budget-Conscious DIYer",
    },
  };
}

// ─── Main seeder ─────────────────────────────────────────────────────────────

export async function seedDemoData(supabase: SupabaseClient, runId: string): Promise<void> {
  const modelIds = MODEL_IDS;
  const timestamp = "2026-03-08T12:00:00.000Z";

  // ── Stage 1: Discovery ─────────────────────────────────────────────────────
  const discoveryRows: Array<Record<string, unknown>> = [];
  for (const modelId of modelIds) {
    const modelLabel = MODEL_LABELS[modelId];
    const responses = DISCOVERY_RESPONSES[modelId];
    for (const [qKey, qText] of Object.entries(DISCOVERY_QUESTIONS)) {
      discoveryRows.push({
        run_id: runId,
        model: modelLabel,
        question_key: qKey,
        question_label: qKey,
        question_text: qText,
        response: responses[qKey],
      });
    }
  }
  await supabase.from("discovery_responses").insert(discoveryRows);
  await supabase.from("discovery_briefs").insert({
    run_id: runId,
    brief: DISCOVERY_BRIEF,
    models_used: MODEL_IDS.map((id) => MODEL_LABELS[id]),
  });

  // ── Stage 2: Interviews ────────────────────────────────────────────────────
  const transcriptRows: Array<Record<string, unknown>> = [];
  const analysisRows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < INTERVIEW_PERSONAS.length; i++) {
    const persona = INTERVIEW_PERSONAS[i];
    const modelId = modelIds[i % 3];
    const modelLabel = MODEL_LABELS[modelId];
    const tendency = assignTendency(persona);
    const rng = new SeededRNG(seedHash(persona.persona_id, modelLabel, "test_interview"));

    // Generate responses
    const responses: Record<string, string> = {};
    for (const key of INTERVIEW_RESPONSE_KEYS) {
      const templates = TENDENCY_RESPONSES[tendency]?.[key];
      if (templates && templates.length > 0) {
        responses[key] = rng.choice(templates);
      }
    }

    const interviewId = `${persona.persona_id}_${modelLabel}`;
    transcriptRows.push({
      run_id: runId,
      interview_id: interviewId,
      model: modelLabel,
      persona_id: persona.persona_id,
      persona_name: persona.name,
      demographics: {
        age: persona.age,
        income: persona.income,
        work_arrangement: persona.work_arrangement,
        home_situation: persona.home_situation,
        household: persona.household,
        lifestyle_note: persona.lifestyle_note,
        hoa_status: persona.hoa_status,
      },
      responses,
    });

    // Generate analysis
    const analysisRng = new SeededRNG(seedHash(persona.persona_id, modelLabel, "analysis"));
    const baselines = SENTIMENT_BASELINES[tendency];
    const sentimentScoresMap: Record<string, number> = {};
    const sentiments: number[] = [];

    for (const q of ["IQ1", "IQ2", "IQ3", "IQ4", "IQ5", "IQ6", "IQ7", "IQ8"]) {
      const score = Math.max(-1, Math.min(1, parseFloat(((baselines[q] || 0) + analysisRng.gauss(0, 0.15)).toFixed(4))));
      sentimentScoresMap[q] = score;
      sentiments.push(score);
    }

    const overall = parseFloat((sentiments.reduce((a, b) => a + b, 0) / sentiments.length).toFixed(4));
    const emotions = TENDENCY_EMOTIONS[tendency];
    const intensityAdj = analysisRng.choice([-1, 0, 0, 1]);

    analysisRows.push({
      run_id: runId,
      interview_id: interviewId,
      sentiment_scores: { ...sentimentScoresMap, overall, label: overall > 0.05 ? "Positive" : overall < -0.05 ? "Negative" : "Neutral" },
      primary_emotion: emotions.primary,
      secondary_emotion: emotions.secondary,
      emotion_intensity: Math.max(1, Math.min(5, emotions.intensity + intensityAdj)),
      emotion_reasoning: `Respondent shows ${emotions.primary} based on language in IQ6-IQ7 responses, consistent with ${tendency} tendency.`,
    });
  }

  await supabase.from("interview_transcripts").insert(transcriptRows);
  await supabase.from("interview_analysis").insert(analysisRows);

  // Insert themes
  const themes = getInterviewThemes();
  const ldaTopics = (themes.lda_topics as Record<string, unknown>);
  const ldaTopicList = (ldaTopics.topics as Array<Record<string, unknown>>);
  const themeRows: Array<Record<string, unknown>> = [];

  for (const topic of ldaTopicList) {
    themeRows.push({
      run_id: runId,
      source: "lda",
      theme_name: topic.label,
      description: `LDA Topic ${topic.topic_id}`,
      frequency: null,
      keywords: topic.keywords,
      supporting_quotes: null,
    });
  }

  const llmThemes = themes.llm_themes as Array<Record<string, unknown>>;
  for (const theme of llmThemes) {
    themeRows.push({
      run_id: runId,
      source: "llm",
      theme_name: theme.theme_name,
      description: theme.description,
      frequency: theme.frequency,
      keywords: null,
      supporting_quotes: theme.supporting_quotes,
    });
  }
  await supabase.from("interview_themes").insert(themeRows);

  // ── Stage 3: Survey Design ─────────────────────────────────────────────────
  const surveyDesignRows: Array<Record<string, unknown>> = [];
  for (const modelId of modelIds) {
    const label = MODEL_LABELS[modelId];
    const design = getSurveyDesign(label);
    surveyDesignRows.push({
      run_id: runId,
      model: label,
      design,
      total_questions: 32,
      estimated_duration_minutes: 12,
    });
  }
  await supabase.from("survey_designs").insert(surveyDesignRows);

  // Survey coverage
  const sectionIds = ["screening", "category_interest", "barriers", "concept_testing", "value_props", "demographics"];
  const sectionLabels: Record<string, string> = {
    screening: "Screening & Qualification",
    category_interest: "Category Interest & Awareness",
    barriers: "Purchase Barriers",
    concept_testing: "Concept Testing",
    value_props: "Value Propositions & Purchase Drivers",
    demographics: "Demographics",
  };
  const sectionQuestionCounts: Record<string, number> = {
    screening: 1,
    category_interest: 5,
    barriers: 9,
    concept_testing: 12,
    value_props: 6,
    demographics: 7,
  };

  const coverageRows = sectionIds.map((sid) => ({
    run_id: runId,
    section_id: sid,
    section_label: sectionLabels[sid],
    models_including: [MODEL_LABELS["openai/gpt-4.1-mini"], MODEL_LABELS["google/gemini-2.5-flash"], MODEL_LABELS["anthropic/claude-sonnet-4-20250514"]],
    question_counts: Object.fromEntries(
      modelIds.map((mid) => [MODEL_LABELS[mid], sectionQuestionCounts[sid]])
    ),
  }));
  await supabase.from("survey_coverage").insert(coverageRows);

  // ── Stage 4: Survey Responses ──────────────────────────────────────────────
  const surveyResponseRows: Array<Record<string, unknown>> = [];

  const SURVEY_KEYS = [
    "S3", "Q0a", "Q0b", "Q1", "Q2", "Q3",
    "Q5_cost", "Q5_hoa", "Q5_permit", "Q5_space", "Q5_financing", "Q5_quality", "Q5_resale",
    "Q6", "Q7",
    "Q9a", "Q9b", "Q10a", "Q10b", "Q11a", "Q11b", "Q12a", "Q12b", "Q13a", "Q13b",
    "Q14", "Q15", "Q16", "Q17", "Q18", "Q19",
    "Q21", "Q22", "Q23", "Q24", "Q25", "Q26", "Q30",
  ];

  const LIKERT_KEYS = [
    "Q0b", "Q1", "Q2", "Q5_cost", "Q5_hoa", "Q5_permit", "Q5_space",
    "Q5_financing", "Q5_quality", "Q5_resale", "Q7",
    "Q9a", "Q9b", "Q10a", "Q10b", "Q11a", "Q11b",
    "Q12a", "Q12b", "Q13a", "Q13b", "Q15", "Q16", "Q17", "Q19",
  ];

  const CATEGORICAL_KEYS = ["Q3", "Q6", "Q14", "Q18"];

  for (const modelId of modelIds) {
    const modelLabel = MODEL_LABELS[modelId];
    for (const segment of SEGMENTS) {
      for (let respIndex = 0; respIndex < 6; respIndex++) {
        const rng = new SeededRNG(seedHash(segment.id, respIndex, modelId, "test"));
        const profile = SEGMENT_PROFILES[segment.id];
        const demo = getRespondentDemographics(segment.id, respIndex, modelId);

        const data: Record<string, unknown> = {};

        // S3
        data.S3 = rng.choices(S3_OPTIONS, [0.8, 0.2]);

        // Q0a
        data.Q0a = rng.choice(profile.Q0a);

        // Likert questions
        for (const key of LIKERT_KEYS) {
          const profileVal = profile[key as keyof SegmentProfile];
          if (Array.isArray(profileVal) && typeof profileVal[0] === "number") {
            const [mean, spread] = profileVal as [number, number];
            data[key] = likert(mean, spread, rng, modelLabel);
          }
        }

        // Categorical single-choice
        for (const key of CATEGORICAL_KEYS) {
          const options = profile[key as keyof SegmentProfile];
          if (Array.isArray(options) && typeof options[0] === "string") {
            data[key] = rng.choice(options as string[]);
          }
        }

        // Q20
        const q20Options = profile.Q20;
        const q20 = rng.choice(q20Options);

        // Demographics forced from persona config
        data.Q21 = demo.Q21;
        data.Q22 = demo.Q22;
        data.Q23 = demo.Q23;
        data.Q24 = demo.Q24;
        data.Q25 = demo.Q25;
        data.Q26 = demo.Q26;

        // Attention check
        data.Q30 = 3;

        const respondentId = `S${segment.id}_${modelLabel}_${respIndex + 1}`;

        // Pack all question data into responses JSONB
        const responses: Record<string, unknown> = {};
        for (const key of SURVEY_KEYS) {
          responses[key] = data[key] ?? null;
        }
        responses.Q20_1 = q20.length > 0 ? q20[0] : null;
        responses.Q20_2 = q20.length > 1 ? q20[1] : null;

        surveyResponseRows.push({
          run_id: runId,
          respondent_id: respondentId,
          model: modelLabel,
          segment_id: segment.id,
          segment_name: segment.name,
          responses,
        });
      }
    }
  }

  // Insert in batches to avoid payload limits
  const BATCH_SIZE = 30;
  for (let i = 0; i < surveyResponseRows.length; i += BATCH_SIZE) {
    const batch = surveyResponseRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("survey_responses").insert(batch);
    if (error) throw new Error(`Survey response insert batch ${i}: ${error.message}`);
  }

  // ── Stage 5: Analysis ──────────────────────────────────────────────────────
  // Pre-compute analysis results deterministically
  // Group responses by segment for cross-tab analysis
  const segmentStats: Record<number, Record<string, number[]>> = {};
  const modelStats: Record<string, Record<string, number[]>> = {};

  for (const row of surveyResponseRows) {
    const segId = row.segment_id as number;
    const model = row.model as string;

    if (!segmentStats[segId]) segmentStats[segId] = {};
    if (!modelStats[model]) modelStats[model] = {};

    for (const key of LIKERT_KEYS) {
      const resp = row.responses as Record<string, unknown>;
      const val = resp[key] as number | null;
      if (val != null) {
        if (!segmentStats[segId][key]) segmentStats[segId][key] = [];
        segmentStats[segId][key].push(val);

        if (!modelStats[model][key]) modelStats[model][key] = [];
        modelStats[model][key].push(val);
      }
    }
  }

  const analysisResult = {
    segment_means: Object.fromEntries(
      Object.entries(segmentStats).map(([segId, keys]) => [
        SEGMENTS.find((s) => s.id === Number(segId))?.name ?? segId,
        Object.fromEntries(
          Object.entries(keys).map(([key, vals]) => [
            key,
            parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
          ])
        ),
      ])
    ),
    model_means: Object.fromEntries(
      Object.entries(modelStats).map(([model, keys]) => [
        model,
        Object.fromEntries(
          Object.entries(keys).map(([key, vals]) => [
            key,
            parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)),
          ])
        ),
      ])
    ),
    total_respondents: surveyResponseRows.length,
    attention_check_pass_rate: 1.0,
  };

  await supabase.from("analysis_results").insert({
    run_id: runId,
    analysis_type: "cross_tabulation",
    results: analysisResult,
  });

  // ── Stage 6: Validation ────────────────────────────────────────────────────
  const validationResult = {
    tests_run: [
      { test: "attention_check", description: "Q30 attention check = 3", passed: true, detail: "90/90 respondents passed (100%)" },
      { test: "response_distribution", description: "Likert responses cover full 1-5 range", passed: true, detail: "All segments show expected distribution patterns" },
      { test: "segment_differentiation", description: "Key questions show significant segment differences", passed: true, detail: "Q1 mean ranges from 2.6 (Budget DIYer) to 4.1 (Property Maximizer)" },
      { test: "model_bias_check", description: "Model-level bias within acceptable range", passed: true, detail: "GPT bias +0.15, Gemini -0.10, Claude +0.05 — all within ±0.2 threshold" },
      { test: "completion_rate", description: "All respondents completed all questions", passed: true, detail: "0 missing values across 90 respondents × 38 questions" },
      { test: "demographic_consistency", description: "Demographics match segment profiles", passed: true, detail: "Age, income, and work arrangement align with segment definitions" },
    ],
    overall_pass: true,
    summary: "All 6 validation tests passed. Data quality is sufficient for dashboard visualization and analysis.",
  };

  // Insert respondent scores (90 respondents)
  const respondentScoreRows = surveyResponseRows.map((row) => {
    const resp = row.responses as Record<string, unknown>;
    const likertVals = LIKERT_KEYS.map(k => resp[k] as number).filter(v => v != null);
    const mean = likertVals.reduce((a, b) => a + b, 0) / likertVals.length;
    const sd = Math.sqrt(likertVals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / likertVals.length);
    const uniqueVals = new Set(likertVals).size;
    const attentionPass = resp.Q30 === 3;
    const qualityScore = Math.round(
      (attentionPass ? 40 : 0) + (sd >= 0.5 ? 30 : Math.round(sd / 0.5 * 30)) + (uniqueVals >= 3 ? 30 : Math.round(uniqueVals / 3 * 30))
    );
    return {
      run_id: runId,
      respondent_id: row.respondent_id as string,
      model: row.model as string,
      segment_name: row.segment_name as string,
      quality_score: qualityScore,
      response_sd: parseFloat(sd.toFixed(3)),
      unique_values: uniqueVals,
      attention_pass: attentionPass,
    };
  });
  for (let i = 0; i < respondentScoreRows.length; i += BATCH_SIZE) {
    await supabase.from("respondent_scores").insert(respondentScoreRows.slice(i, i + BATCH_SIZE));
  }

  await supabase.from("validation_reports").insert({
    run_id: runId,
    quality_checks: validationResult.tests_run,
    bias_detection: [
      { test: "central_tendency", passed: true, detail: "No central tendency bias detected" },
      { test: "acquiescence", passed: true, detail: "Mean response < 4.2 across all segments" },
      { test: "extreme_response", passed: true, detail: "Extreme responses < 70% for all respondents" },
      { test: "model_agreement", passed: true, detail: "Pairwise model correlations > 0.7" },
    ],
    confidence_intervals: [
      { metric: "Q1 (Purchase Interest)", lower: 2.8, point: 3.35, upper: 3.9 },
      { metric: "Q2 (Concept Appeal)", lower: 3.0, point: 3.55, upper: 4.1 },
      { metric: "Q7 (Value Perception)", lower: 2.5, point: 3.10, upper: 3.7 },
    ],
    grade: "A",
    issues_found: 0,
    total_checks: 6,
    recommendation: validationResult.summary,
  });

  // ── Mark all stages completed ──────────────────────────────────────────────
  const now = new Date().toISOString();
  for (let stage = 1; stage <= 6; stage++) {
    await supabase
      .from("stage_progress")
      .update({
        status: "completed",
        progress_pct: 100,
        completed_at: now,
        message: "Seeded with demo data",
      })
      .eq("run_id", runId)
      .eq("stage", stage);
  }

  // Mark pipeline as completed
  await supabase
    .from("pipeline_runs")
    .update({
      status: "completed",
      current_stage: 6,
      completed_at: now,
    })
    .eq("id", runId);
}
