// ============================================================================
// Pipeline Constants — TypeScript port of all Python constants
// Sources: interview_personas.py, segments.py, analytics.py, generate_test_data.py,
//          synthetic_interviews.py, synthetic_respondents.py, interview_analysis.py
// ============================================================================

import type {
  InterviewPersona,
  ModelInfo,
  Segment,
  SegmentProfile,
  ModelBias,
} from './types';

// --- Models ---

export const MODELS: Record<string, ModelInfo> = {
  'openai/gpt-4.1-mini': { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1-mini' },
  'google/gemini-2.5-flash': { id: 'google/gemini-2.5-flash', label: 'Gemini-2.5-Flash' },
  'anthropic/claude-sonnet-4.6': { id: 'anthropic/claude-sonnet-4.6', label: 'Claude-Sonnet-4.6' },
};

export const MODEL_IDS = Object.keys(MODELS) as string[];

export const MODEL_LABELS: Record<string, string> = {
  'openai/gpt-4.1-mini': 'GPT-4.1-mini',
  'google/gemini-2.5-flash': 'Gemini-2.5-Flash',
  'anthropic/claude-sonnet-4.6': 'Claude-Sonnet-4.6',
};

// --- Interview Questions ---

export const INTERVIEW_QUESTIONS: Record<string, string> = {
  IQ1: 'Tell me about your backyard. How do you use it? How do you feel about it?',
  IQ2: 'What are the biggest unmet needs in your home? Anything you wish you had more space for?',
  IQ3: 'Have you ever thought about adding a separate structure (shed, studio, office)? What drove that or held you back?',
  IQ4: 'If you could add a ~120 sq ft private backyard space tomorrow, what would you use it for and why?',
  IQ5: 'How do you handle work/personal boundaries at home? Do you have a dedicated workspace?',
  IQ6: '[The Tahoe Mini by Neo Smart Living is a ~120 sq ft prefabricated backyard structure priced at $23,000, professionally installed in one day, and designed to be permit-light in most jurisdictions.] What\'s your immediate reaction — what excites you, what concerns you?',
  IQ7: 'What would need to be true for you to seriously consider this? What\'s the dealbreaker?',
  IQ8: 'Would brand sponsorship of outdoor/community events affect your perception of this brand? How do you typically discover new home products?',
};

export const INTERVIEW_RESPONSE_KEYS = [
  ...Object.keys(INTERVIEW_QUESTIONS),
  'additional_thoughts',
] as const;

// --- Interview Personas (30 total) ---

export const INTERVIEW_PERSONAS: InterviewPersona[] = [
  {
    persona_id: 'INT01', name: 'Jordan',
    age: '25-34', income: '$75,000-$99,999',
    work_arrangement: 'I work remotely full-time (5 days/week from home)',
    home_situation: '2-bedroom house with small backyard in Long Beach',
    household: 'Lives alone with a dog',
    lifestyle_note: 'Avid podcast listener who dabbles in music production on weekends.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT02', name: 'Taylor',
    age: '35-44', income: '$150,000-$199,999',
    work_arrangement: 'I work a hybrid schedule (at least part of my week is remote)',
    home_situation: '4-bedroom house with medium backyard in Pasadena',
    household: 'Married, two kids (ages 4 and 7)',
    lifestyle_note: 'Weekend trail runner who coaches kids\' soccer.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT03', name: 'Morgan',
    age: '45-54', income: '$200,000 or more',
    work_arrangement: 'I am self-employed / freelance (primarily work from home)',
    home_situation: '5-bedroom house with large backyard in Claremont',
    household: 'Married, one teenager, aging parent lives in guest room',
    lifestyle_note: 'Runs a consulting business and collects mid-century modern furniture.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT04', name: 'Casey',
    age: '25-34', income: '$50,000-$74,999',
    work_arrangement: 'I work on-site / in-person full-time',
    home_situation: '3-bedroom house with small backyard in Pomona',
    household: 'Lives with partner',
    lifestyle_note: 'Mountain biker who spends weekends at local trails and wrenches on bikes in the garage.',
    hoa_status: "I'm not sure",
  },
  {
    persona_id: 'INT05', name: 'Avery',
    age: '55-64', income: '$100,000-$149,999',
    work_arrangement: 'I am retired',
    home_situation: '3-bedroom ranch house with large backyard in Glendora',
    household: 'Married, empty nester, grandkids visit monthly',
    lifestyle_note: 'Passionate gardener who also does watercolor painting.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT06', name: 'Riley',
    age: '35-44', income: '$100,000-$149,999',
    work_arrangement: 'I work remotely full-time (5 days/week from home)',
    home_situation: '3-bedroom house with medium backyard in Rancho Cucamonga',
    household: 'Single parent, one child (age 9)',
    lifestyle_note: 'Yoga practitioner who journals daily and is exploring meditation retreats.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT07', name: 'Quinn',
    age: '25-34', income: '$75,000-$99,999',
    work_arrangement: 'I work a hybrid schedule (at least part of my week is remote)',
    home_situation: '2-bedroom house with small backyard in Azusa',
    household: 'Lives with two roommates',
    lifestyle_note: 'Aspiring content creator who films YouTube videos and needs quiet recording space.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT08', name: 'Dakota',
    age: '45-54', income: '$150,000-$199,999',
    work_arrangement: 'I work on-site / in-person full-time',
    home_situation: '4-bedroom house with large backyard in Austin, TX',
    household: 'Married, three kids (ages 6, 10, 13)',
    lifestyle_note: 'Real estate hobbyist who follows property values closely and hosts backyard BBQs.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT09', name: 'Reese',
    age: '35-44', income: '$100,000-$149,999',
    work_arrangement: 'I am self-employed / freelance (primarily work from home)',
    home_situation: '3-bedroom house with medium backyard in Monrovia',
    household: 'Married, no kids, two cats',
    lifestyle_note: 'Freelance graphic designer who needs a dedicated studio space away from distractions.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT10', name: 'Skyler',
    age: '25-34', income: '$50,000-$74,999',
    work_arrangement: 'I work on-site / in-person full-time',
    home_situation: '2-bedroom house with small backyard in Columbus, OH',
    household: 'Lives with partner and infant',
    lifestyle_note: 'DIY enthusiast who watches home improvement shows and loves budget hacks.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT11', name: 'Jamie',
    age: '45-54', income: '$200,000 or more',
    work_arrangement: 'I work a hybrid schedule (at least part of my week is remote)',
    home_situation: '5-bedroom house with pool and large backyard in San Dimas',
    household: 'Married, two teenagers',
    lifestyle_note: 'Fitness enthusiast with a home gym setup who also hosts poker nights.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT12', name: 'Drew',
    age: '35-44', income: '$75,000-$99,999',
    work_arrangement: 'I work remotely full-time (5 days/week from home)',
    home_situation: '3-bedroom house with small backyard in Milwaukee, WI',
    household: 'Married, one toddler',
    lifestyle_note: 'Software developer who games at night and needs better work-life separation.',
    hoa_status: "I'm not sure",
  },
  {
    persona_id: 'INT13', name: 'Sage',
    age: '55-64', income: '$150,000-$199,999',
    work_arrangement: 'I am retired',
    home_situation: '4-bedroom house with large backyard in Nashville, TN',
    household: 'Married, empty nester',
    lifestyle_note: 'Avid reader and amateur woodworker who dreams of a proper workshop.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT14', name: 'Rowan',
    age: '25-34', income: '$100,000-$149,999',
    work_arrangement: 'I work a hybrid schedule (at least part of my week is remote)',
    home_situation: '3-bedroom house with medium backyard in Hartford, CT',
    household: 'Lives with partner',
    lifestyle_note: 'Rock climber and outdoor photographer who needs gear storage and an editing station.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT15', name: 'Emery',
    age: '35-44', income: '$100,000-$149,999',
    work_arrangement: 'I work on-site / in-person full-time',
    home_situation: '3-bedroom house with medium backyard in Charlotte, NC',
    household: 'Married, two kids (ages 3 and 6)',
    lifestyle_note: 'Scouts leader who values family outdoor time and is always looking for activity space.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT16', name: 'Cameron',
    age: '45-54', income: '$100,000-$149,999',
    work_arrangement: 'I work remotely full-time (5 days/week from home)',
    home_situation: '4-bedroom house with medium backyard in Indianapolis, IN',
    household: 'Married, one teenager, one college student',
    lifestyle_note: 'Accountant who meditates and wants separation between work and home life.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT17', name: 'Hayden',
    age: '25-34', income: '$50,000-$74,999',
    work_arrangement: 'I work on-site / in-person full-time',
    home_situation: '2-bedroom house with small backyard in Providence, RI',
    household: 'Lives with sibling',
    lifestyle_note: 'Musician who plays guitar and wants somewhere to practice without bothering neighbors.',
    hoa_status: "I'm not sure",
  },
  {
    persona_id: 'INT18', name: 'Parker',
    age: '35-44', income: '$150,000-$199,999',
    work_arrangement: 'I am self-employed / freelance (primarily work from home)',
    home_situation: '4-bedroom house with large backyard in Raleigh, NC',
    household: 'Married, three kids (ages 2, 5, 8)',
    lifestyle_note: 'Runs an e-commerce business from home and needs inventory storage and shipping space.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT19', name: 'Finley',
    age: '55-64', income: '$75,000-$99,999',
    work_arrangement: 'I am retired',
    home_situation: '3-bedroom house with large backyard in Kansas City, MO',
    household: 'Lives alone, widowed',
    lifestyle_note: 'Active in community volunteering, enjoys birdwatching and reading in the garden.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT20', name: 'Peyton',
    age: '25-34', income: '$100,000-$149,999',
    work_arrangement: 'I work a hybrid schedule (at least part of my week is remote)',
    home_situation: '3-bedroom house with small backyard in Philadelphia, PA',
    household: 'Married, expecting first child',
    lifestyle_note: 'Couple who loves hosting dinner parties and is nesting before the baby arrives.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT21', name: 'Kendall',
    age: '35-44', income: '$75,000-$99,999',
    work_arrangement: 'I work on-site / in-person full-time',
    home_situation: '3-bedroom house with medium backyard in Minneapolis, MN',
    household: 'Single parent, two kids (ages 8 and 11)',
    lifestyle_note: 'Nurse who works long shifts and craves a personal sanctuary at home for decompression.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT22', name: 'Tatum',
    age: '45-54', income: '$200,000 or more',
    work_arrangement: 'I work a hybrid schedule (at least part of my week is remote)',
    home_situation: '5-bedroom house with large backyard and pool in Houston, TX',
    household: 'Married, two teenagers',
    lifestyle_note: 'Executive who entertains clients at home and wants an impressive, private meeting space.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT23', name: 'Blake',
    age: '25-34', income: '$75,000-$99,999',
    work_arrangement: 'I work remotely full-time (5 days/week from home)',
    home_situation: '2-bedroom house with small backyard in Whittier',
    household: 'Lives with partner and rescue dog',
    lifestyle_note: 'Surfer and environmentalist who values sustainability in home products.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT24', name: 'Marley',
    age: '35-44', income: '$100,000-$149,999',
    work_arrangement: 'I work on-site / in-person full-time',
    home_situation: '3-bedroom house with medium backyard in Newark, NJ',
    household: 'Married, one child (age 5)',
    lifestyle_note: 'Teacher who tutors on the side and wants a quiet space for evening tutoring sessions.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT25', name: 'Remy',
    age: '55-64', income: '$100,000-$149,999',
    work_arrangement: 'I am self-employed / freelance (primarily work from home)',
    home_situation: '4-bedroom house with large backyard in Cleveland, OH',
    household: 'Married, adult children visit often',
    lifestyle_note: 'Part-time consultant and potter who fires ceramics in the garage.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT26', name: 'Ellis',
    age: '25-34', income: '$50,000-$74,999',
    work_arrangement: 'I work a hybrid schedule (at least part of my week is remote)',
    home_situation: '2-bedroom house with small backyard in Pittsburgh, PA',
    household: 'Lives with partner',
    lifestyle_note: 'Gamer and streamer who needs a dedicated setup away from the shared living space.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT27', name: 'Lennox',
    age: '35-44', income: '$150,000-$199,999',
    work_arrangement: 'I work remotely full-time (5 days/week from home)',
    home_situation: '4-bedroom house with medium backyard in Boston, MA',
    household: 'Married, one child (age 2)',
    lifestyle_note: 'Tech lead who takes video calls all day and needs soundproofing from household noise.',
    hoa_status: 'Yes',
  },
  {
    persona_id: 'INT28', name: 'Phoenix',
    age: '45-54', income: '$75,000-$99,999',
    work_arrangement: 'I work on-site / in-person full-time',
    home_situation: '3-bedroom house with medium backyard in Atlanta, GA',
    household: 'Married, two kids (ages 12 and 15)',
    lifestyle_note: 'Coach and fitness trainer who does personal training sessions and wants a private gym.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT29', name: 'Kai',
    age: '25-34', income: '$100,000-$149,999',
    work_arrangement: 'I am self-employed / freelance (primarily work from home)',
    home_situation: '3-bedroom house with medium backyard in Redlands',
    household: 'Lives alone',
    lifestyle_note: 'Freelance videographer who needs a climate-controlled editing suite and equipment storage.',
    hoa_status: 'No',
  },
  {
    persona_id: 'INT30', name: 'Sage R.',
    age: '35-44', income: '$75,000-$99,999',
    work_arrangement: 'I work a hybrid schedule (at least part of my week is remote)',
    home_situation: '3-bedroom house with small backyard in San Bernardino',
    household: 'Married, one child (age 7), elderly mother visits frequently',
    lifestyle_note: 'Crafts seller on Etsy who needs workspace for inventory and shipping.',
    hoa_status: "I'm not sure",
  },
];

// --- Model Assignments (3-way round-robin) ---

export function getModelAssignments(): Record<string, InterviewPersona[]> {
  const assignments: Record<string, InterviewPersona[]> = {};
  for (const modelId of MODEL_IDS) {
    assignments[modelId] = [];
  }
  INTERVIEW_PERSONAS.forEach((persona, i) => {
    const modelId = MODEL_IDS[i % 3];
    assignments[modelId].push(persona);
  });
  return assignments;
}

export function getModelForPersonaIndex(index: number): string {
  return MODEL_IDS[index % 3];
}

// --- Segments ---

export const SEGMENTS: Segment[] = [
  {
    id: 1,
    name: 'Remote Professional',
    demographics: {
      Q21: '25-34',
      Q22: '$100,000-$149,999',
      Q23: 'I work remotely full-time (5 days/week from home)',
      Q24: ['Yes', 'No'],
      Q25: 'About once a month',
      Q26: 'No',
    },
    psychographic:
      'You are a knowledge worker (software engineer, designer, marketer, or analyst) ' +
      'who transitioned to full-time or hybrid remote work. You live in a 3-bedroom ' +
      'home in suburban Southern California and have been struggling with work-from-home ' +
      'distractions — kids, TV, shared spaces. You crave a dedicated, quiet workspace ' +
      'separate from the house. You value productivity, clean design, and tech-forward ' +
      'products. You are willing to invest in your home setup but are cost-conscious ' +
      'about ROI. You enjoy occasional outdoor activities but are not an avid adventurer.',
  },
  {
    id: 2,
    name: 'Active Adventurer',
    demographics: {
      Q21: '25-34',
      Q22: '$75,000-$99,999',
      Q23: 'I work on-site / in-person full-time',
      Q24: ['No', "I'm not sure"],
      Q25: 'Weekly or more',
      Q26: 'Yes',
    },
    psychographic:
      'You are passionate about outdoor sports — mountain biking, trail running, hiking, ' +
      'surfing, or rock climbing. Your garage is overflowing with gear, bikes, boards, ' +
      'and camping equipment. You are part of a local outdoor club and spend weekends ' +
      'on trails or at events. You see your backyard as an extension of your active ' +
      "lifestyle — a place to tune bikes, wax boards, and hang with fellow enthusiasts. " +
      "You are less interested in home office use and more drawn to the 'basecamp' concept. " +
      'You are budget-aware but willing to spend on gear and lifestyle.',
  },
  {
    id: 3,
    name: 'Wellness Seeker',
    demographics: {
      Q21: '35-44',
      Q22: '$100,000-$149,999',
      Q23: 'I work a hybrid schedule (at least part of my week is remote)',
      Q24: ['Yes', 'No'],
      Q25: '2-3 times per month',
      Q26: 'No',
    },
    psychographic:
      'You prioritize mental and physical wellness. You practice yoga, meditation, or ' +
      'home fitness regularly and dream of a dedicated space away from the main house ' +
      'for your routines. You may also use the space for creative pursuits — painting, ' +
      'journaling, music. You value natural light, calm aesthetics, and privacy. You are ' +
      'drawn to the wellness studio concept and see the Tahoe Mini as a personal retreat. ' +
      'You are moderately active outdoors but your primary interest is in personal ' +
      'wellness rather than adventure sports.',
  },
  {
    id: 4,
    name: 'Property Maximizer',
    demographics: {
      Q21: '45-54',
      Q22: '$150,000-$199,999',
      Q23: 'I work on-site / in-person full-time',
      Q24: ['Yes', 'No'],
      Q25: 'A few times a year',
      Q26: 'No',
    },
    psychographic:
      'You think about your home as an investment. You are interested in adding a ' +
      'backyard unit primarily to increase property value, host guests comfortably, ' +
      'or generate short-term rental income. You have a larger property and the budget ' +
      'to invest. You are practical and ROI-focused — you want to know about resale ' +
      'value, durability, and quality. You are less interested in adventure or wellness ' +
      'positioning and more drawn to the guest suite / STR income concept. You are ' +
      'cautious about permits and HOA compliance.',
  },
  {
    id: 5,
    name: 'Budget-Conscious DIYer',
    demographics: {
      Q21: '25-34',
      Q22: '$50,000-$74,999',
      Q23: 'I work on-site / in-person full-time',
      Q24: ['No', "I'm not sure"],
      Q25: 'A few times a year',
      Q26: 'No',
    },
    psychographic:
      'You are handy and resourceful. You are interested in the Tahoe Mini for practical ' +
      'uses — extra storage, a workshop, a creative studio, or a kids\' playroom. The ' +
      '$23,000 price point is a significant investment for you, and cost is your primary ' +
      'barrier. You are drawn to the DIY/speed-shed concept but are concerned about ' +
      'financing and total cost. You like the permit-light feature because it reduces ' +
      'hassle and cost. You are less interested in premium positioning and more focused ' +
      'on practical value.',
  },
];

// --- Segment variation options (for respondent config generation) ---

export const AGE_OPTIONS: Record<number, string[]> = {
  1: ['25-34', '35-44'],
  2: ['25-34', '35-44'],
  3: ['35-44', '45-54'],
  4: ['45-54', '55-64'],
  5: ['25-34', '35-44'],
};

export const INCOME_OPTIONS: Record<number, string[]> = {
  1: ['$100,000-$149,999', '$150,000-$199,999'],
  2: ['$75,000-$99,999', '$100,000-$149,999'],
  3: ['$100,000-$149,999', '$150,000-$199,999'],
  4: ['$150,000-$199,999', '$200,000 or more'],
  5: ['$50,000-$74,999', '$75,000-$99,999'],
};

export const WORK_OPTIONS: Record<number, string[]> = {
  1: [
    'I work remotely full-time (5 days/week from home)',
    'I work a hybrid schedule (at least part of my week is remote)',
  ],
  2: [
    'I work on-site / in-person full-time',
    'I work a hybrid schedule (at least part of my week is remote)',
  ],
  3: [
    'I work a hybrid schedule (at least part of my week is remote)',
    'I am self-employed / freelance (primarily work from home)',
  ],
  4: [
    'I work on-site / in-person full-time',
    'I am retired',
  ],
  5: [
    'I work on-site / in-person full-time',
    'I work a hybrid schedule (at least part of my week is remote)',
  ],
};

export const OUTDOOR_OPTIONS: Record<number, string[]> = {
  3: ['About once a month', '2-3 times per month'],
  5: ['A few times a year', 'About once a month'],
};

export const VARIATION_SEEDS: string[] = [
  // Positive / neutral
  'You lean slightly more practical than most in your group.',
  'You are more design-conscious than the average person in your segment.',
  'You are an early adopter who gets excited about innovative solutions.',
  'You prioritize durability and long-term value over aesthetics.',
  'You are very social and often host gatherings at your home.',
  // Skeptical / constrained (ensures realistic negativity in responses)
  'You tend to be more skeptical of new products and need strong evidence before committing.',
  'You are currently managing significant expenses and would not spend $23K on a non-essential purchase right now.',
  'You over-research purchases and rarely commit. You have had multiple home projects stall at the consideration stage.',
  'You are satisfied with your current home setup and see backyard structures as unnecessary for your lifestyle.',
  'You are frugal and believe $23K could be better spent on travel, education, or paying down the mortgage.',
  'You worry about HOA conflicts and neighborhood aesthetics. You avoid anything that might cause friction with neighbors.',
  'You have decision fatigue from recent large purchases and are not looking to add another project to your plate.',
  'You read every negative review first and weight risks more heavily than potential benefits.',
];

// --- Emotion Taxonomy ---

export const EMOTION_TAXONOMY = [
  'excitement',
  'skepticism',
  'anxiety',
  'curiosity',
  'indifference',
  'aspiration',
  'frustration',
  'pragmatism',
] as const;

// --- Analytics Keys ---

export const LIKERT_KEYS: Record<string, string> = {
  Q0b: 'Category Interest',
  Q1: 'Purchase Interest ($23K)',
  Q2: 'Purchase Likelihood (24mo)',
  Q7: 'Permit-Light Effect',
  Q15: 'Value: Permit-Light',
  Q16: 'Value: Install Speed',
  Q17: 'Value: Build Quality',
  Q17b: 'Value: Smart Technology',
  Q17c: 'Value: Showroom',
  Q19: 'Sponsorship Impact',
};

export const BARRIER_KEYS: Record<string, string> = {
  Q5_cost: 'Cost (~$23K)',
  Q5_hoa: 'HOA Restrictions',
  Q5_permit: 'Permit Uncertainty',
  Q5_space: 'Limited Space',
  Q5_financing: 'Lack of Financing',
  Q5_quality: 'Build Quality Concerns',
  Q5_resale: 'Resale Value Uncertainty',
};

export const CONCEPT_APPEAL: Record<string, string> = {
  Q9a: 'Home Office',
  Q9b: 'Home Office (Likelihood)',
  Q10a: 'Guest Suite / STR',
  Q10b: 'Guest Suite (Likelihood)',
  Q11a: 'Wellness Studio',
  Q11b: 'Wellness (Likelihood)',
  Q12a: 'Adventure Basecamp',
  Q12b: 'Adventure (Likelihood)',
  Q13a: 'Simplicity',
  Q13b: 'Simplicity (Likelihood)',
};

export const CATEGORICAL_KEYS = ['Q3', 'Q6', 'Q14', 'Q18', 'Q20_1', 'Q20_2'] as const;

export const DEMOGRAPHIC_KEYS: Record<string, string> = {
  Q21: 'Age',
  Q22: 'Income',
  Q23: 'Work Arrangement',
};

export const ALL_NUMERIC_KEYS: string[] = [
  ...Object.keys(LIKERT_KEYS),
  ...Object.keys(BARRIER_KEYS),
  ...Object.keys(CONCEPT_APPEAL),
  'Q30',
];

// --- Survey Keys (ordered) ---

export const SURVEY_KEYS: string[] = [
  'S3', 'Q0a', 'Q0b', 'Q1', 'Q2', 'Q3',
  'Q5_cost', 'Q5_hoa', 'Q5_permit', 'Q5_space', 'Q5_financing', 'Q5_quality', 'Q5_resale',
  'Q6', 'Q7',
  'Q9a', 'Q9b', 'Q10a', 'Q10b', 'Q11a', 'Q11b', 'Q12a', 'Q12b', 'Q13a', 'Q13b',
  'Q14', 'Q15', 'Q16', 'Q17', 'Q17b', 'Q17c', 'Q18', 'Q19',
  'Q21', 'Q22', 'Q23', 'Q24', 'Q25', 'Q26', 'Q30',
];

// --- Response Schema (for survey JSON format) ---

export const RESPONSE_SCHEMA = `{
  "S3": "Yes | I'm not sure, but possibly",
  "Q0a": "Yes, I have actively researched or priced options | Yes, I have thought about it but not researched it | I'm aware it's possible but haven't seriously considered it | No, I have never considered this",
  "Q0b": "1-5 (integer, 1=Not at all interested, 5=Extremely interested)",
  "Q1": "1-5 (integer, 1=Not at all interested, 5=Extremely interested)",
  "Q2": "1-5 (integer, 1=Definitely would not, 5=Definitely would)",
  "Q3": "Home office / remote workspace | Guest suite / short-term rental (STR) income | Wellness studio (gym, yoga, meditation) | Adventure basecamp (gear storage, bike workshop, hangout space) | General storage / premium speed shed | Creative studio (music, podcast, art) | Children's playroom | Other",
  "Q5_cost": "1-5 (integer, 1=Would not reduce at all, 5=Would strongly reduce)",
  "Q5_hoa": "1-5",
  "Q5_permit": "1-5",
  "Q5_space": "1-5",
  "Q5_financing": "1-5",
  "Q5_quality": "1-5",
  "Q5_resale": "1-5",
  "Q6": "The total cost (~$23,000) | HOA restrictions or community rules | Uncertainty about whether a building permit is required | Limited backyard space or access | Lack of financing options | Concerns about build quality or durability | Uncertainty about resale value | None — I have no significant concerns",
  "Q7": "1-5 (integer, 1=Decreases my likelihood, 5=Greatly increases my likelihood)",
  "Q9a": "1-5", "Q9b": "1-5",
  "Q10a": "1-5", "Q10b": "1-5",
  "Q11a": "1-5", "Q11b": "1-5",
  "Q12a": "1-5", "Q12b": "1-5",
  "Q13a": "1-5", "Q13b": "1-5",
  "Q14": "Concept 1: Backyard Home Office | Concept 2: Guest Suite / STR Income | Concept 3: Wellness / Studio Space | Concept 4: Adventure Lifestyle / Community | Concept 5: Simplicity (Transparency + Speed + Less Headache) | None of the above",
  "Q15": "1-5", "Q16": "1-5", "Q17": "1-5",
  "Q17b": "1-5 (integer, 1=Not at all valuable, 5=Extremely valuable)",
  "Q17c": "1-5 (integer, 1=Not at all valuable, 5=Extremely valuable)",
  "Q18": "Permit-light positioning | Installation speed | Build quality and details | Smart Technology | Showroom",
  "Q19": "1-5 (integer, 1=Decrease a lot, 5=Increase a lot)",
  "Q20": ["list of 1-2 from: Outdoor club sponsorships / community events, Social media ads (Facebook, Instagram), Google / Search ads, Home improvement expos, Real estate partner referrals, Friend / family referral, Social media posts on vendor accounts (e.g., Neo Smart Living's Instagram, Facebook, TikTok), YouTube videos (reviews, walkthroughs, install timelapses), Neighborhood / Nextdoor recommendations, Online reviews / rating sites, None of the above"],
  "Q21": "age bracket string",
  "Q22": "income bracket string",
  "Q23": "work arrangement string",
  "Q24": "Yes | No | I'm not sure",
  "Q25": "Never | A few times a year | About once a month | 2-3 times per month | Weekly or more",
  "Q26": "Yes | No",
  "Q30": "3 (ALWAYS answer 3 for the attention check)"
}`;

// --- First Names (for respondent generation) ---

export const FIRST_NAMES: string[] = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery',
  'Dakota', 'Reese', 'Skyler', 'Jamie', 'Drew', 'Sage', 'Rowan', 'Emery',
  'Cameron', 'Hayden', 'Parker', 'Finley', 'Peyton', 'Kendall', 'Tatum', 'Blake',
  'Marley', 'Remy', 'Ellis', 'Lennox', 'Phoenix', 'Kai',
];

