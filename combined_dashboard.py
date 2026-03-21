"""Combined Qual + Quant Streamlit dashboard for Neo Smart Living market research.

Merges interview (qualitative) and survey (quantitative) data into a unified
6-tab view with cross-phase validation and 3-model reliability analysis.

Run: streamlit run combined_dashboard.py
"""

import streamlit as st
import pandas as pd
import numpy as np
import json
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from itertools import combinations
from pathlib import Path

from analytics import (
    load_data as load_quant_data,
    model_comparison_likert,
    barrier_heatmap_data,
    segment_profiles,
    LIKERT_KEYS, BARRIER_KEYS, CONCEPT_APPEAL, DEMOGRAPHIC_KEYS,
)

st.set_page_config(
    page_title="Neo Smart Living — Combined Research Dashboard",
    layout="wide",
    page_icon=":house:",
)

DATA_DIR = Path(__file__).parent / "output"
QUANT_PATH = DATA_DIR / "synthetic_responses.csv"
TRANSCRIPT_PATH = DATA_DIR / "interview_transcripts.csv"
ANALYSIS_PATH = DATA_DIR / "interview_analysis.csv"
THEMES_PATH = DATA_DIR / "interview_themes.json"

QUESTION_LABELS = {
    "IQ1": "Backyard Relationship",
    "IQ2": "Unmet Home Needs",
    "IQ3": "Prior Consideration",
    "IQ4": "Lifestyle Fantasy",
    "IQ5": "Work-Life Boundaries",
    "IQ6": "Product Reaction",
    "IQ7": "Barriers & Drivers",
    "IQ8": "Social & Discovery",
}
QUESTION_KEYS = list(QUESTION_LABELS.keys())


def to_csv(df):
    return df.to_csv(index=False).encode("utf-8")


@st.cache_data
def load_all_data():
    """Load both qual and quant datasets."""
    quant = pd.read_csv(QUANT_PATH) if QUANT_PATH.exists() else None
    transcripts = pd.read_csv(TRANSCRIPT_PATH) if TRANSCRIPT_PATH.exists() else None
    analysis = pd.read_csv(ANALYSIS_PATH) if ANALYSIS_PATH.exists() else None
    themes = json.loads(THEMES_PATH.read_text()) if THEMES_PATH.exists() else None

    # Coerce quant numeric columns
    if quant is not None:
        from analytics import ALL_NUMERIC
        for col in ALL_NUMERIC:
            if col in quant.columns:
                quant[col] = pd.to_numeric(quant[col], errors="coerce")

    qual = analysis if analysis is not None else transcripts
    return quant, qual, themes


