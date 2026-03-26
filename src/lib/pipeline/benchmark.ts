/**
 * Benchmark data from real aytm survey (N=600 US homeowners)
 * Used for synthetic vs real comparison in Stage 5 analysis
 */

// ── Purchase Interest at $23K (Q6 in real survey, Q1 in ours) ────────────
export const BENCHMARK_PURCHASE_INTEREST = {
  question: 'Purchase Interest at $23K',
  realSurveyQ: 'Q6',
  ourQ: 'Q1',
  n: 600,
  distribution: {
    1: { count: 227, pct: 37.8, label: '1 - Not interested' },
    2: { count: 123, pct: 20.5, label: '2' },
    3: { count: 110, pct: 18.3, label: '3' },
    4: { count: 97, pct: 16.2, label: '4' },
    5: { count: 43, pct: 7.2, label: '5 - Extremely interested' },
  },
  mean: 2.34,
};

// ── Purchase Likelihood 24mo (Q7 in real survey, Q2 in ours) ─────────────
export const BENCHMARK_PURCHASE_LIKELIHOOD = {
  question: 'Purchase Likelihood (24 months)',
  realSurveyQ: 'Q7',
  ourQ: 'Q2',
  n: 600,
  distribution: {
    1: { count: 272, pct: 45.3, label: '1 - Definitely would not' },
    2: { count: 137, pct: 22.8, label: '2' },
    3: { count: 113, pct: 18.8, label: '3' },
    4: { count: 46, pct: 7.7, label: '4' },
    5: { count: 32, pct: 5.3, label: '5 - Definitely would' },
  },
  mean: 2.05,
};

// ── Primary Use Case (Q8 in real survey, Q3 in ours) ─────────────────────
export const BENCHMARK_USE_CASE = {
  question: 'Primary Use Case',
  realSurveyQ: 'Q8',
  ourQ: 'Q3',
  n: 600,
  distribution: {
    'General storage / premium speed shed': { count: 160, pct: 26.7 },
    'Home office / remote workspace': { count: 108, pct: 18.0 },
    'Wellness studio (gym, yoga, meditation)': { count: 89, pct: 14.8 },
    'Other': { count: 64, pct: 10.7 },
    'Guest suite / short-term rental (STR) income': { count: 57, pct: 9.5 },
    'Adventure basecamp (gear storage, bike workshop, hangout space)': { count: 54, pct: 9.0 },
    'Creative studio (music, podcast, art)': { count: 49, pct: 8.2 },
    "Children's playroom": { count: 19, pct: 3.2 },
  },
};

// ── Greatest Single Barrier (Q11 in real survey, Q6 in ours) ─────────────
export const BENCHMARK_GREATEST_BARRIER = {
  question: 'Greatest Single Barrier',
  realSurveyQ: 'Q11',
  ourQ: 'Q6',
  n: 600,
  distribution: {
    'The total cost (~$23,000)': { count: 358, pct: 59.7 },
    'None — I have no significant concerns': { count: 43, pct: 7.2 },
    'Concerns about build quality or durability': { count: 41, pct: 6.8 },
    'Other': { count: 36, pct: 6.0 },
    'HOA restrictions or community rules': { count: 35, pct: 5.8 },
    'Limited backyard space or access': { count: 28, pct: 4.7 },
    'Lack of financing options': { count: 27, pct: 4.5 },
    'Uncertainty about whether a building permit is required': { count: 19, pct: 3.2 },
    'Uncertainty about resale value': { count: 13, pct: 2.2 },
  },
};

// ── Most Motivating Concept (Q29 in real survey, Q14 in ours) ────────────
export const BENCHMARK_BEST_CONCEPT = {
  question: 'Most Motivating Concept',
  realSurveyQ: 'Q29',
  ourQ: 'Q14',
  n: 600,
  distribution: {
    'None of the above': { count: 144, pct: 24.0 },
    'Concept 3: Wellness / Studio Space': { count: 127, pct: 21.2 },
    'Concept 1: Backyard Home Office': { count: 116, pct: 19.3 },
    'Concept 2: Guest Suite / STR Income': { count: 79, pct: 13.2 },
    'Concept 5: Simplicity': { count: 69, pct: 11.5 },
    'Concept 4: Adventure Lifestyle / Community': { count: 65, pct: 10.8 },
  },
};

// ── Value Driver Rankings (Q30 in real survey, Q15-Q17c in ours) ─────────
export const BENCHMARK_VALUE_DRIVERS = {
  question: 'Value Driver Ratings (1-5 Likert)',
  realSurveyQ: 'Q30',
  n: 600,
  drivers: {
    'Permit-light positioning': {
      ourQ: 'Q15',
      distribution: { 1: 20.8, 2: 11.3, 3: 23.0, 4: 31.0, 5: 13.8 },
      top2pct: 44.8,
    },
    'Installation speed': {
      ourQ: 'Q16',
      distribution: { 1: 11.5, 2: 8.5, 3: 19.7, 4: 38.3, 5: 22.0 },
      top2pct: 60.3,
    },
    'Build quality and details': {
      ourQ: 'Q17',
      distribution: { 1: 11.3, 2: 5.8, 3: 18.2, 4: 39.2, 5: 25.5 },
      top2pct: 64.7,
    },
    'Smart Technology': {
      ourQ: 'Q17b',
      distribution: { 1: 15.3, 2: 10.2, 3: 19.7, 4: 33.5, 5: 21.3 },
      top2pct: 54.8,
    },
    'Showroom': {
      ourQ: 'Q17c',
      distribution: { 1: 14.7, 2: 13.2, 3: 22.3, 4: 33.8, 5: 16.0 },
      top2pct: 49.8,
    },
  },
};

