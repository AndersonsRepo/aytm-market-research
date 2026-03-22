# Hackathon Demo Walkthrough

**Event:** CPP AI Hackathon 2026 — Aytm x Neo Smart Living Challenge
**Time:** ~8 minutes (aim for 6, leave 2 for questions)
**Setup:** Have `streamlit run combined_dashboard.py` running. Terminal with `python demo.py --quick` ready.

---

## Opening (30 seconds)

> "We built a complete simulated market research pipeline for Neo Smart Living's Tahoe Mini. Traditional market research costs $9K-$48K and takes weeks. Our pipeline delivers comparable insights for under $0.10 in about 5 minutes — using 3 independent LLMs for cross-validation."

**Show:** Terminal — run `python demo.py --quick` to flash the key findings.

---

## Tab 1: Client Discovery (60 seconds)

**Key point:** "Stage 1 simulates interviewing the Neo Smart Living founding team. We ran the same 10 questions through GPT-4.1-mini, Gemini, and Claude independently."

**Show:**
- Summary cards (product, target market, use cases)
- Switch to "Side-by-side" view — show how all 3 models converge on the same key insights
- Research priorities (this drives the rest of the pipeline)

**Transition:** "These research priorities directly inform what questions we ask consumers."

---

## Tab 2: Consumer Interviews (60 seconds)

**Key point:** "30 depth interviews with diverse SoCal homeowner personas. Each interview has 8 core questions plus 8 adaptive follow-up probes — 16 turns total."

**Show:**
- Sentiment heatmap (visual impact)
- Emotion distribution (excitement dominates at ~63%)
- Pick one persona in the transcript browser — show the follow-up exchange
- Mention the 5 emergent themes

**Transition:** "These themes directly generate the survey questions in Stage 3."

---

## Tab 3: Survey Design (60 seconds)

**Key point:** "This is where it gets interesting. Instead of a human researcher writing survey questions, we have 3 LLMs independently design the survey instrument based on the interview findings."

**Show:**
- Cross-model section coverage matrix — "All 3 models agree on 9 core sections. But Claude adds HOA Navigation and Price Sensitivity — sections a human might miss."
- Click into one model's instrument — show the question-to-theme traceability
- "Every question traces back to a specific interview theme. This is auditable AI."

**Transition:** "The survey design feeds into Stage 4 where we generate responses."

---

## Tab 4: Survey Results (45 seconds)

**Key point:** "90 synthetic respondents across 5 market segments and 3 LLMs."

**Show:**
- Purchase interest boxplot by segment
- Barrier heatmap — "Cost and HOA are the top barriers, confirming what we heard in interviews"
- Concept appeal chart — "Home Office and Simplicity lead"

**Transition:** "But how do we know these results are reliable?"

---

## Tab 5: Model Reliability (60 seconds)

**Key point:** "This is our STAMP compliance layer. We test whether findings are consistent across all 3 LLMs using rigorous statistical methods."

**Show:**
- Grouped bar chart — models produce very similar distributions
- Kruskal-Wallis H test table — "X out of 25 variables show NO significant differences. Findings are robust."
- Radar chart by segment — visual proof of convergence

**Say:** "If GPT, Gemini, and Claude all independently produce the same result, we can be much more confident than relying on a single model."

---

## Tab 6: Data Quality & Bias (60 seconds)

**Key point:** "LLMs have known biases — central tendency, acquiescence, extreme responding. We test for all of them."

**Show:**
- Grade banner — "Grade A, zero issues"
- Bias detection table — show central tendency and acquiescence checks per model
- Response distribution comparison (line charts) — "Distributions are healthy, not collapsed"
- Bootstrap confidence intervals (forest plot)

**Say:** "This is what separates a toy demo from a research tool. We're not just generating data — we're validating it."

---

## Tab 7: Methodology (30 seconds)

**Key point:** Quick hit on the cost comparison.

**Show:**
- Cost comparison table: "$0.10 vs $9K-$48K"
- Limitations section — "We're transparent about what this can and can't do"

---

## Closing (30 seconds)

> "Six pipeline stages, all AI-driven, all cross-validated with 3 independent LLMs. Total cost: ten cents. Total time: five minutes. Every finding traces from client discovery through interviews to survey design to validated results. The code is open-source and the pipeline is reproducible."

**If asked about real-world validation:**
> "This is a hypothesis generation tool, not a replacement for real research. The value is speed — you can test 10 positioning concepts in an hour before committing $30K to a real study."

---

## Q&A Prep

**"How do you ensure LLM responses aren't biased?"**
> Show Tab 6 bias detection. Mention 3 specific checks: central tendency, acquiescence, extreme response. Plus cross-model triangulation — if all 3 models show the same bias, it's a real signal, not a model artifact.

**"What's the STAMP framework?"**
> Show Methodology tab. STAMP = Synthetic Testing for Attitudinal and Market Prediction. Key principles: multi-model triangulation, persona grounding, statistical rigor, attention checks.

**"Could this work for a different product?"**
> Yes. Change the client discovery questions, update the product description in the survey, and re-run. The pipeline is product-agnostic. The statistical validation layer works regardless of product.

**"Why 3 models instead of 1?"**
> Same reason you'd survey 300 people instead of 1. Independent observations reduce noise. If GPT and Gemini and Claude all say "Home Office is the top use case," that's triangulation, not a single model's opinion.

**"What's the sample size limitation?"**
> N=90 for survey (30 per model), N=30 for interviews (10 per model). Underpowered for detecting small effects. In practice, you'd scale to 300+ per model for a real study.

---

## Quick Commands Reference

```bash
# Generate all test data + show findings (no API needed)
python demo.py

# Launch the interactive dashboard
python demo.py --dashboard
# OR
streamlit run combined_dashboard.py

# Show findings only (instant)
python demo.py --quick

# Run with real LLM APIs (~$0.10)
python demo.py --live

# Generate static report (CSVs + charts)
python demo.py --report

# Run validation checks
python validation.py
```