# =============================================================================
# Tab 1: Executive Summary
# =============================================================================
def tab_executive_summary(quant, qual, themes):
    st.header("Executive Summary")
    st.markdown("*Key findings across both qualitative interviews and quantitative survey*")

    # Top metrics
    c1, c2, c3, c4 = st.columns(4)
    if quant is not None:
        c1.metric("Survey Respondents", len(quant))
        c2.metric("Survey Models", quant["model"].nunique())
    if qual is not None:
        c3.metric("Interview Participants", len(qual))
        c4.metric("Interview Models", qual["model"].nunique())

    st.markdown("---")

    # Key Finding 1: Purchase Intent
    if quant is not None:
        st.subheader("1. Purchase Intent")
        col1, col2, col3 = st.columns(3)
        col1.metric("Overall Interest (Q1)", f"{quant['Q1'].mean():.2f}/5")
        col2.metric("Purchase Likelihood (Q2)", f"{quant['Q2'].mean():.2f}/5")
        col3.metric("Permit-Light Effect (Q7)", f"{quant['Q7'].mean():.2f}/5")

        st.markdown("**By Segment:**")
        seg_means = quant.groupby("segment_name")[["Q1", "Q2"]].mean().round(2)
        seg_means.columns = ["Purchase Interest", "Purchase Likelihood"]
        st.dataframe(seg_means, use_container_width=True)

    # Key Finding 2: Top Barriers
    if quant is not None:
        st.subheader("2. Top Barriers")
        barrier_means = {BARRIER_KEYS[k]: quant[k].mean() for k in BARRIER_KEYS if k in quant.columns}
        sorted_barriers = sorted(barrier_means.items(), key=lambda x: x[1], reverse=True)
        for i, (name, val) in enumerate(sorted_barriers[:3], 1):
            st.markdown(f"**{i}. {name}**: {val:.2f}/5")

    # Key Finding 3: Emotional Response (from qual)
    if qual is not None and "primary_emotion" in qual.columns:
        st.subheader("3. Emotional Response to Product")
        emotion_dist = qual["primary_emotion"].value_counts()
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**Dominant emotions:**")
            for emotion, count in emotion_dist.head(3).items():
                pct = count / len(qual) * 100
                st.markdown(f"- {emotion.title()}: {count} ({pct:.0f}%)")
        with col2:
            if "sentiment_overall" in qual.columns:
                avg_sent = qual["sentiment_overall"].mean()
                st.metric("Average Sentiment", f"{avg_sent:.3f}",
                         delta="Positive" if avg_sent > 0.05 else ("Negative" if avg_sent < -0.05 else "Neutral"))

    # Key Finding 4: Interview Themes
    if themes:
        llm_themes = themes.get("llm_themes", [])
        if llm_themes:
            st.subheader("4. Emergent Themes from Interviews")
            for theme in llm_themes[:3]:
                st.markdown(f"- **{theme['theme_name']}** (n={theme.get('frequency', '?')}): {theme.get('description', '')[:120]}...")

    # Key Finding 5: Model Agreement
    st.subheader("5. Multi-Model Reliability")
    model_names = set()
    if quant is not None:
        model_names.update(quant["model"].unique())
    if qual is not None:
        model_names.update(qual["model"].unique())
    st.markdown(f"**Models used:** {', '.join(sorted(model_names))}")
    if quant is not None and quant["model"].nunique() >= 3:
        mc = model_comparison_likert(quant)
        if isinstance(mc, dict):
            kw = mc["kruskal_wallis"]
            n_sig = kw["Significant (p<.05)"].sum()
            n_total = len(kw)
            st.markdown(f"- Kruskal-Wallis: **{n_sig}/{n_total}** variables show significant cross-model differences")
            st.markdown(f"- **{n_total - n_sig}/{n_total}** variables are consistent across all 3 models (robust findings)")


# =============================================================================
# Tab 2: Qualitative Insights
# =============================================================================
def tab_qualitative(qual, themes):
    st.header("Qualitative Insights (Depth Interviews)")

    if qual is None:
        st.warning("No interview data found. Run generate_test_interviews.py first.")
        return

    # Overview
    c1, c2, c3 = st.columns(3)
    c1.metric("Total Interviews", len(qual))
    c2.metric("Models Used", qual["model"].nunique())
    if "primary_emotion" in qual.columns:
        top_emotion = qual["primary_emotion"].value_counts().index[0]
        c3.metric("Dominant Emotion", top_emotion.title())

    # Sentiment heatmap
    if "sentiment_IQ1" in qual.columns:
        st.subheader("Sentiment Heatmap")
        sent_cols = [f"sentiment_{q}" for q in QUESTION_KEYS]
        heatmap_data = qual.set_index("persona_id")[sent_cols].copy()
        heatmap_data.columns = [QUESTION_LABELS[q] for q in QUESTION_KEYS]
        fig, ax = plt.subplots(figsize=(12, max(6, len(qual) * 0.25)))
        sns.heatmap(heatmap_data, annot=True, fmt=".2f", cmap="RdYlGn", center=0,
                    vmin=-1, vmax=1, ax=ax, linewidths=0.5)
        ax.set_ylabel("")
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

    # Emotion distribution
    if "primary_emotion" in qual.columns:
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Emotion Distribution")
            fig, ax = plt.subplots(figsize=(8, 4))
            qual["primary_emotion"].value_counts().plot.barh(ax=ax, color="teal")
            ax.set_xlabel("Count")
            plt.tight_layout()
            st.pyplot(fig)
            plt.close()

        with col2:
            st.subheader("Emotion by Model")
            if qual["model"].nunique() > 1:
                ct = pd.crosstab(qual["model"], qual["primary_emotion"])
                st.dataframe(ct, use_container_width=True)

    # Themes
    if themes:
        llm_themes = themes.get("llm_themes", [])
        if llm_themes:
            st.subheader(f"Emergent Themes ({len(llm_themes)})")
            for theme in llm_themes:
                with st.expander(f"{theme['theme_name']} (n={theme.get('frequency', '?')})"):
                    st.write(theme.get("description", ""))
                    for q in theme.get("supporting_quotes", []):
                        st.markdown(f"> *\"{q['quote']}\"* -- {q['respondent_id']}")

    # Transcript browser
    st.subheader("Transcript Browser")
    selected_persona = st.selectbox("Select persona", qual["persona_id"].unique())
    row = qual[qual["persona_id"] == selected_persona].iloc[0]
    st.markdown(f"**{row['persona_name']}** | Model: {row['model']} | {row.get('age', '')} | {row.get('income', '')}")
    for q in QUESTION_KEYS:
        if q in row and pd.notna(row[q]):
            st.markdown(f"**{q} ({QUESTION_LABELS[q]}):** {row[q]}")


