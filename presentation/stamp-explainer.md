---
title: "Understanding STAMP, Data Analysis & Validation"
subtitle: "AYTM Synthetic Market Research Pipeline — Technical Explainer"
date: "CPP AI Hackathon 2026 Finals"
---

# What Problem Are We Solving?

When you ask an AI to pretend to be a consumer and answer survey questions, it has a natural tendency to be agreeable. Ask it "Would you buy this product?" and it will almost always say yes. This is called **sycophancy** — the AI wants to be helpful, so it tells you what it thinks you want to hear.

Our pipeline doesn't use one AI. It uses **three completely different AI models**, each built by a different company (OpenAI, Google, and Anthropic), each trained on different data. We then use statistics to measure whether these three models agree with each other — and whether their answers look anything like what real humans actually said in a real survey.

That's what this document explains: how we check, cross-check, and grade the quality of AI-generated survey data.

---

# Part 1: STAMP — How Three AIs Keep Each Other Honest

## What STAMP Stands For

**S**tructured **T**axonomy **A**I **M**easurement **P**rotocol

In plain English: a system where three independent AI models each do the same task separately, and then we mathematically measure how much they agree.

## Why Three Models Instead of One?

Think of it like getting a second opinion from a doctor — except we get a third opinion too. Each AI model was built by a different company:

- **GPT-4.1-mini** (by OpenAI) — fast and affordable
- **Gemini 2.5 Flash** (by Google) — the cheapest option
- **Claude Sonnet 4.6** (by Anthropic) — the most capable

Because each model learned from different training data, they each have different blind spots and biases. When all three independently reach the same conclusion, that conclusion is much more trustworthy than if only one model said it.

## Where STAMP Is Used in the Pipeline

STAMP appears three times:

### 1. Emotion Classification (Stage 2)

After the pipeline generates 30 simulated consumer interviews, all three models independently read each interview and classify the person's dominant emotion from a list of eight: excitement, skepticism, anxiety, curiosity, indifference, aspiration, frustration, or pragmatism.

If two or three models agree on the emotion, we accept that classification. If all three disagree, we use a tie-breaking rule (highest intensity wins).

### 2. Theme Extraction (Stage 2)

Each model independently reads all 30 interviews and identifies the major themes — recurring topics like "cost concerns," "space limitations," or "work-from-home needs." We then measure how much overlap exists between each pair of models using a metric called **Jaccard similarity** (explained below).

### 3. Interpretation Agreement (Stage 5)

After all the survey data is collected, each model independently answers eight high-level questions about the results:

| Question | Example Answer |
|----------|---------------|
| What's the biggest barrier to purchase? | Cost |
| How confident is that conclusion? | Strong (>50%) |
| What's the primary use case? | Home office |
| What's the overall purchase intent level? | Low |
| Which segment is most interested? | Remote Professionals |
| Which segment is least interested? | Budget-Conscious DIYers |
| Which product concept tested best? | Wellness studio |
| How ready is the market? | Early stage |

We then count how many of these eight questions all three models answered identically. If they agree on 6 out of 8, the agreement rate is 75%.

## How We Measure Agreement: Krippendorff's Alpha

This is the key statistical measure behind STAMP. Named after Klaus Krippendorff, a communication researcher, it answers a simple question: **"Are these raters agreeing more than random chance would predict?"**

Here's the intuition:

- **Alpha = 1.0** — Perfect agreement. All three models gave identical answers every time.
- **Alpha = 0.0** — No better than random. The models agree only as often as you'd expect by flipping coins.
- **Alpha < 0.0** — Worse than random. The models are systematically disagreeing.

The formula works by comparing two things:

1. **Observed disagreement** — How much do the models actually disagree with each other?
2. **Expected disagreement** — How much disagreement would we expect if they were answering randomly?

$$\alpha = 1 - \frac{\text{observed disagreement}}{\text{expected disagreement}}$$

### Our Threshold

We require **α ≥ 0.667** (about two-thirds) for STAMP to pass. This is a well-established threshold in social science research — it means "acceptably reliable." For reference:

