# Pipeline Customization Guide

How to adapt the AYTM Synthetic Market Research Pipeline for any product or market.

## Overview

The pipeline is product-agnostic by design. All product-specific configuration lives in a few files under `src/lib/pipeline/`. The statistical engine (STAMP triangulation, Kruskal-Wallis, bootstrap CIs, grading) works automatically regardless of the product.

---

## What to Change (by file)

### 1. `src/lib/pipeline/constants.ts` — Segments, Personas & Survey Schema

#### Consumer Segments (`SEGMENTS` array, ~line 400)

Each segment defines a target consumer persona:

```typescript
{
  id: 1,
  name: 'Remote Professional',
  demographics: {
    Q21: '35-44',                // Age range
    Q22: '$100,000-$149,999',    // Income bracket
    Q23: 'I work remotely full-time',
    Q24: ['No'],                 // HOA status
    Q25: 'About once a month',   // Outdoor frequency
    Q26: 'No',                   // Club membership
  },
  psychographic:
    'You are a tech-forward professional who values quiet workspace...'
}
```

**To adapt:** Replace the 5 segments with ones relevant to your product. For a fitness app, you might use "Gym Regular", "Couch Potato", "Weekend Warrior", "Postpartum Parent", "Senior Active."

The `psychographic` string is the persona prompt — it tells the LLM who this consumer is, what they value, and what their objections might be.

#### Demographic Variation (`AGE_OPTIONS`, `INCOME_OPTIONS`, `WORK_OPTIONS`, `OUTDOOR_OPTIONS`)

Each segment has 2 possible values for age, income, and work arrangement, assigned deterministically per respondent via seeded RNG. This creates within-segment diversity.

```typescript
AGE_OPTIONS: {
  1: ['25-34', '35-44'],  // Segment 1 can be 25-44
  2: ['25-34', '35-44'],  // Segment 2 same range
  ...
}
```

**To adapt:** Match the demographic ranges to your target market.

#### Variation Seeds (`VARIATION_SEEDS` array, ~line 530)

Personality modifiers appended to each respondent's prompt. Currently 13 seeds (5 positive, 8 skeptical):

```
Positive:
- "You lean slightly more practical than most in your group."
- "You are an early adopter who gets excited about innovative solutions."

Skeptical:
- "You tend to be more skeptical of new products..."
- "You are currently managing significant expenses..."
- "You are frugal and believe $23K could be better spent..."
```

**To adapt:** Write seeds that reflect your product's realistic buyer/non-buyer psychology. Maintain a ~60-75% skeptical ratio for realism.

#### Survey Schema (`RESPONSE_SCHEMA`)

The hardcoded survey instrument defining every question, answer type, and valid options. This is what respondents "fill out."

**To adapt:** Replace with your own survey questions. Keep the structure (Likert 1-5, categorical, multi-select) and include an attention check question.

### 2. `src/lib/pipeline/stage1.ts` — Discovery Questions

The `DISCOVERY_QUESTIONS` array contains 10 strategic questions asked to the 3 LLMs about the product:

```
DQ1: What is the core value proposition?
DQ2: Who are the ideal customer profiles?
DQ3: What are the key barriers to adoption?
...
```

**To adapt:** Replace with questions relevant to your product's market positioning, competitive landscape, and target audience.

### 3. `src/lib/pipeline/stage2.ts` — Interview Questions & Probes

#### Main Questions (`INTERVIEW_QUESTIONS`, IQ1-IQ8)

Eight depth-interview questions asked to 30 simulated consumers:

```
IQ1: How do you currently use your backyard?
IQ2: What unmet needs do you have for outdoor space?
...
```

#### Follow-Up Probes (`FOLLOW_UP_PROBES`, FU1-FU5)

Conditional follow-ups triggered by specific response patterns:

```
FU1 (cost concern): "What if financing was available at $350/month?"
FU2 (high interest): "Walk me through your ideal scenario."
FU3 (skepticism):   "What would build trust for you?"
```

**To adapt:** Write interview questions that explore your product's use cases, objections, and emotional triggers. Design follow-ups for the most common response patterns.

### 4. `src/lib/pipeline/stage4.ts` — Calibration Principles

The `buildSystemPrompt()` function (~line 170) contains:

- **Calibration Principles** — Qualitative guidance about consumer behavior for this product category
- **STAMP Codebook** — Per-question guidance on realistic response patterns
- **Response Rules** — Constraints on how the LLM should generate responses

**To adapt:** Replace the calibration principles with domain knowledge about your product's market. No exact statistics needed — qualitative guidance about consumer behavior is sufficient and avoids circular validation.

---

## What Stays the Same (product-agnostic)

| Component | Purpose |
|-----------|---------|
| STAMP 3-model triangulation | Cross-checks outputs across GPT, Gemini, Claude |
| Krippendorff's alpha | Measures inter-model agreement |
| Mann-Whitney U / Kruskal-Wallis | Tests for significant model differences |
| Bootstrap confidence intervals | Quantifies uncertainty |
| Kolmogorov-Smirnov tests | Compares distributions against benchmark |
| Stage 6 quality grading | Attention checks, straight-lining, bias detection |
| Sycophancy reduction | Third-person framing, rejection permission, skeptical seeds |
| Post-hoc acquiescence correction | Deflates suspiciously positive respondents |
| Deterministic seeding (Mulberry32) | Reproducible respondent assignment |

---

## Key Constants

| Constant | Current Value | What it controls |
|----------|--------------|-----------------|
| `RESPONDENTS_PER_SEGMENT_PER_MODEL` | 6 | Respondents per segment per model |
| `MAX_CONCURRENT_API_CALLS` | 5 | Parallel OpenRouter calls |
| `VARIATION_SEEDS.length` | 13 | Number of personality variations |
| `SEGMENTS.length` | 5 | Number of consumer segments |
| `MODEL_IDS` | 3 models | Which LLMs to use via OpenRouter |
| **Total respondents** | **90** | segments × per_segment × 3 models |

---

## Example: Adapting for a $50/month Fitness App

1. **Segments**: "Gym Enthusiast" (25-34, active), "Busy Parent" (30-44, time-poor), "Senior Health" (55+, mobility-focused), "Budget Conscious" (18-24, student), "Corporate Wellness" (35-50, employer-sponsored)

2. **Seeds**: "You've tried 5 fitness apps and abandoned all of them", "You prefer in-person classes and distrust digital solutions", "You're motivated but overwhelmed by too many options"

3. **Calibration**: "Most consumers have tried free fitness apps and see little reason to pay $50/month. Retention is the core challenge, not acquisition."

4. **Interview questions**: "What does your current fitness routine look like?", "What's caused you to stop using fitness apps in the past?"

The pipeline handles the rest — triangulation, statistical analysis, and grading all work automatically.