# =============================================================================
# Tab 3: Quantitative Results
# =============================================================================
def tab_quantitative(quant):
    st.header("Quantitative Results (Survey Data)")

    if quant is None:
        st.warning("No survey data found. Run generate_test_data.py first.")
        return

    # Overview
    c1, c2, c3 = st.columns(3)
    c1.metric("Total Respondents", len(quant))
    c2.metric("Segments", quant["segment_name"].nunique())
    c3.metric("Models", quant["model"].nunique())

    # Purchase interest by segment
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Purchase Interest by Segment")
        fig, ax = plt.subplots(figsize=(8, 4))
        quant.boxplot(column="Q1", by="segment_name", ax=ax, grid=False)
        ax.set_title("")
        plt.suptitle("")
        ax.set_xlabel("Segment")
        ax.set_ylabel("Interest (1-5)")
        plt.xticks(rotation=30, ha="right")
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

    with col2:
        st.subheader("Purchase Likelihood by Segment")
        fig, ax = plt.subplots(figsize=(8, 4))
        quant.boxplot(column="Q2", by="segment_name", ax=ax, grid=False)
        ax.set_title("")
        plt.suptitle("")
        ax.set_xlabel("Segment")
        ax.set_ylabel("Likelihood (1-5)")
        plt.xticks(rotation=30, ha="right")
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

    # Barrier heatmap
    st.subheader("Barrier Severity by Segment")
    hm_data = barrier_heatmap_data(quant)
    fig, ax = plt.subplots(figsize=(10, 4))
    sns.heatmap(hm_data, annot=True, fmt=".2f", cmap="YlOrRd", ax=ax, vmin=1, vmax=5)
    ax.set_ylabel("")
    plt.tight_layout()
    st.pyplot(fig)
    plt.close()

    # Concept appeal
    st.subheader("Concept Appeal by Segment")
    appeal_cols = ["Q9a", "Q10a", "Q11a", "Q12a", "Q13a"]
    concept_names = ["Home Office", "Guest Suite/STR", "Wellness Studio", "Adventure", "Simplicity"]
    appeal_by_seg = quant.groupby("segment_name")[appeal_cols].mean()
    appeal_by_seg.columns = concept_names
    fig, ax = plt.subplots(figsize=(10, 5))
    appeal_by_seg.plot.bar(ax=ax)
    ax.set_ylabel("Mean Appeal (1-5)")
    ax.set_ylim(1, 5)
    ax.legend(title="Concept", bbox_to_anchor=(1.02, 1), loc="upper left")
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()
    st.pyplot(fig)
    plt.close()

    st.download_button("Download segment profiles", to_csv(segment_profiles(quant).reset_index()),
                       "segment_profiles.csv", "text/csv")