// --- Segment Profiles (for demo mode seed data generation) ---

export const SEGMENT_PROFILES: Record<number, SegmentProfile> = {
  1: { // Remote Professional — high office appeal, moderate overall
    Q0a: ['Yes, I have thought about it but not researched it', "I'm aware it's possible but haven't seriously considered it"],
    Q0b: [3.8, 0.8], Q1: [3.9, 0.7], Q2: [3.3, 0.9],
    Q3: ['Home office / remote workspace', 'Home office / remote workspace', 'Home office / remote workspace', 'Home office / remote workspace', 'Home office / remote workspace', 'Creative studio (music, podcast, art)'],
    Q5_cost: [2.5, 0.9], Q5_hoa: [3.2, 1.0], Q5_permit: [2.8, 0.9],
    Q5_space: [2.2, 0.8], Q5_financing: [2.0, 0.7], Q5_quality: [2.4, 0.8], Q5_resale: [2.6, 0.9],
    Q6: ['HOA restrictions or community rules', 'HOA restrictions or community rules', 'HOA restrictions or community rules', 'The total cost (~$23,000)', 'The total cost (~$23,000)', 'Uncertainty about whether a building permit is required'],
    Q7: [4.0, 0.7],
    Q9a: [4.3, 0.6], Q9b: [3.8, 0.7],
    Q10a: [2.8, 0.9], Q10b: [2.4, 0.8],
    Q11a: [3.0, 0.8], Q11b: [2.6, 0.9],
    Q12a: [2.2, 0.8], Q12b: [1.9, 0.7],
    Q13a: [3.8, 0.7], Q13b: [3.4, 0.8],
    Q14: ['Concept 1: Backyard Home Office', 'Concept 1: Backyard Home Office', 'Concept 1: Backyard Home Office', 'Concept 1: Backyard Home Office', 'Concept 5: Simplicity', 'Concept 5: Simplicity'],
    Q15: [3.9, 0.7], Q16: [3.5, 0.8], Q17: [3.8, 0.7],
    Q17b: [3.6, 0.7], Q17c: [2.8, 0.9],
    Q18: ['Permit-light positioning', 'Permit-light positioning', 'Permit-light positioning', 'Build quality and details', 'Smart Technology', 'Installation speed'],
    Q19: [2.8, 0.8],
    Q20: [
      ['Social media ads (Facebook, Instagram)', 'Google / Search ads'],
      ['Google / Search ads', 'Friend / family referral'],
      ['Social media ads (Facebook, Instagram)', 'Home improvement expos'],
      ['Google / Search ads'],
      ['Friend / family referral', 'Social media ads (Facebook, Instagram)'],
      ['Home improvement expos', 'Google / Search ads'],
    ],
  },
  2: { // Active Adventurer — high adventure appeal, sponsorship positive
    Q0a: ["I'm aware it's possible but haven't seriously considered it", 'No, I have never considered this', 'Yes, I have thought about it but not researched it'],
    Q0b: [3.2, 0.9], Q1: [3.4, 0.8], Q2: [2.8, 0.9],
    Q3: ['Adventure basecamp (gear storage, bike workshop, hangout space)', 'Adventure basecamp (gear storage, bike workshop, hangout space)', 'Adventure basecamp (gear storage, bike workshop, hangout space)', 'Adventure basecamp (gear storage, bike workshop, hangout space)', 'General storage / premium speed shed', 'Creative studio (music, podcast, art)'],
    Q5_cost: [3.5, 0.8], Q5_hoa: [2.5, 0.9], Q5_permit: [2.3, 0.8],
    Q5_space: [2.8, 0.9], Q5_financing: [3.2, 0.8], Q5_quality: [2.6, 0.8], Q5_resale: [2.4, 0.9],
    Q6: ['The total cost (~$23,000)', 'The total cost (~$23,000)', 'The total cost (~$23,000)', 'Lack of financing options', 'Lack of financing options', 'Limited backyard space or access'],
    Q7: [3.6, 0.8],
    Q9a: [2.5, 0.8], Q9b: [2.2, 0.8],
    Q10a: [2.3, 0.9], Q10b: [2.0, 0.8],
    Q11a: [2.8, 0.8], Q11b: [2.4, 0.8],
    Q12a: [4.4, 0.5], Q12b: [3.9, 0.7],
    Q13a: [3.2, 0.8], Q13b: [2.8, 0.9],
    Q14: ['Concept 4: Adventure Lifestyle / Community', 'Concept 4: Adventure Lifestyle / Community', 'Concept 4: Adventure Lifestyle / Community', 'Concept 4: Adventure Lifestyle / Community', 'Concept 4: Adventure Lifestyle / Community', 'Concept 3: Wellness / Studio Space'],
    Q15: [3.2, 0.8], Q16: [3.6, 0.7], Q17: [3.4, 0.8],
    Q17b: [3.0, 0.8], Q17c: [2.4, 0.9],
    Q18: ['Installation speed', 'Installation speed', 'Installation speed', 'Build quality and details', 'Build quality and details', 'Showroom'],
    Q19: [4.2, 0.6],
    Q20: [
      ['Outdoor club sponsorships / community events', 'Social media ads (Facebook, Instagram)'],
      ['Outdoor club sponsorships / community events', 'Friend / family referral'],
      ['Social media ads (Facebook, Instagram)', 'Outdoor club sponsorships / community events'],
      ['Outdoor club sponsorships / community events'],
      ['Friend / family referral', 'Outdoor club sponsorships / community events'],
      ['Social media ads (Facebook, Instagram)', 'Friend / family referral'],
    ],
  },
  3: { // Wellness Seeker — high wellness appeal
    Q0a: ['Yes, I have thought about it but not researched it', "I'm aware it's possible but haven't seriously considered it"],
    Q0b: [3.6, 0.8], Q1: [3.7, 0.7], Q2: [3.1, 0.9],
    Q3: ['Wellness studio (gym, yoga, meditation)', 'Wellness studio (gym, yoga, meditation)', 'Wellness studio (gym, yoga, meditation)', 'Wellness studio (gym, yoga, meditation)', 'Creative studio (music, podcast, art)', 'Home office / remote workspace'],
    Q5_cost: [2.8, 0.8], Q5_hoa: [3.0, 0.9], Q5_permit: [2.6, 0.8],
    Q5_space: [2.5, 0.8], Q5_financing: [2.3, 0.7], Q5_quality: [2.8, 0.8], Q5_resale: [2.5, 0.8],
    Q6: ['HOA restrictions or community rules', 'HOA restrictions or community rules', 'The total cost (~$23,000)', 'The total cost (~$23,000)', 'Concerns about build quality or durability', "None \u2014 I have no significant concerns"],
    Q7: [3.8, 0.7],
    Q9a: [3.2, 0.8], Q9b: [2.8, 0.8],
    Q10a: [2.6, 0.9], Q10b: [2.3, 0.8],
    Q11a: [4.5, 0.5], Q11b: [4.0, 0.6],
    Q12a: [2.6, 0.8], Q12b: [2.2, 0.8],
    Q13a: [3.5, 0.7], Q13b: [3.1, 0.8],
    Q14: ['Concept 3: Wellness / Studio Space', 'Concept 3: Wellness / Studio Space', 'Concept 3: Wellness / Studio Space', 'Concept 3: Wellness / Studio Space', 'Concept 1: Backyard Home Office', 'Concept 5: Simplicity'],
    Q15: [3.6, 0.7], Q16: [3.3, 0.8], Q17: [4.0, 0.6],
    Q17b: [3.4, 0.7], Q17c: [3.0, 0.8],
    Q18: ['Build quality and details', 'Build quality and details', 'Build quality and details', 'Showroom', 'Permit-light positioning', 'Smart Technology'],
    Q19: [3.2, 0.8],
    Q20: [
      ['Social media ads (Facebook, Instagram)', 'Friend / family referral'],
      ['Home improvement expos', 'Social media ads (Facebook, Instagram)'],
      ['Friend / family referral', 'Social media ads (Facebook, Instagram)'],
      ['Social media ads (Facebook, Instagram)'],
      ['Google / Search ads', 'Friend / family referral'],
      ['Home improvement expos', 'Friend / family referral'],
    ],
  },
  4: { // Property Maximizer — high guest suite, ROI focus
    Q0a: ['Yes, I have actively researched or priced options', 'Yes, I have thought about it but not researched it'],
    Q0b: [4.0, 0.7], Q1: [4.1, 0.6], Q2: [3.6, 0.8],
    Q3: ['Guest suite / short-term rental (STR) income', 'Guest suite / short-term rental (STR) income', 'Guest suite / short-term rental (STR) income', 'Guest suite / short-term rental (STR) income', 'Guest suite / short-term rental (STR) income', 'Home office / remote workspace'],
    Q5_cost: [1.8, 0.7], Q5_hoa: [3.8, 0.7], Q5_permit: [3.5, 0.8],
    Q5_space: [1.6, 0.6], Q5_financing: [1.5, 0.5], Q5_quality: [3.0, 0.8], Q5_resale: [3.4, 0.8],
    Q6: ['HOA restrictions or community rules', 'HOA restrictions or community rules', 'HOA restrictions or community rules', 'Uncertainty about whether a building permit is required', 'Uncertainty about whether a building permit is required', 'Uncertainty about resale value'],
    Q7: [4.2, 0.6],
    Q9a: [3.0, 0.8], Q9b: [2.6, 0.8],
    Q10a: [4.4, 0.5], Q10b: [4.0, 0.6],
    Q11a: [2.4, 0.8], Q11b: [2.0, 0.7],
    Q12a: [1.8, 0.7], Q12b: [1.5, 0.5],
    Q13a: [3.6, 0.7], Q13b: [3.2, 0.8],
    Q14: ['Concept 2: Guest Suite / STR Income', 'Concept 2: Guest Suite / STR Income', 'Concept 2: Guest Suite / STR Income', 'Concept 2: Guest Suite / STR Income', 'Concept 2: Guest Suite / STR Income', 'Concept 5: Simplicity'],
    Q15: [4.0, 0.6], Q16: [3.8, 0.7], Q17: [4.2, 0.5],
    Q17b: [3.8, 0.6], Q17c: [3.6, 0.7],
    Q18: ['Build quality and details', 'Build quality and details', 'Smart Technology', 'Permit-light positioning', 'Showroom', 'Installation speed'],
    Q19: [2.4, 0.8],
    Q20: [
      ['Real estate partner referrals', 'Home improvement expos'],
      ['Google / Search ads', 'Real estate partner referrals'],
      ['Home improvement expos', 'Real estate partner referrals'],
      ['Real estate partner referrals'],
      ['Home improvement expos', 'Google / Search ads'],
      ['Real estate partner referrals', 'Friend / family referral'],
    ],
  },
  5: { // Budget-Conscious DIYer — cost-sensitive, practical
    Q0a: ["I'm aware it's possible but haven't seriously considered it", 'No, I have never considered this'],
    Q0b: [2.8, 0.9], Q1: [2.6, 0.9], Q2: [2.1, 0.8],
    Q3: ['General storage / premium speed shed', 'General storage / premium speed shed', 'General storage / premium speed shed', 'Creative studio (music, podcast, art)', 'Creative studio (music, podcast, art)', "Children's playroom"],
    Q5_cost: [4.3, 0.6], Q5_hoa: [2.4, 0.9], Q5_permit: [2.8, 0.8],
    Q5_space: [3.0, 0.9], Q5_financing: [4.0, 0.7], Q5_quality: [3.2, 0.8], Q5_resale: [3.0, 0.9],
    Q6: ['The total cost (~$23,000)', 'The total cost (~$23,000)', 'The total cost (~$23,000)', 'Lack of financing options', 'Lack of financing options', 'Limited backyard space or access'],
    Q7: [3.8, 0.7],
    Q9a: [2.6, 0.8], Q9b: [2.2, 0.8],
    Q10a: [2.2, 0.8], Q10b: [1.8, 0.7],
    Q11a: [2.4, 0.8], Q11b: [2.0, 0.7],
    Q12a: [2.2, 0.8], Q12b: [1.8, 0.7],
    Q13a: [4.0, 0.6], Q13b: [3.5, 0.8],
    Q14: ['Concept 5: Simplicity', 'Concept 5: Simplicity', 'Concept 5: Simplicity', 'Concept 5: Simplicity', 'Concept 1: Backyard Home Office', 'None of the above'],
    Q15: [4.2, 0.6], Q16: [3.8, 0.7], Q17: [3.0, 0.8],
    Q17b: [2.6, 0.9], Q17c: [2.2, 0.9],
    Q18: ['Permit-light positioning', 'Permit-light positioning', 'Permit-light positioning', 'Permit-light positioning', 'Installation speed', 'Installation speed'],
    Q19: [2.6, 0.9],
    Q20: [
      ['Google / Search ads', 'Social media ads (Facebook, Instagram)'],
      ['Social media ads (Facebook, Instagram)', 'Friend / family referral'],
      ['Google / Search ads'],
      ['Friend / family referral', 'Google / Search ads'],
      ['Social media ads (Facebook, Instagram)'],
      ['Home improvement expos', 'Google / Search ads'],
    ],
  },
};

