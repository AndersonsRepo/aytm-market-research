# AYTM × Neo Smart Living — Hackathon Plan

## Challenge
Use synthetic respondents (LLM-generated) to simulate market research for Neo Smart Living's **Tahoe Mini** ($23K compact backyard unit, 117 sq ft). Compare synthetic results against a **real aytm benchmark** (N=600 US homeowners, 8 regional/gender quotas).

## Core Strategy: STAMP-Aligned 3-Model Triangulation

Per Dr. Lin's STAMP methodology and organizer guidance:
- Use **heterogeneous frontier models** from different families (GPT, Gemini, Claude)
- Measure **inter-LLM reliability** (Krippendorff's alpha), not just accuracy
- Treat disagreement as **diagnostic signal**, not noise
- Focus on getting **aggregate insights right** (segments, pricing, barriers) — not individual response realism
- **Benchmark against 3-5 key questions** from the real survey, not the full report

---

## Benchmark Data (Real aytm Survey, N=600)

### Survey Structure (38 questions + VanKonan pricing)
- **PQ1**: Outdoor space screening (94.5% Yes, 5.5% Maybe, 0% No — all qualified)
- **Q2**: Prior consideration of backyard structure
- **Q3**: General interest in backyard unit (1-5 Likert)
- **Q4-Q5**: Product description (Tahoe Mini info pages)
- **Q6**: Purchase interest at $23K (1-5 Likert)
- **Q7**: Purchase likelihood in 24 months (1-5 Likert)
- **Q8**: Primary use case
- **Q9**: Barrier severity matrix (7 barriers × 1-5 Likert)
- **Q10**: Open-ended additional concerns
- **Q11**: Single greatest barrier
- **Q12**: Attention check (100% pass — "Moderately interested")
- **Q13**: Concept test intro
- **Q14-Q28**: 5 concepts × (description + appeal + purchase likelihood)
- **Q29**: Most motivating concept
- **Q30**: Value driver ratings (5 advantages × 1-5 Likert)
- **Q31**: Top value driver
- **Q32**: Outdoor club partnership impact
- **Q33**: Outreach channel preferences
- **Q34**: Van Konan Price Optimization Model
- **Q35-Q37**: Demographics (HOA, outdoor activity, club membership)
- **Q38**: Open-ended final comments

### Key Real Results to Benchmark Against

#### 1. Purchase Interest at $23K (Q6) — BENCHMARK QUESTION
| Rating | Real (N=600) |
|--------|-------------|
| 1 - Not interested | 37.8% |
| 2 | 20.5% |
| 3 | 18.3% |
| 4 | 16.2% |
| 5 - Extremely interested | 7.2% |
**Mean ≈ 2.34** — Strongly left-skewed. Most respondents are NOT interested at $23K.

#### 2. Purchase Likelihood in 24 Months (Q7) — BENCHMARK QUESTION
| Rating | Real (N=600) |
|--------|-------------|
| 1 - Definitely would not | 45.3% |
| 2 | 22.8% |
| 3 | 18.8% |
| 4 | 7.7% |
| 5 - Definitely would | 5.3% |
**Mean ≈ 2.05** — Even more negative than interest. Strong "would not buy" signal.

#### 3. Primary Use Case (Q8) — BENCHMARK QUESTION
| Use Case | Real % |
|----------|--------|
| General storage / premium "speed shed" | 26.7% |
| Home office / remote workspace | 18.0% |
| Wellness studio (gym, yoga) | 14.8% |
| Other | 10.7% |
| Guest suite / STR income | 9.5% |
| Adventure basecamp | 9.0% |
| Creative studio | 8.2% |
| Children's playroom | 3.2% |
**Key insight**: Storage is #1 use case (not home office). This is a critical test — LLMs may over-index on "home office" because it's more prominent in training data.

#### 4. Greatest Single Barrier (Q11) — BENCHMARK QUESTION
| Barrier | Real % |
|---------|--------|
| Total cost (~$23K) | 59.7% |
| None / no concerns | 7.2% |
| Build quality/durability | 6.8% |
| Other | 6.0% |
| HOA restrictions | 5.8% |
| Limited backyard space | 4.7% |
| Lack of financing | 4.5% |
| Permit uncertainty | 3.2% |
| Resale value uncertainty | 2.2% |
**Key insight**: Cost dominates overwhelmingly. Nearly 60% say price is THE barrier.

#### 5. Concept Appeal Rankings (Q29) — BENCHMARK QUESTION
| Concept | Real % | Rank |
|---------|--------|------|
| None — not motivated | 24.0% | 1st |
| Wellness / Studio Space | 21.2% | 2nd |
| Backyard Home Office | 19.3% | 3rd |
| Guest Suite / STR Income | 13.2% | 4th |
| Simplicity | 11.5% | 5th |
| Adventure Lifestyle | 10.8% | 6th |
**Key insight**: 24% say NONE of the concepts motivate them. Wellness edges out Home Office. Adventure is last among motivated respondents.

#### 6. Top Value Driver (Q31)
| Driver | Real % |
|--------|--------|
| Build quality and details | 46.3% |
| Smart Technology | 15.7% |
| Installation speed | 14.7% |
| Other | 9.5% |
| Permit-light positioning | 8.0% |
| Showroom | 5.8% |

#### 7. Van Konan Price Optimization (Q34)
| Metric | Value |
|--------|-------|
| VW Optimal price | $6,666 |
| Max Revenue price | $15,000 |
| Estimated price | $23,000 |
| Max Revenue | $3.6M (at $15K, 240 buyers = 24%) |
| At $23K | $2.5M (110 buyers = 11%) |
**Key insight**: Optimal pricing is dramatically below current $23K. Revenue maximizes at $15K.

#### 8. Demographics
- HOA: 21.3% Yes, 75% No, 3.7% Unsure
- Outdoor recreation: 30.8% Never, 29.2% A few times/year, 40% monthly+
- Club membership: 81.7% No organized club

#### 9. Barrier Severity Details (Q9 matrix, mean scores)
| Barrier | 4+5 "Would reduce" % |
|---------|----------------------|
| Cost ($23K) | 65.7% |
| Lack of financing | 44.4% |
| Build quality/durability | 45.7% |
| Resale value uncertainty | 38.1% |
| Permit uncertainty | 32.8% |
| Limited space/access | 25.5% |
| HOA restrictions | 36.0% |

---

## What Our Pipeline Must Match

### Survey Questions — Alignment Status

| Real Q# | Our Q# | Question | Status |
|---------|--------|----------|--------|
| Q2 | Q0a | Prior consideration | ✅ Match |
| Q3 | Q0b | General interest (Likert) | ✅ Match |
| Q6 | Q1 | Purchase interest at $23K | ✅ Match |
| Q7 | Q2 | Purchase likelihood 24mo | ✅ Match |
| Q8 | Q3 | Primary use case | ✅ Match (same 8 options) |
| Q9 | Q5_* | Barrier severity matrix | ✅ Match (same 7 barriers) |
| Q11 | Q6 | Greatest single barrier | ✅ Match |
| Q14-Q28 | Q9-Q13 | 5 concept tests | ✅ Match (same 5 concepts) |
| Q29 | Q14 | Most motivating concept | ✅ Match |
| Q30 | Q15-Q17 | Value driver ratings | ⚠️ Partial (we have 3 of 5) |
| Q31 | Q18 | Top value driver | ✅ Match |
| Q32 | Q19 | Club partnership impact | ✅ Match |
| Q33 | Q20 | Outreach channels | ⚠️ Partial (we have 6 of 11) |
| Q34 | — | Van Konan pricing | ❌ Missing |
| Q35 | Q24 | HOA status | ✅ Match |
| Q36 | Q25 | Outdoor activity frequency | ✅ Match |
| Q37 | Q26 | Club membership | ✅ Match |

**Overall: ~85% question coverage.** Missing VanKonan pricing (complex, low priority) and 2 value drivers.

### Persona Filtering — Needed Changes
Real survey screened: **US homeowners, 18+, 4 regions × 2 genders**
- NorthEast: 9% F, 9% M
- MidWest: 11% F, 10% M
- South: 19% F, 18% M
- West: 12% F, 12% M

**Our Stage 2 should**:
- Constrain ALL personas to homeowners (currently has condos/townhomes)
- Add regional distribution matching these quotas
- South is overrepresented (37% of sample) — reflects US population distribution

---

## Recommended 5 Benchmark Questions

Per organizer guidance: "Focus on a few key questions rather than trying to match the entire report."

### Primary Benchmarks (must match closely)
1. **Q6/Q1: Purchase interest at $23K** — Tests if synthetic respondents capture real price resistance. Real data shows strong left-skew (mean 2.34).
2. **Q8/Q3: Primary use case distribution** — Tests if LLMs can correctly rank storage > office > wellness. Classic LLM bias test (training data over-indexes home office).
3. **Q11/Q6: Greatest single barrier** — Tests if synthetic respondents surface cost dominance (59.7%). Clear, testable, single-answer.

### Secondary Benchmarks (nice to match)
4. **Q29/Q14: Most motivating concept** — Tests concept ranking. Key test: does synthetic data also show 24% "none" rejection?
5. **Q9/Q5: Barrier severity matrix** — Tests relative barrier ranking across 7 dimensions. Rich data for inter-model reliability.

---

## Implementation Phases

### Phase 1: Persona Alignment (Stage 2 changes)
- [ ] Filter to homeowners only (no condos/apartments)
- [ ] Add regional quotas: NE 18%, MW 21%, South 37%, West 24%
- [ ] Ensure 50/50 gender split
- [ ] Add outdoor recreation frequency diversity (30% never, 30% rarely, 40% active)

### Phase 2: Survey Question Alignment (Stage 3 changes)
- [ ] Add 2 missing value drivers (Smart Technology, Showroom)
- [ ] Add more outreach channel options to match real survey
- [ ] Consider adding Van Konan pricing question (stretch goal)
- [ ] Verify Likert scale labels match exactly (1-5 wording)

### Phase 3: STAMP Metrics (Stage 5 changes)
- [ ] Implement Krippendorff's alpha for inter-LLM reliability
- [ ] Add disagreement analysis: where do models diverge and why?
- [ ] Structured codebook prompts for each survey question (boundary cases, exclusion criteria — like Dr. Lin's concession example)

### Phase 4: Benchmark Comparison (New Stage 6 or Stage 5 enhancement)
- [ ] Create benchmark data file with real aytm results
- [ ] Side-by-side distribution comparison for 5 benchmark questions
- [ ] Delta metrics: absolute difference in distribution percentages
- [ ] Statistical comparison (chi-squared / KS test on distributions)
- [ ] Visual overlay: real vs synthetic bar charts

### Phase 5: Presentation Polish
- [ ] "STAMP-aligned" framing in UI
- [ ] Inter-LLM reliability badge/score on dashboard
- [ ] Benchmark comparison dashboard page
- [ ] Key insight callouts: where synthetic matches reality, where it diverges, and WHY

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLMs over-index "home office" as primary use | Fails benchmark Q8 (real: storage is #1) | Structured codebook prompt with all 8 options weighted equally; no priming |
| LLMs under-estimate price resistance | Fails benchmark Q6 (real: 37.8% "not interested") | Persona prompts must emphasize $23K is real money; include income constraints |
| LLMs produce too-uniform distributions | Fails Krippendorff's alpha | Use heterogeneous models at temperature > 0; diverse persona backgrounds |
| 24% "none" rejection on concepts is hard to replicate | Fails benchmark Q29 | Include explicit "none" option; don't bias toward positivity in prompts |
| Van Konan pricing too complex to simulate | Missing pricing optimization | Deprioritize — focus on the 5 benchmark questions instead |

---

## STAMP Methodology Reference (from Dr. Lin's presentation)

### Key Principles
1. **Prompts = measurement instruments** — Treat them like codebooks, not casual instructions
2. **Dual LLMs must be heterogeneous** — Different model families (GPT/Claude/Gemini) ✅ We do this
3. **Inter-LLM reliability** — Krippendorff's alpha ≥ 0.68 threshold
4. **Disagreement = diagnostic signal** — Reveals construct ambiguity and hidden assumptions
5. **Layered structured prompts** — Definition + boundary cases + exclusion criteria
6. **Medical second opinion metaphor** — Two experts disagree → investigate assumptions → smaller model adjudicates
7. **Context engineering** — Compress to relevant context for long inputs

### What STAMP Showed
- Definition-only prompts: poor reliability (below 0.68 alpha)
- STAMP structured prompts: all pass 0.68, F1 > 0.8
- MTMM (multi-trait multi-method) convergent/discriminant validity confirmed
- Cheaper models reach similar performance once assumptions are aligned
- Only GPT + Claude + Gemini frontier families perform well; Grok and open-source models underperform

---

## File Locations
- Benchmark PDF: `.tmp/images/1774504004807-5cji.pdf` (60 pages, full aytm report)
- Survey instrument (DOCX): `.tmp/images/1774504005193-aj5a.docx` (question text + quotas)
- This plan: `HACKATHON-PLAN.md`