# =============================================================================
# Tab 4: Cross-Phase Validation
# =============================================================================
def tab_cross_validation(quant, qual, themes):
    st.header("Cross-Phase Validation")
    st.markdown("*Do qualitative interview themes align with quantitative survey results?*")

    if quant is None or qual is None:
        st.warning("Both qual and quant data are required for cross-phase validation.")
        return

    # Validation 1: Segment alignment
    if themes:
        seg_suggestions = themes.get("segment_suggestions", [])
        mapping = themes.get("existing_segment_mapping", {})
        if seg_suggestions and mapping:
            st.subheader("1. Segment Alignment")
            st.markdown("Interview-discovered segments mapped to pre-defined survey segments:")
            map_data = []
            for interview_seg, survey_seg in mapping.items():
                map_data.append({
                    "Interview Segment": interview_seg,
                    "Survey Segment": survey_seg,
                })
            st.dataframe(pd.DataFrame(map_data), use_container_width=True)

            matched = len(mapping)
            total_interview = len(seg_suggestions)
            st.markdown(f"**{matched}/{total_interview}** interview segments map to survey segments "
                       f"-- {'strong' if matched >= total_interview * 0.8 else 'moderate'} alignment")

    # Validation 2: Barrier consistency
    st.subheader("2. Barrier Consistency")
    st.markdown("**Quantitative barriers** (survey Q5 mean ratings):")
    barrier_means = {BARRIER_KEYS[k]: round(quant[k].mean(), 2) for k in BARRIER_KEYS if k in quant.columns}
    sorted_barriers = sorted(barrier_means.items(), key=lambda x: x[1], reverse=True)
    for name, val in sorted_barriers[:3]:
        st.markdown(f"- {name}: **{val}/5**")

    if themes:
        st.markdown("**Qualitative barriers** (from interview themes):")
        seg_suggestions = themes.get("segment_suggestions", [])
        barriers_mentioned = set()
        for seg in seg_suggestions:
            barrier = seg.get("primary_barrier", "")
            if barrier:
                barriers_mentioned.add(barrier)
        for b in barriers_mentioned:
            st.markdown(f"- {b}")

    # Validation 3: Use case alignment
    st.subheader("3. Use Case Alignment")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**Survey: Primary Use (Q3)**")
        q3_counts = quant["Q3"].value_counts().head(5)
        fig, ax = plt.subplots(figsize=(6, 4))
        q3_counts.plot.barh(ax=ax, color="steelblue")
        ax.set_xlabel("Count")
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

    with col2:
        st.markdown("**Interviews: Lifestyle Fantasy (IQ4) themes**")
        if themes:
            for theme in themes.get("llm_themes", [])[:5]:
                st.markdown(f"- {theme['theme_name']} (n={theme.get('frequency', '?')})")

    # Validation 4: Sentiment vs Purchase Intent
    st.subheader("4. Sentiment-Intent Correlation Check")
    if "sentiment_IQ6" in qual.columns:
        avg_iq6_sentiment = qual["sentiment_IQ6"].mean()
        avg_q1 = quant["Q1"].mean()
        st.markdown(f"- **Interview IQ6 sentiment** (product reaction): {avg_iq6_sentiment:.3f} "
                   f"({'Positive' if avg_iq6_sentiment > 0.05 else 'Negative' if avg_iq6_sentiment < -0.05 else 'Neutral'})")
        st.markdown(f"- **Survey Q1** (purchase interest): {avg_q1:.2f}/5 "
                   f"({'Above midpoint' if avg_q1 > 3 else 'Below midpoint'})")
        aligned = (avg_iq6_sentiment > 0 and avg_q1 > 3) or (avg_iq6_sentiment < 0 and avg_q1 < 3)
        st.markdown(f"- Direction: **{'Aligned' if aligned else 'Misaligned'}** -- "
                   f"{'qualitative and quantitative findings point in the same direction' if aligned else 'signals diverge, investigate further'}")


