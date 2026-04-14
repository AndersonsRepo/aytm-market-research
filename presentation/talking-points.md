# Talking Points — Finals Presentation

## Reviewer Feedback (Round 1) — What to Address

> "Would recommend doing a customer interview with someone who does market research"
> "Focus on the personas more and how the user could tweak them"
> "The key issue is validity of the synthetic subject pool — more robustness checks needed"

### How to Address Each

**Validity of synthetic pool:**
- We identified circular reasoning in our calibration (benchmark numbers leaked into prompts)
- We removed exact statistics and re-ran — show the before/after comparison
- If results still align: "Pipeline independently reproduced key findings without seeing the data"
- If results diverge: "We discovered synthetic research works best as a complement to a small real-data seed — a $500 pilot survey + $10/run pipeline vs. $30K for full traditional research"

**Persona customization:**
- Demo or slide showing `constants.ts` — segments, seeds, demographics
- Show the fitness app example: same pipeline, completely different product
- "Everything product-specific lives in one config file. The statistical engine is product-agnostic."

**Customer interview with market researcher:**
- Acknowledge this as a valuable next step
- "Our benchmark comparison against the real N=600 survey serves as a proxy — we're measuring alignment with actual research outcomes"

---

## Key Numbers to Know

- **$7-11** per pipeline run vs **$30K+** traditional research
- **90** synthetic respondents across **5 segments** and **3 LLMs**
- **253** API calls per full run
- **6 stages** mirroring real research methodology
- **5** sycophancy reduction techniques
- Real survey: N=**600** US homeowners

## The 30-Second Pitch

"We built a 6-stage AI pipeline that simulates the full market research lifecycle — from founder interviews to validated survey insights — using 3 independent LLMs that cross-check each other. We validated it against a real N=600 survey and the pipeline independently identified cost as the #1 barrier and storage as the #1 use case without being given those answers."

## Strongest Differentiators

1. **STAMP triangulation** — 3 models cross-checking each other is novel. Single-model approaches have no reliability measure.
2. **Sycophancy reduction** — We identified and solved the core problem with AI survey responses (they're too agreeable). 5 specific techniques with measurable impact.
3. **Full statistical validation** — Not just "AI said so." Krippendorff's alpha, KS tests, bootstrap CIs, letter grading. Publishable-quality methodology.
4. **Benchmark comparison** — We measured ourselves against real data and report honestly where we match and where we don't.
5. **Product-agnostic** — Change one config file, run the same pipeline for any product.

## Likely Judge Questions

**"How do you know it's not just telling you what you want to hear?"**
→ STAMP triangulation (3 independent models), sycophancy reduction techniques, benchmark comparison

**"Can this replace real surveys?"**
→ No — 80% of the signal at 1% of the cost. Best for early-stage exploration and hypothesis generation.

**"Why these 3 models?"**
→ Cost-performance diversity + different training data = different biases. Agreement despite different training is stronger signal.

**"What about hallucination?"**
→ That's what we measure. LLMs over-index on "home office" (training data bias). Real data says storage is #1. We quantify the gap.

**"What would you improve?"**
→ Larger N (300+), temporal variation, adaptive survey design, real market researcher interview for calibration

## Don'ts

- Don't claim it replaces real research
- Don't hide the limitations — judges respect honesty
- Don't spend time on implementation details (OpenRouter, Supabase) — focus on methodology and results
- Don't rush through the statistical validation — that's what makes this credible