| Alpha Range | What It Means |
|-------------|--------------|
| 0.8 or higher | Excellent — models strongly agree |
| 0.667 to 0.8 | Acceptable — reliable enough to draw conclusions |
| 0.4 to 0.667 | Moderate — use with caution |
| Below 0.4 | Poor — models are essentially guessing differently |

### Jaccard Similarity (for Theme Overlap)

For theme extraction, we use a simpler measure. Jaccard similarity asks: "Of all the unique themes that any two models identified, how many did they both find?"

$$\text{Jaccard} = \frac{\text{themes both models found}}{\text{themes either model found}}$$

- **Above 0.5** — Strong overlap (the models found mostly the same themes)
- **0.3 to 0.5** — Moderate overlap
- **Below 0.3** — Weak overlap (the models are picking up on different things)

---

# Part 2: Data Analysis — What We Measure and How

After 90 synthetic respondents complete the survey (5 consumer segments × 6 respondents per segment × 3 AI models), Stage 5 runs **11 different analyses** on the data. Here's what each one does and why it matters.

## Analysis 1 & 2: Descriptive Statistics

**What it does:** Calculates basic summary numbers — the average (mean), spread (standard deviation), middle value (median), and range of the middle 50% of responses (interquartile range) — for every survey question. It does this twice: once grouped by consumer segment (e.g., "Remote Professionals" vs. "Budget DIYers") and once grouped by AI model (GPT vs. Gemini vs. Claude).

**Why it matters:** This is the foundation. If Remote Professionals rate purchase interest at 3.2 but Budget DIYers rate it at 1.8, that's a meaningful difference the client can act on.

## Analysis 3: Model Comparison (Mann-Whitney U + Kruskal-Wallis)

**What it does:** Tests whether the three AI models produced statistically different response patterns.

**Mann-Whitney U** compares two models at a time. For each pair (GPT vs. Gemini, GPT vs. Claude, Gemini vs. Claude), it asks: "Did these two models generate significantly different answers for this question?" It works by ranking all responses from both models together, then checking if one model's responses cluster higher or lower than the other's.

**Kruskal-Wallis H** compares all three models simultaneously. It's like a three-way version of the Mann-Whitney test. If the result is significant (p < 0.05), it means at least one model is behaving differently from the others.

**Why it matters:** If the models disagree on a question, we can't trust that question's results as much. If they agree, the finding is more robust. We also report an **effect size** (how big the difference is, not just whether it exists) so we can distinguish meaningful disagreements from trivial ones.

## Analysis 4: Barrier Heatmap

**What it does:** Creates a grid showing how strongly each consumer segment feels about each purchase barrier (cost, HOA restrictions, permits, limited space, financing, quality concerns, and resale value). Each cell contains the average severity rating on a 1–5 scale.

**Why it matters:** This is one of the most actionable outputs. If Remote Professionals rate cost at 4.5 but permits at 1.2, the client knows exactly which objection to address for that segment.

## Analysis 5: Segment Profiles

**What it does:** Summarizes each consumer segment across key variables — purchase interest, likelihood, barrier sensitivities, and concept appeal.

**Why it matters:** Gives the client a one-page "portrait" of each customer type.

## Analysis 6: Categorical Distributions

**What it does:** For questions with fixed answer choices (like "What would you primarily use this for?" or "What's your biggest concern?"), it counts how many respondents in each segment chose each option.

**Why it matters:** Some questions aren't on a 1–5 scale — they're multiple choice. This analysis handles those.

## Analysis 7: Inter-LLM Reliability (STAMP Core)

**What it does:** This is the heart of STAMP. For every survey question, it computes Krippendorff's alpha across the three models. It also computes an overall average alpha across all questions.

**How it works in practice:** Imagine the question is "Rate your purchase interest (1–5)." GPT's respondents averaged 2.1, Gemini's averaged 2.3, Claude's averaged 1.9. Are these meaningfully different, or is that just normal variation? Krippendorff's alpha answers this by looking at the item-level agreement (not just averages) and accounting for chance.

**The pass/fail threshold:** Overall alpha must be ≥ 0.667 for the STAMP certification to pass.

## Analysis 8: Benchmark Comparison

**What it does:** Compares our synthetic survey results against a **real survey of 600 actual US homeowners** conducted by the sponsor (aytm). This is the ultimate reality check.