# =============================================================================
# Tab 5: 3-Model Reliability
# =============================================================================
def tab_model_reliability(quant, qual):
    st.header("3-Model Reliability Analysis")
    st.markdown("*Which findings are robust across GPT-4.1-mini, Gemini 2.5 Flash, and Claude Sonnet 4?*")

    # --- Quantitative model comparison ---
    if quant is not None and quant["model"].nunique() >= 2:
        st.subheader("Survey: Model Comparison")
        models = sorted(quant["model"].unique())

        # Grouped bar chart
        compare_vars = ["Q1", "Q2", "Q7", "Q15", "Q16", "Q17", "Q19"]
        compare_labels = ["Purchase Int.", "Purchase Lik.", "Permit-Light",
                         "V: Permit", "V: Speed", "V: Quality", "Sponsorship"]
        means = quant.groupby("model")[compare_vars].mean()

        fig, ax = plt.subplots(figsize=(12, 5))
        x = np.arange(len(compare_vars))
        n_models = len(models)
        width = 0.8 / n_models
        for i, model in enumerate(models):
            vals = means.loc[model, compare_vars].values
            ax.bar(x + i * width - (n_models - 1) * width / 2, vals, width, label=model)
        ax.set_xticks(x)
        ax.set_xticklabels(compare_labels, rotation=30, ha="right")
        ax.set_ylabel("Mean Rating (1-5)")
        ax.set_ylim(1, 5)
        ax.legend()
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

        # Statistical tests
        mc_result = model_comparison_likert(quant)
        if isinstance(mc_result, dict):
            kw = mc_result["kruskal_wallis"]
            pw = mc_result["pairwise"]

            st.subheader("Kruskal-Wallis H Test (3-group omnibus)")
            st.dataframe(kw, use_container_width=True)
            st.caption("Epsilon-squared: < 0.01 negligible, 0.01-0.06 small, 0.06-0.14 medium, > 0.14 large.")

            n_sig = kw["Significant (p<.05)"].sum()
            n_total = len(kw)
            if n_sig == 0:
                st.success(f"All {n_total} variables show NO significant cross-model differences. Findings are highly robust.")
            elif n_sig <= n_total * 0.2:
                st.success(f"Only {n_sig}/{n_total} variables differ significantly. Most findings are robust.")
            else:
                st.warning(f"{n_sig}/{n_total} variables show significant cross-model differences. Interpret with caution.")

            st.subheader("Pairwise Mann-Whitney U Tests")
            # Filter to only significant results
            sig_only = st.checkbox("Show only significant results", value=False)
            if sig_only:
                pw_display = pw[pw["Significant (p<.05)"]]
            else:
                pw_display = pw
            st.dataframe(pw_display, use_container_width=True)

            st.download_button("Download pairwise comparison CSV", to_csv(pw), "pairwise_comparison.csv", "text/csv")
        else:
            st.dataframe(mc_result, use_container_width=True)

        # Radar chart per segment
        st.subheader("Segment Profiles by Model (Radar)")
        radar_vars = ["Q1", "Q2", "Q7", "Q15", "Q16", "Q17"]
        radar_labels = ["Purch. Int.", "Purch. Lik.", "Permit-Light", "V: Permit", "V: Speed", "V: Quality"]
        segments = sorted(quant["segment_name"].unique())

        fig, axes = plt.subplots(1, len(segments), figsize=(4 * len(segments), 4),
                                  subplot_kw=dict(projection="polar"))
        if len(segments) == 1:
            axes = [axes]

        angles = np.linspace(0, 2 * np.pi, len(radar_vars), endpoint=False).tolist()
        angles += angles[:1]

        for ax, seg in zip(axes, segments):
            ax.set_title(seg, size=9, pad=15)
            ax.set_ylim(1, 5)
            ax.set_yticks([1, 2, 3, 4, 5])
            ax.set_yticklabels(["1", "2", "3", "4", "5"], size=7)
            ax.set_xticks(angles[:-1])
            ax.set_xticklabels(radar_labels, size=6)
            for model in models:
                subset = quant[(quant["model"] == model) & (quant["segment_name"] == seg)]
                if subset.empty:
                    continue
                vals = subset[radar_vars].mean().tolist()
                vals += vals[:1]
                ax.plot(angles, vals, "o-", linewidth=1.5, label=model, markersize=3)
                ax.fill(angles, vals, alpha=0.1)
            ax.legend(loc="upper right", fontsize=6, bbox_to_anchor=(1.35, 1.1))
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

    # --- Qualitative model comparison ---
    if qual is not None and qual["model"].nunique() >= 2:
        st.subheader("Interview: Sentiment by Model")
        models = sorted(qual["model"].unique())

        if "sentiment_overall" in qual.columns:
            fig, ax = plt.subplots(figsize=(10, 4))
            qual.boxplot(column="sentiment_overall", by="model", ax=ax, grid=False)
            ax.set_title("")
            plt.suptitle("")
            ax.set_ylabel("Overall Sentiment")
            plt.tight_layout()
            st.pyplot(fig)
            plt.close()

            # Stats
            if len(models) >= 3:
                groups = [qual.loc[qual["model"] == m, "sentiment_overall"].dropna() for m in models]
                groups = [g for g in groups if len(g) > 0]
                if len(groups) >= 3:
                    h_stat, p_kw = stats.kruskal(*groups)
                    st.markdown(f"**Kruskal-Wallis H**: H={h_stat:.1f}, p={p_kw:.4f} "
                               f"{'(significant)' if p_kw < 0.05 else '(not significant)'}")

            for m1, m2 in combinations(models, 2):
                g1 = qual.loc[qual["model"] == m1, "sentiment_overall"].dropna()
                g2 = qual.loc[qual["model"] == m2, "sentiment_overall"].dropna()
                if len(g1) > 0 and len(g2) > 0:
                    stat, p = stats.mannwhitneyu(g1, g2, alternative="two-sided")
                    st.markdown(f"**Mann-Whitney U ({m1} vs {m2})**: U={stat:.1f}, p={p:.4f} "
                               f"{'(significant)' if p < 0.05 else '(not significant)'}")