// --- Model Bias (for demo mode data generation) ---

export const MODEL_BIAS: ModelBias = {
  'GPT-4.1-mini': 0.15,
  'Gemini-2.5-Flash': -0.10,
  'Claude-Sonnet-4.6': 0.05,
};

// --- OpenRouter ---

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MAX_RETRIES = 3;
export const DEFAULT_TEMPERATURE = 0.8;
export const DEFAULT_MAX_TOKENS = 3000;
export const REQUEST_TIMEOUT_MS = 240_000;
export const RESPONDENTS_PER_SEGMENT_PER_MODEL = 6;


// --- Concurrency ---
export const MAX_CONCURRENT_API_CALLS = 5;

// --- Derived keys for stage 4/5 ---
export const ALL_LIKERT_KEYS = Object.keys(LIKERT_KEYS);

export const SEGMENT_PROFILE_KEYS = [
  'Q1', 'Q2',
  'Q6a', 'Q6b', 'Q6c', 'Q6d', 'Q6e',
  'Q7', 'Q8', 'Q9',
  'Q10', 'Q11', 'Q12',
  'Q17', 'Q19',
];

// --- Stage 1: Discovery Questions ---
// ── Founder Brief: Real data from Tony Koo (CEO) client visit ──────────────

export const FOUNDER_BRIEF = `
COMPANY: Neo Smart Living (neosmartliving.com)
FOUNDER: Tony Koo — adventurer, forward-thinker, deep experience in recreational living, modular homes, and mobility-based design.
MISSION: "We don't just build structures — we build new ways to live, explore, and invest in the future."

PRODUCT — TAHOE MINI:
- Size: 117 sq ft (intentionally under ~120 sq ft California threshold to avoid permits in most jurisdictions)
- Price: ~$23,000 delivered and professionally installed
- Install: Panelized delivery supports limited-access backyards; larger units may require truck access or crane
- Features: Pre-wired electrical, pitched roof with drainage, double-pane glass, optional upgrades (sound insulation)
- Best seller in the Neo Smart Living lineup. 2025 revenue in the seven figures (exact number not disclosed).
- Description: "The easiest of installs and sized for nearly every backyard. Tahoe Mini's bright and open studio layout is your blank canvas."

USE CASES CITED BY FOUNDER: Backyard office, guest room, premium "speed shed" storage, music/podcast studio, pool room, playroom for kids, short-term rental stays.

MARKET:
- ~70% residential/backyard customers, ~30% light industrial/commercial (warehouse office, conference room)
- Growth has been largely referral/word-of-mouth; starting to test paid channels (Facebook suggested for older homeowner demographics)

VALUE DRIVERS (from client visit):
1. Permit avoidance — often avoids permits; still verify city ordinances and HOA rules
2. Speed/fulfillment — weekly installs, local inventory
3. Quality/build details — pre-wired electrical, pitched roof/drainage, double-pane glass, optional sound insulation

COMPETITION: Many resellers/importers with lower-grade materials and weaker after-sales support. Boxable discussed but positioned as less direct competitor (ADU/housing focus, heavier certification/permitting burden).

ENVIRONMENTAL ANGLE: Building and construction accounts for 39% of global carbon emissions; 40% of construction materials end up in landfills. Neo Smart Living's prefab units are manufactured in controlled environments — less waste, less energy, customizable.

COMMUNITY STRATEGY: Target outdoor adventurers and social groups — mountain bike clubs, ATV clubs, outdoor yoga communities, mobile music studios. Method: sponsorship and community participation. Sample collaborator: Inland Empire Mountain Bike Club (IE-MTB, 1,548 followers on Instagram).

RESEARCH GOAL (founder's words): "This product is currently our best seller and the one we want to invest more time and effort into promoting. We'd like to understand whether there's genuine market demand — how many people would be willing to install such a versatile, multi-purpose tiny home in their own backyard. We also want to identify which demographic groups we should focus our marketing and promotional efforts on."
`;

