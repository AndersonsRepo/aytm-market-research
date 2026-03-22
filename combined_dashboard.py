"""Combined Qual + Quant Streamlit dashboard for Neo Smart Living market research.

Merges interview (qualitative) and survey (quantitative) data into a unified
7-tab view with cross-phase validation, 3-model reliability, and bias detection.

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
    key_metric_cis,
    model_distribution_tests,
    LIKERT_KEYS, BARRIER_KEYS, CONCEPT_APPEAL, DEMOGRAPHIC_KEYS,
)
from validation import (
    run_full_validation,
    compute_respondent_scores,
)
from client_discovery import DISCOVERY_QUESTIONS, QUESTION_LABELS as DISCOVERY_LABELS

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
DISCOVERY_PATH = DATA_DIR / "client_discovery.json"

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
    discovery = json.loads(DISCOVERY_PATH.read_text()) if DISCOVERY_PATH.exists() else None

    # Coerce quant numeric columns
    if quant is not None:
        from analytics import ALL_NUMERIC
        for col in ALL_NUMERIC:
            if col in quant.columns:
                quant[col] = pd.to_numeric(quant[col], errors="coerce")

    qual = analysis if analysis is not None else transcripts
    return quant, qual, themes, discovery


# =============================================================================
# Tab 0: Client Discovery (Stage 1)
# =============================================================================
def tab_client_discovery(discovery):
    st.header("Stage 1: Client Discovery Interview")
    st.markdown("*Structured interview with Neo Smart Living's founding team to extract business context*")

    if discovery is None:
        st.warning("No client discovery data found. Run `python generate_test_discovery.py` first.")
        return

    # Overview metrics
    c1, c2, c3 = st.columns(3)
    c1.metric("Models Used", len(discovery.get("models_used", [])))
    c2.metric("Questions Asked", len(discovery.get("sections", {})))
    c3.metric("Generated", discovery.get("generated", "")[:10])

    st.markdown("---")

    # Summary cards
    summary = discovery.get("summary", {})
    if summary:
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Product")
            st.info(summary.get("product", ""))
            st.subheader("Target Market")
            st.info(summary.get("target_market", ""))
        with col2:
            st.subheader("Key Use Cases")
            for uc in summary.get("key_use_cases", []):
                st.markdown(f"- {uc}")
            st.subheader("Research Priorities")
            for i, p in enumerate(summary.get("research_priorities", []), 1):
                st.markdown(f"**{i}.** {p}")

        st.subheader("Top Barriers Identified")
        barriers = summary.get("top_barriers", [])
        if barriers:
            cols = st.columns(len(barriers))
            for col, barrier in zip(cols, barriers):
                col.warning(barrier)

    st.markdown("---")

    # Full interview responses with cross-model comparison
    st.subheader("Interview Responses by Model")
    sections = discovery.get("sections", {})
    models_used = discovery.get("models_used", [])

    view_mode = st.radio("View mode", ["Side-by-side", "Question-by-question"], horizontal=True)

    if view_mode == "Side-by-side" and len(models_used) >= 2:
        for key, section in sections.items():
            with st.expander(f"{section['label']}", expanded=False):
                st.markdown(f"**Q:** *{section['question']}*")
                cols = st.columns(len(models_used))
                for col, model in zip(cols, models_used):
                    with col:
                        st.markdown(f"**{model}**")
                        st.markdown(section["responses"].get(model, "*No response*"))
    else:
        selected_q = st.selectbox(
            "Select question",
            list(sections.keys()),
            format_func=lambda k: sections[k]["label"],
        )
        section = sections[selected_q]
        st.markdown(f"**Q:** *{section['question']}*")
        for model in models_used:
            st.markdown(f"---\n**{model}:**")
            st.markdown(section["responses"].get(model, "*No response*"))

    # Cross-model agreement analysis
    st.markdown("---")
    st.subheader("Cross-Model Agreement")
    st.markdown(
        "All three models consistently identify the same core themes: "
        "**home office as the largest use case**, **HOA as the primary barrier**, "
        "and **one-day installation as the key differentiator**. "
        "This convergence across independent LLM responses strengthens confidence "
        "in the business context used throughout the pipeline."
    )

    # Pipeline flow indicator
    st.markdown("---")
    st.markdown("##### Pipeline Flow")
    st.markdown(
        "**Stage 1: Client Discovery** → Stage 2: Consumer Interviews → "
        "Stage 3: Survey Design → Stage 4: Survey Responses → "
        "Stage 5: Analysis Dashboard → Stage 6: Validation"
    )
    st.caption("This discovery brief informs persona design, interview questions, and survey instrument construction.")


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
        interview_mode = "Multi-Turn" if "interview_mode" in qual.columns and (qual["interview_mode"] == "multi_turn").any() else "Single-Turn"
        c4.metric("Interview Mode", interview_mode)

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

    # Follow-up depth analysis (multi-turn)
    has_followups = any(f"{q}_followup_question" in qual.columns for q in QUESTION_KEYS)
    if has_followups:
        st.subheader("Multi-Turn Interview Depth")
        st.info("Interviews used adaptive follow-up probing: after each core question, the interviewer generated a contextual follow-up based on the response.")
        col1, col2 = st.columns(2)
        with col1:
            if "interview_mode" in qual.columns:
                mt_count = (qual["interview_mode"] == "multi_turn").sum()
                st.metric("Multi-Turn Interviews", mt_count)
            if "num_turns" in qual.columns:
                st.metric("Avg Turns/Interview", f"{qual['num_turns'].mean():.0f}")
        with col2:
            if "sentiment_combined" in qual.columns and "sentiment_overall" in qual.columns:
                core_mean = qual["sentiment_overall"].mean()
                combined_mean = qual["sentiment_combined"].mean()
                delta = combined_mean - core_mean
                st.metric("Combined Sentiment (core + follow-up)", f"{combined_mean:.3f}",
                         delta=f"{delta:+.3f} vs core only")

        # Sentiment comparison: core vs follow-up per question
        if any(f"sentiment_{q}_followup" in qual.columns for q in QUESTION_KEYS):
            st.subheader("Core vs Follow-Up Sentiment")
            comp_data = []
            for q in QUESTION_KEYS:
                core_col = f"sentiment_{q}"
                fu_col = f"sentiment_{q}_followup"
                if core_col in qual.columns and fu_col in qual.columns:
                    comp_data.append({
                        "Question": QUESTION_LABELS[q],
                        "Core Response": qual[core_col].mean(),
                        "Follow-Up Response": qual[fu_col].mean(),
                    })
            if comp_data:
                comp_df = pd.DataFrame(comp_data).set_index("Question")
                fig, ax = plt.subplots(figsize=(10, 5))
                comp_df.plot(kind="barh", ax=ax, color=["steelblue", "coral"])
                ax.set_xlabel("Mean VADER Sentiment")
                ax.axvline(x=0, color="gray", linestyle="--", alpha=0.5)
                ax.legend(loc="lower right")
                plt.tight_layout()
                st.pyplot(fig)
                plt.close()
                st.caption("Follow-up responses often reveal stronger sentiment as respondents elaborate on initial reactions.")

    # Transcript browser
    st.subheader("Transcript Browser")
    selected_persona = st.selectbox("Select persona", qual["persona_id"].unique())
    row = qual[qual["persona_id"] == selected_persona].iloc[0]
    interview_mode = row.get("interview_mode", "single_turn")
    mode_label = "Multi-Turn" if interview_mode == "multi_turn" else "Single-Turn"
    st.markdown(f"**{row['persona_name']}** | Model: {row['model']} | {row.get('age', '')} | {row.get('income', '')} | {mode_label}")
    for q in QUESTION_KEYS:
        if q in row and pd.notna(row[q]):
            st.markdown(f"**{q} ({QUESTION_LABELS[q]}):** {row[q]}")
            # Show follow-up exchange if available
            fu_q = f"{q}_followup_question"
            fu_r = f"{q}_followup_response"
            if fu_q in row and pd.notna(row.get(fu_q)) and str(row[fu_q]).strip():
                st.markdown(f"> *Interviewer follow-up:* {row[fu_q]}")
                if fu_r in row and pd.notna(row.get(fu_r)):
                    st.markdown(f"> **Response:** {row[fu_r]}")


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
# Tab 7: Data Quality & Bias Detection
# =============================================================================
def tab_data_quality(quant):
    st.header("Data Quality & Bias Detection")
    st.markdown("*Automated checks for LLM response biases and data quality issues*")

    if quant is None:
        st.warning("No survey data found.")
        return

    report = run_full_validation(quant)
    summary = report["summary"]

    # Grade banner
    grade_colors = {"A": "green", "B": "blue", "C": "orange", "D": "red"}
    grade = summary["grade"]
    st.markdown(f"### Overall Grade: **{grade}** — {summary['issues_found']} issues / {summary['total_checks']} checks")
    st.info(summary["recommendation"])

    st.markdown("---")

    # ── Quality Checks ──
    st.subheader("1. Response Quality Checks")
    col1, col2, col3, col4 = st.columns(4)

    attn = report["quality_checks"]["attention_check"]
    if isinstance(attn, dict) and "pass_rate" in attn:
        col1.metric("Attention Check (Q30)", f"{attn['pass_rate']*100:.0f}%",
                    delta="Pass" if attn["pass_rate"] == 1.0 else "Issues")

    sl = report["quality_checks"]["straightlining"]
    if isinstance(sl, dict) and "flagged_rate" in sl:
        col2.metric("Straightlining", f"{sl['flagged_count']} flagged",
                    delta=f"{sl['flagged_rate']*100:.0f}% rate")

    rv = report["quality_checks"]["range_violations"]
    if isinstance(rv, dict):
        col3.metric("Range Violations", rv["total_violations"])

    dc = report["quality_checks"]["demographic_consistency"]
    if isinstance(dc, dict) and "mismatches" in dc:
        col4.metric("Demo Mismatches", dc["mismatches"])

    # ── Bias Detection ──
    st.subheader("2. LLM Bias Detection")

    # Central tendency
    ct = report["bias_detection"]["central_tendency"]
    if isinstance(ct, dict) and "status" not in ct:
        st.markdown("**Central Tendency Bias** — Do models cluster responses at the midpoint (3)?")
        ct_data = []
        for model, result in ct.items():
            ct_data.append({
                "Model": model,
                "Midpoint Rate": f"{result['midpoint_rate']*100:.1f}%",
                "Mean Item SD": f"{result['mean_item_sd']:.2f}",
                "Flagged": "Yes" if result.get("flagged") or result.get("low_variance_flag") else "No",
            })
        st.dataframe(pd.DataFrame(ct_data), use_container_width=True, hide_index=True)

    # Acquiescence
    aq = report["bias_detection"]["acquiescence"]
    if isinstance(aq, dict) and "status" not in aq:
        st.markdown("**Acquiescence Bias** — Do models skew positive (always agree)?")
        aq_data = []
        for model, result in aq.items():
            aq_data.append({
                "Model": model,
                "Grand Mean": f"{result['grand_mean']:.2f}",
                "High Items": result["high_item_count"],
                "Flagged": "Yes" if result.get("flagged") else "No",
            })
        st.dataframe(pd.DataFrame(aq_data), use_container_width=True, hide_index=True)

    # Extreme response
    er = report["bias_detection"]["extreme_response"]
    if isinstance(er, dict) and "status" not in er:
        st.markdown("**Extreme Response Bias** — Do models overuse 1s and 5s?")
        er_data = []
        for model, result in er.items():
            er_data.append({
                "Model": model,
                "Extreme Rate": f"{result['extreme_rate']*100:.1f}%",
                "Flagged": "Yes" if result.get("flagged") else "No",
            })
        st.dataframe(pd.DataFrame(er_data), use_container_width=True, hide_index=True)

    # Response distribution comparison (visual)
    st.subheader("3. Response Distribution Comparison")
    models = sorted(quant["model"].unique())
    compare_vars = ["Q1", "Q2", "Q7", "Q15", "Q16", "Q17"]
    compare_labels = ["Purchase Int.", "Purchase Lik.", "Permit-Light",
                     "V: Permit", "V: Speed", "V: Quality"]
    available = [(v, l) for v, l in zip(compare_vars, compare_labels) if v in quant.columns]

    if available and len(models) >= 2:
        n_vars = len(available)
        fig, axes = plt.subplots(2, (n_vars + 1) // 2, figsize=(14, 8))
        axes = axes.flatten()
        for i, (var, label) in enumerate(available):
            ax = axes[i]
            for model in models:
                vals = quant.loc[quant["model"] == model, var].dropna()
                counts = vals.value_counts().reindex([1, 2, 3, 4, 5], fill_value=0)
                pcts = counts / counts.sum() * 100
                ax.plot([1, 2, 3, 4, 5], pcts.values, "o-", label=model, markersize=4)
            ax.set_title(label, fontsize=10)
            ax.set_xlabel("Rating")
            ax.set_ylabel("%" if i % ((n_vars + 1) // 2) == 0 else "")
            ax.set_xticks([1, 2, 3, 4, 5])
            ax.set_ylim(0, None)
        # Hide extra axes
        for j in range(len(available), len(axes)):
            axes[j].set_visible(False)
        axes[0].legend(fontsize=7)
        plt.suptitle("Response Value Distribution by Model", fontsize=12)
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

    # KS tests
    st.subheader("4. Kolmogorov-Smirnov Distribution Tests")
    st.markdown("*KS tests whether response distributions have the same shape across models "
               "(stricter than comparing means alone).*")
    ks_df = model_distribution_tests(quant)
    if not ks_df.empty:
        sig_only = st.checkbox("Show only significant KS results", value=False, key="ks_sig")
        display_df = ks_df[ks_df["Significant (p<.05)"]] if sig_only else ks_df
        st.dataframe(display_df, use_container_width=True, hide_index=True)
        n_sig = ks_df["Significant (p<.05)"].sum()
        n_total = len(ks_df)
        if n_sig == 0:
            st.success(f"No significant distribution differences across {n_total} KS tests. Distributions are consistent.")
        elif n_sig / n_total < 0.2:
            st.success(f"Only {n_sig}/{n_total} tests significant. Most distributions are consistent across models.")
        else:
            st.warning(f"{n_sig}/{n_total} tests significant. Some distributions differ meaningfully between models.")

    # Confidence intervals
    st.subheader("5. Bootstrap Confidence Intervals (95%)")
    ci_df = key_metric_cis(quant, group_col="model")
    if not ci_df.empty:
        # Forest plot
        overall = ci_df[ci_df["Group"] == "Overall"].copy()
        if not overall.empty:
            fig, ax = plt.subplots(figsize=(10, max(3, len(overall) * 0.5)))
            y_pos = range(len(overall))
            ax.errorbar(
                overall["point_estimate"], y_pos,
                xerr=[overall["point_estimate"] - overall["ci_lower"],
                      overall["ci_upper"] - overall["point_estimate"]],
                fmt="o", color="steelblue", capsize=4, markersize=6
            )
            ax.set_yticks(list(y_pos))
            ax.set_yticklabels(overall["Label"].values)
            ax.set_xlabel("Mean Rating (1-5)")
            ax.axvline(x=3, color="gray", linestyle="--", alpha=0.5, label="Midpoint")
            ax.set_title("Overall Key Metrics with 95% Bootstrap CI")
            ax.legend()
            plt.tight_layout()
            st.pyplot(fig)
            plt.close()

        # By-model table
        st.markdown("**By Model:**")
        by_model = ci_df[ci_df["Group"] != "Overall"].copy()
        by_model["CI"] = by_model.apply(
            lambda r: f"{r['point_estimate']:.2f} [{r['ci_lower']:.2f}, {r['ci_upper']:.2f}]", axis=1
        )
        pivot = by_model.pivot_table(index="Label", columns="Group", values="CI", aggfunc="first")
        st.dataframe(pivot, use_container_width=True)

    # Per-respondent quality scores
    st.subheader("6. Per-Respondent Quality Scores")
    scores_df = compute_respondent_scores(quant)
    if not scores_df.empty:
        col1, col2, col3 = st.columns(3)
        col1.metric("Mean Score", f"{scores_df['quality_score'].mean():.0f}/100")
        col2.metric("Min Score", f"{scores_df['quality_score'].min()}/100")
        col3.metric("Scores < 60", f"{(scores_df['quality_score'] < 60).sum()}")

        # Histogram
        fig, ax = plt.subplots(figsize=(8, 3))
        ax.hist(scores_df["quality_score"], bins=range(0, 105, 5), color="steelblue", edgecolor="white")
        ax.axvline(x=60, color="red", linestyle="--", alpha=0.7, label="Threshold (60)")
        ax.set_xlabel("Quality Score")
        ax.set_ylabel("Count")
        ax.legend()
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

        # By model
        fig, ax = plt.subplots(figsize=(8, 3))
        scores_df.boxplot(column="quality_score", by="model", ax=ax, grid=False)
        ax.set_title("")
        plt.suptitle("")
        ax.set_ylabel("Quality Score")
        plt.tight_layout()
        st.pyplot(fig)
        plt.close()

        st.download_button("Download quality scores CSV",
                          scores_df.to_csv(index=False).encode("utf-8"),
                          "validation_scores.csv", "text/csv")


# =============================================================================
# Main App
# =============================================================================
st.title("Neo Smart Living — Simulated Market Research")
st.markdown(
    "*End-to-end pipeline: Client Discovery → Consumer Interviews → Survey Design → "
    "Survey Responses → Analysis → Validation*  \n"
    "*3-Model Triangulation: GPT-4.1-mini · Gemini 2.5 Flash · Claude Sonnet 4*"
)

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

quant, qual, themes, discovery = load_all_data()

# Sidebar — pipeline info
st.sidebar.markdown("### Pipeline Stages")
st.sidebar.markdown(
    "1. Client Discovery " + ("✅" if discovery else "⬜") + "\n"
    "2. Consumer Interviews " + ("✅" if qual is not None else "⬜") + "\n"
    "3. Survey Design ✅\n"
    "4. Survey Responses " + ("✅" if quant is not None else "⬜") + "\n"
    "5. Analysis Dashboard ✅\n"
    "6. Validation ✅"
)
st.sidebar.markdown(
    f"**Models:** GPT-4.1-mini, Gemini 2.5 Flash, Claude Sonnet 4"
)
st.sidebar.markdown("**Cost:** ~$0.10 full pipeline via OpenRouter")
st.sidebar.markdown(
    "**Traditional equivalent:** $6K–$48K"
)
st.sidebar.markdown("---")

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
tab0, tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    "1. Client Discovery",
    "Executive Summary",
    "2. Qualitative Insights",
    "3-4. Quantitative Results",
    "Cross-Phase Validation",
    "5. Model Reliability",
    "6. Data Quality & Bias",
    "Methodology & Confidence",
])

with tab0:
    tab_client_discovery(discovery)
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
    tab_data_quality(quant)
with tab7:
    tab_methodology(quant, qual)