# =============================================================================
# Tab 6: Methodology & Confidence
# =============================================================================
def tab_methodology(quant, qual):
    st.header("Methodology & Confidence")

    st.subheader("STAMP Framework Compliance")
    st.markdown("""
    The STAMP (Synthetic Testing for Attitudinal and Market Prediction) framework governs
    this pipeline's validity claims. Key safeguards:

    | STAMP Element | Implementation |
    |---|---|
    | **Multi-model triangulation** | 3 LLMs (GPT-4.1-mini, Gemini 2.5 Flash, Claude Sonnet 4) generate responses independently |
    | **Persona grounding** | 30 interview personas + 5 survey segments with realistic SoCal demographics |
    | **Statistical rigor** | Mann-Whitney U (pairwise), Kruskal-Wallis H (omnibus), effect sizes reported |
    | **Attention checks** | Q30 forced to 3 (moderately interested) to validate response quality |
    | **Demographic forcing** | Survey demographics locked to persona config, preventing LLM drift |
    | **Qual-Quant cross-validation** | Interview themes compared against survey segment patterns |
    """)

    st.subheader("Statistical Tests Used")
    st.markdown("""
    - **Mann-Whitney U**: Non-parametric test for pairwise model comparison (ordinal Likert data)
    - **Kruskal-Wallis H**: Non-parametric omnibus test for 3+ group comparison
    - **Rank-biserial r**: Effect size for Mann-Whitney U (|r| < 0.3 small, 0.3-0.5 medium, > 0.5 large)
    - **Epsilon-squared**: Effect size for Kruskal-Wallis (< 0.01 negligible, 0.01-0.06 small, 0.06-0.14 medium, > 0.14 large)
    - **Chi-square / Fisher exact**: Categorical variable independence (survey)
    - **VADER compound score**: Lexicon-based sentiment analysis (interviews)
    - **LDA coherence (c_v)**: Topic model quality metric (interviews)
    """)

    st.subheader("Data Summary")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**Quantitative (Survey)**")
        if quant is not None:
            st.markdown(f"- N = {len(quant)}")
            st.markdown(f"- Models: {', '.join(sorted(quant['model'].unique()))}")
            st.markdown(f"- Segments: {quant['segment_name'].nunique()}")
            st.markdown(f"- Respondents per segment per model: {len(quant) // (quant['model'].nunique() * quant['segment_name'].nunique())}")
            q30_pass = (quant["Q30"] == 3).sum()
            st.markdown(f"- Q30 attention check: {q30_pass}/{len(quant)} pass ({q30_pass/len(quant)*100:.0f}%)")
        else:
            st.warning("No survey data loaded.")

    with col2:
        st.markdown("**Qualitative (Interviews)**")
        if qual is not None:
            st.markdown(f"- N = {len(qual)}")
            st.markdown(f"- Models: {', '.join(sorted(qual['model'].unique()))}")
            st.markdown(f"- Unique personas: {qual['persona_id'].nunique()}")
            if "sentiment_label" in qual.columns:
                labels = qual["sentiment_label"].value_counts().to_dict()
                st.markdown(f"- Sentiment distribution: {labels}")
        else:
            st.warning("No interview data loaded.")

    st.subheader("Limitations")
    st.markdown("""
    1. **Synthetic, not real**: All responses are LLM-generated. They approximate but do not replace real consumer research.
    2. **Persona determinism**: Responses are shaped by persona descriptions, which may introduce systematic bias.
    3. **Model capabilities vary**: Each LLM interprets personas differently. Multi-model triangulation mitigates but does not eliminate this.
    4. **Sample size**: Survey N=90 (30 per model), Interviews N=30 (10 per model). Underpowered for detecting small effects.
    5. **Geographic scope**: All personas are Southern California homeowners. Findings may not generalize to other markets.
    6. **No real product interaction**: Respondents react to a text description, not a physical product or showroom visit.
    """)

    st.subheader("Confidence Assessment")
    if quant is not None and quant["model"].nunique() >= 3:
        mc = model_comparison_likert(quant)
        if isinstance(mc, dict):
            kw = mc["kruskal_wallis"]
            n_robust = (~kw["Significant (p<.05)"]).sum()
            n_total = len(kw)
            robustness = n_robust / n_total * 100
            if robustness >= 80:
                st.success(f"High confidence: {robustness:.0f}% of variables are consistent across all 3 models.")
            elif robustness >= 60:
                st.info(f"Moderate confidence: {robustness:.0f}% of variables are consistent across models.")
            else:
                st.warning(f"Low confidence: Only {robustness:.0f}% of variables are consistent across models.")
    else:
        st.info("3-model comparison requires data from all 3 LLMs.")