**For numeric questions** (like purchase interest on a 1–5 scale), we use the **Kolmogorov-Smirnov (KS) test**. This test compares the full shape of two distributions — not just their averages, but how responses are spread across all values. It asks: "Could these two sets of answers have come from the same underlying population?"

- If the KS test says **no significant difference** (p ≥ 0.05): our synthetic data aligns with reality.
- If the KS test says **significant difference** (p < 0.05): our synthetic data diverges from reality on this question, and we report exactly how.

**For barrier questions** (how much does each barrier concern you?), we compare **top-2-box percentages** — the percentage of people who rated the barrier 4 or 5 out of 5. If the synthetic and real percentages are within 15 points of each other, we call it aligned.

**We compute an overall alignment score:** the percentage of all tests that passed.

## Analysis 9: STAMP Interpretation Agreement

**What it does:** The three models each read a summary of all the survey data and independently answer eight high-level interpretation questions (see Part 1 above). We measure how many they agree on.

**Why it matters:** This tests whether the models agree not just on individual data points, but on what the data means.

## Analysis 10: Disagreement Analysis

**What it does:** For every survey question, it compares the average response across models and flags any question where the models differ by more than 0.5 points on the 1–5 scale. It categorizes disagreements by severity:

| Difference | Severity |
|-----------|----------|
| Greater than 1.0 | Strong — the models fundamentally disagree |
| 0.75 to 1.0 | Moderate — notable divergence |
| 0.5 to 0.75 | Mild — small but measurable |

**Why it matters:** This is an early warning system. If the models strongly disagree on "Would you buy this?", that question's results should be treated with extra skepticism.

---

# Part 3: Validation & Grading — The Final Quality Gate

Stage 6 is entirely **deterministic** — no AI is involved. It's pure math applied to the survey responses to produce a letter grade (A through D) for the overall run.

## Step 1: Score Every Respondent (0–100)

Each of the 90 synthetic respondents gets a quality score based on three checks:

### Check 1: Attention Check (40% of score)

The survey includes a trick question (Q30) where the correct answer is exactly 3. In real surveys, researchers include these to catch people who aren't paying attention — they just click through randomly. We built the same check into our synthetic survey.

- **Pass:** The respondent answered Q30 = 3 → earns 100 points for this component
- **Fail:** Any other answer → earns 0 points

### Check 2: Response Variance / Straight-Lining Detection (30% of score)

"Straight-lining" is when someone gives the same answer to every question — like rating everything a 4. Real survey researchers watch for this because it means the person isn't actually thinking about each question.

We measure each respondent's **standard deviation** (how spread out their answers are) and count how many **unique values** they used.

- **Flagged as straight-lining:** Standard deviation < 0.3 AND fewer than 3 unique values → earns 0 points
- **Normal variation:** Score = min(100, (standard deviation / 1.5) × 100)

### Check 3: Response Uniqueness (30% of score)

Similar to the variance check, but focused purely on how many different answer values the respondent used across all questions.

- **Flagged:** Fewer than 3 distinct values → low score
- **Normal:** Score = min(100, (unique values / 5) × 100)

### Combined Quality Score

$$\text{Quality Score} = (0.4 \times \text{Attention}) + (0.3 \times \text{Variance}) + (0.3 \times \text{Uniqueness})$$

A respondent needs a score of **70 or above** to be considered good quality.

## Step 2: Detect Systematic Biases

Beyond individual respondent quality, we check for patterns across all 90 respondents that would indicate the AI models have a systematic bias. We run four statistical tests:

### Bias 1: Central Tendency Bias

**What it catches:** Are responses clustering around the middle value (3) too often? This happens when the AI "hedges" instead of committing to strong opinions.

**How we test:** We use a chi-squared test comparing the percentage of responses at value 3 against what we'd expect from a uniform distribution (20%). If significantly more than 20% of all answers are 3 (with p < 0.05), this bias is flagged.

**Flagged if:** More than 30% of all Likert responses are exactly 3.

### Bias 2: Acquiescence Bias

**What it catches:** Are responses skewing positive (4s and 5s) too often? This is the sycophancy problem — the AI agreeing with everything.