// ── Top Value Driver (Q31 in real survey, Q18 in ours) ───────────────────
export const BENCHMARK_TOP_VALUE_DRIVER = {
  question: 'Top Value Driver',
  realSurveyQ: 'Q31',
  ourQ: 'Q18',
  n: 600,
  distribution: {
    'Build quality and details': { count: 278, pct: 46.3 },
    'Smart Technology': { count: 94, pct: 15.7 },
    'Installation speed': { count: 88, pct: 14.7 },
    'Other': { count: 57, pct: 9.5 },
    'Permit-light positioning': { count: 48, pct: 8.0 },
    'Showroom': { count: 35, pct: 5.8 },
  },
};

// ── Barrier Severity Matrix (Q9 in real survey, Q5_* in ours) ────────────
export const BENCHMARK_BARRIER_SEVERITY = {
  question: 'Barrier Severity (% rating 4 or 5)',
  realSurveyQ: 'Q9',
  n: 600,
  barriers: {
    'Q5_cost': { label: 'Cost (~$23K)', top2pct: 65.7 },
    'Q5_quality': { label: 'Build Quality Concerns', top2pct: 45.7 },
    'Q5_financing': { label: 'Lack of Financing', top2pct: 44.4 },
    'Q5_resale': { label: 'Resale Value Uncertainty', top2pct: 38.1 },
    'Q5_hoa': { label: 'HOA Restrictions', top2pct: 36.0 },
    'Q5_permit': { label: 'Permit Uncertainty', top2pct: 32.8 },
    'Q5_space': { label: 'Limited Space', top2pct: 25.5 },
  },
};

// ── Van Konan Pricing (Q34) ──────────────────────────────────────────────
export const BENCHMARK_PRICING = {
  question: 'Van Konan Price Optimization',
  realSurveyQ: 'Q34',
  n: 600,
  vwOptimal: { price: 6666, buyers: 377, buyerPct: 37.7, revenue: 2500000 },
  maxRevenue: { price: 15000, buyers: 240, buyerPct: 24.0, revenue: 3600000 },
  estimatedPrice: { price: 23000, buyers: 110, buyerPct: 11.0, revenue: 2500000 },
};

// ── Demographics ─────────────────────────────────────────────────────────
export const BENCHMARK_DEMOGRAPHICS = {
  hoa: {
    'Yes': 21.3,
    'No': 75.0,
    "I'm not sure": 3.7,
  },
  outdoorFrequency: {
    'Never': 30.8,
    'A few times a year': 29.2,
    'About once a month': 12.5,
    '2-3 times per month': 12.5,
    'Weekly or more': 15.0,
  },
  clubMembership: {
    'No': 81.7,
    'Yes': 18.3,
  },
};

// ── Outreach Channel Preferences (Q33 real, Q20 ours) ────────────────────
export const BENCHMARK_OUTREACH = {
  question: 'Outreach Channel Preferences',
  realSurveyQ: 'Q33',
  ourQ: 'Q20',
  n: 600,
  channels: {
    'YouTube videos (reviews, walkthroughs, install timelapses)': 36.2,
    'Home improvement expos': 30.8,
    'Online reviews / rating sites': 27.7,
    'Friend / family referral': 24.3,
    'Google / Search ads': 17.7,
    'Social media ads (Facebook, Instagram)': 15.0,
    'Neighborhood / Nextdoor recommendations': 12.3,
    'Social media posts on vendor accounts': 10.0,
    'Outdoor club sponsorships / community events': 8.3,
    'Real estate partner referrals': 4.8,
  },
};

// ── Partnership Impact (Q32 real, Q19 ours) ──────────────────────────────
export const BENCHMARK_PARTNERSHIP = {
  question: 'Outdoor Club Partnership Impact',
  realSurveyQ: 'Q32',
  ourQ: 'Q19',
  n: 600,
  distribution: {
    1: { pct: 7.3, label: '1 - Decrease a lot' },
    2: { pct: 7.0, label: '2' },
    3: { pct: 63.2, label: '3' },
    4: { pct: 15.8, label: '4' },
    5: { pct: 6.7, label: '5 - Increase a lot' },
  },
  mean: 3.01,
};

// ── All benchmarks in a single export ────────────────────────────────────
export const ALL_BENCHMARKS = {
  purchaseInterest: BENCHMARK_PURCHASE_INTEREST,
  purchaseLikelihood: BENCHMARK_PURCHASE_LIKELIHOOD,
  useCase: BENCHMARK_USE_CASE,
  greatestBarrier: BENCHMARK_GREATEST_BARRIER,
  bestConcept: BENCHMARK_BEST_CONCEPT,
  valueDrivers: BENCHMARK_VALUE_DRIVERS,
  topValueDriver: BENCHMARK_TOP_VALUE_DRIVER,
  barrierSeverity: BENCHMARK_BARRIER_SEVERITY,
  pricing: BENCHMARK_PRICING,
  demographics: BENCHMARK_DEMOGRAPHICS,
  outreach: BENCHMARK_OUTREACH,
  partnership: BENCHMARK_PARTNERSHIP,
} as const;