export const DISCOVERY_QUESTIONS: Record<string, string> = {
  DQ1: 'Based on the founder brief, what is the core value proposition of the Tahoe Mini? How does the permit-light positioning, professional installation, and $23,000 price point work together?',
  DQ2: 'The founder says the market is ~70% residential, ~30% commercial. For the residential segment, what are 3-4 distinct customer profiles that would buy this? Ground your answer in the use cases Tony Koo cited.',
  DQ3: 'What are the most significant barriers to purchase at $23,000? Consider that the founder identified permit avoidance, speed, and build quality as key value drivers — what concerns remain unaddressed?',
  DQ4: 'The founder says competitors are mostly resellers/importers with lower-grade materials. How should Neo Smart Living position the Tahoe Mini against these AND against traditional contractors and DIY sheds?',
  DQ5: 'Tony Koo\'s community strategy targets outdoor adventurers (MTB clubs, ATV clubs, yoga communities). Evaluate this strategy — is it the right audience for the Tahoe Mini, or should marketing focus elsewhere?',
  DQ6: 'The company has grown through referral/word-of-mouth and is starting to test Facebook ads for older homeowners. What marketing channel mix would most effectively reach the residential target audience?',
  DQ7: 'The Tahoe Mini is designed to be permit-light, but HOA restrictions and city ordinances still apply. How might this affect the addressable market, and how should Neo Smart Living address it in messaging?',
  DQ8: 'The founder cited these use cases: office, guest room, speed shed storage, music/podcast studio, pool room, playroom, short-term rental. Which have the strongest market appeal and why? Rank them.',
  DQ9: 'Neo Smart Living emphasizes environmental responsibility (prefab = less waste, less carbon). How much does this matter to the target buyer vs. practical concerns like price, permits, and installation speed?',
  DQ10: 'The founder wants to understand genuine market demand and which demographics to target. What research questions are most critical to answer in a quantitative survey of US homeowners?',
};

export const DISCOVERY_SYSTEM_PROMPT =
  `You are a senior market research strategist. You have been given a detailed founder brief from Tony Koo, CEO of Neo Smart Living, about their best-selling product the Tahoe Mini.

Your job is to analyze the founder's information and provide expert strategic recommendations. Ground your analysis in the REAL data provided — do not invent product details or company facts. You may add market context and strategic insight, but always anchor to what the founder actually shared.

FOUNDER BRIEF:
${FOUNDER_BRIEF}

Provide thorough, actionable analysis.`;