**How we test:** Same approach — chi-squared test comparing the percentage of agree responses (4 or 5) against the expected 40% under a uniform distribution.

**Flagged if:** More than 50% of all Likert responses are 4 or 5.

### Bias 3: Extreme Response Bias

**What it catches:** Are responses clustering at the extremes (1s and 5s) instead of using the full scale?

**How we test:** Chi-squared test on the percentage of extreme responses (1 or 5) against the expected 40%.

**Flagged if:** More than 40% of responses are at 1 or 5 (and statistically significant).

### Bias 4: Model Agreement (Suspiciously High Correlation)

**What it catches:** Are the three models producing responses that are *too* similar? If their average response patterns correlate above 0.95, it might mean they're all making the same errors rather than providing independent perspectives.

**How we test:** We compute the Pearson correlation between each pair of model-average vectors, then test whether the average correlation is significantly different from what we'd expect.

## Step 3: Bootstrap Confidence Intervals

For six key survey questions (purchase interest, purchase likelihood, cost barrier, space barrier, quality barrier, and permit-light impact), we compute **95% confidence intervals** using a technique called bootstrapping.

**What bootstrapping does in plain English:**

Imagine you could re-run the survey 1,000 times with slightly different groups of respondents. Each time, you'd get a slightly different average. Bootstrapping simulates this by randomly resampling from the data we already have:

1. Take the 90 responses and randomly pick 90 of them *with replacement* (some get picked twice, some not at all)
2. Calculate the average of this resampled group
3. Repeat 1,000 times
4. Sort all 1,000 averages from lowest to highest
5. The middle 95% range (from the 2.5th percentile to the 97.5th percentile) is your confidence interval

**Example:** If the bootstrap CI for purchase interest is [1.8, 2.6], we're saying: "We're 95% confident that the true average purchase interest, if we could run this with infinite respondents, falls somewhere between 1.8 and 2.6."

We use a fixed random seed (42) so the results are reproducible — run it again, get the exact same interval.

## Step 4: Assign a Letter Grade

Everything comes together in a final grade. The grading rubric:

| Grade | Requirements |
|-------|-------------|
| **A** | Fewer than 5 quality issues, all attention checks passed, zero statistically significant biases detected |
| **B** | 5–10 quality issues OR exactly 1 significant bias |
| **C** | 10–20 quality issues OR exactly 2 significant biases |
| **D** | More than 20 quality issues OR 3+ significant biases |

The system also generates a **written recommendation** — a paragraph explaining what the grade means, what specific issues were found (if any), and how to interpret the results. This is plain-English guidance like:

> "This run received a Grade B, indicating good overall quality with minor issues. 2 respondents were flagged for straight-lining. Acquiescence bias was detected at 52.3%, suggesting a mild tendency toward positive responses. Average quality score: 82. Model agreement correlation: 0.87."

---

# Part 4: Putting It All Together

Here's how STAMP, analysis, and validation work as a system:

```
Stage 4: 90 Synthetic Respondents Complete the Survey
                    │
                    ▼
    ┌───────────────────────────────┐
    │   Stage 5: Data Analysis      │
    │                               │
    │  • Descriptive statistics     │  ← What does the data say?
    │  • Model comparison tests     │  ← Do the 3 AIs agree?
    │  • STAMP reliability check    │  ← α ≥ 0.667?
    │  • Benchmark comparison       │  ← Does it match real data?
    │  • Disagreement flagging      │  ← Where do models diverge?
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │   Stage 6: Validation         │
    │                               │
    │  • Score each respondent      │  ← Quality 0–100
    │  • Detect systematic biases   │  ← 4 statistical tests
    │  • Bootstrap confidence       │  ← How precise are we?
    │  • Assign letter grade        │  ← A, B, C, or D
    └───────────────────────────────┘
```

**Stage 5 asks:** "What did we find, and can we trust it?"
**Stage 6 asks:** "Is the data itself good enough to draw conclusions from?"

Together, they ensure that every insight the pipeline produces comes with a measure of confidence, a reliability score, and an honest accounting of where the AI got it right — and where it didn't.

---

*AYTM × Neo Smart Living — CPP AI Hackathon 2026 Finals*