# =============================================================================
# Main App
# =============================================================================
st.title("Neo Smart Living -- Combined Research Dashboard")
st.markdown("*Qualitative + Quantitative Market Research with 3-Model Triangulation*")

# Check for data
missing = []
if not QUANT_PATH.exists():
    missing.append(f"Survey data: `{QUANT_PATH}`")
if not TRANSCRIPT_PATH.exists() and not ANALYSIS_PATH.exists():
    missing.append(f"Interview data: `{TRANSCRIPT_PATH}`")

if missing:
    st.error("Missing data files:\n" + "\n".join(f"- {m}" for m in missing))
    st.markdown("Run `python generate_test_data.py` and `python generate_test_interviews.py` to generate test data.")
    st.stop()

quant, qual, themes = load_all_data()

# Sidebar filters
st.sidebar.header("Filters")
if quant is not None:
    all_models = sorted(set(
        list(quant["model"].unique()) + (list(qual["model"].unique()) if qual is not None else [])
    ))
    selected_models = st.sidebar.multiselect("Model", all_models, default=all_models)
    quant = quant[quant["model"].isin(selected_models)]
    if qual is not None:
        qual = qual[qual["model"].isin(selected_models)]

    all_segments = sorted(quant["segment_name"].unique())
    selected_segments = st.sidebar.multiselect("Segment", all_segments, default=all_segments)
    quant = quant[quant["segment_name"].isin(selected_segments)]

    st.sidebar.metric("Survey Rows", len(quant))
    if qual is not None:
        st.sidebar.metric("Interview Rows", len(qual))

if quant is not None and quant.empty:
    st.warning("No data matches the current filters.")
    st.stop()

# Tabs
tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "Executive Summary",
    "Qualitative Insights",
    "Quantitative Results",
    "Cross-Phase Validation",
    "3-Model Reliability",
    "Methodology & Confidence",
])

with tab1:
    tab_executive_summary(quant, qual, themes)
with tab2:
    tab_qualitative(qual, themes)
with tab3:
    tab_quantitative(quant)
with tab4:
    tab_cross_validation(quant, qual, themes)
with tab5:
    tab_model_reliability(quant, qual)
with tab6:
    tab_methodology(quant, qual)
