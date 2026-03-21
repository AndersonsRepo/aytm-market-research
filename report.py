"""Static report generator for Neo Smart Living synthetic respondent analysis.

Run: python report.py
Outputs to: output/report/ (CSVs + PNGs)
"""

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from pathlib import Path

from analytics import (
    load_data, descriptive_likert, descriptive_categorical,
    model_comparison_likert, model_comparison_categorical,
    barrier_heatmap_data, segment_profiles,
    LIKERT_KEYS, BARRIER_KEYS, CONCEPT_APPEAL,
)

OUT = Path(__file__).parent / "output" / "report"
CHARTS = OUT / "charts"


def setup():
    OUT.mkdir(parents=True, exist_ok=True)
    CHARTS.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", font_scale=0.9)


def save_csvs(df):
    # Descriptive Likert: by model, segment, model×segment
    dl_model = descriptive_likert(df, "model")
    dl_seg = descriptive_likert(df, "segment_name")
    dl_both = descriptive_likert(df, ["model", "segment_name"])
    dl = pd.concat([
        dl_model.assign(Grouping="model"),
        dl_seg.assign(Grouping="segment"),
        dl_both.assign(Grouping="model×segment"),
    ], ignore_index=True)
    dl.to_csv(OUT / "descriptive_likert.csv", index=False)

    # Descriptive categorical
    dc = descriptive_categorical(df, "model")
    dc.to_csv(OUT / "descriptive_categorical.csv", index=False)

    # Model comparison
    mc = model_comparison_likert(df)
    mc.to_csv(OUT / "model_comparison.csv", index=False)

    # Segment profiles
    sp = segment_profiles(df)
    sp.to_csv(OUT / "segment_profiles.csv")

    return mc, sp


def chart_purchase_by_segment(df):
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    for ax, col, title in zip(axes, ["Q1", "Q2"],
                               ["Purchase Interest", "Purchase Likelihood"]):
        sns.boxplot(data=df, x="segment_name", y=col, hue="model", ax=ax)
        ax.set_title(title)
        ax.set_xlabel("")
        ax.set_ylabel("Rating (1-5)")
        ax.set_ylim(0.5, 5.5)
        plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    plt.tight_layout()
    fig.savefig(CHARTS / "purchase_interest_by_segment.png", dpi=150)
    plt.close()


def chart_barrier_heatmap(df):
    hm = barrier_heatmap_data(df)
    fig, ax = plt.subplots(figsize=(10, 4))
    sns.heatmap(hm, annot=True, fmt=".2f", cmap="YlOrRd", ax=ax, vmin=1, vmax=5)
    ax.set_ylabel("")
    ax.set_title("Barrier Severity by Segment (Mean)")
    plt.tight_layout()
    fig.savefig(CHARTS / "barrier_heatmap.png", dpi=150)
    plt.close()


def chart_concept_appeal(df):
    appeal_cols = ["Q9a", "Q10a", "Q11a", "Q12a", "Q13a"]
    concept_names = ["Home Office", "Guest Suite/STR", "Wellness Studio", "Adventure", "Simplicity"]
    by_seg = df.groupby("segment_name")[appeal_cols].mean()
    by_seg.columns = concept_names
    fig, ax = plt.subplots(figsize=(10, 5))
    by_seg.plot.bar(ax=ax)
    ax.set_ylabel("Mean Appeal (1-5)")
    ax.set_ylim(1, 5)
    ax.legend(title="Concept", bbox_to_anchor=(1.02, 1), loc="upper left")
    ax.set_title("Concept Appeal by Segment")
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()
    fig.savefig(CHARTS / "concept_appeal.png", dpi=150)
    plt.close()


def chart_model_comparison(df):
    models = df["model"].unique()
    compare_vars = ["Q1", "Q2", "Q7", "Q15", "Q16", "Q17", "Q19"]
    labels = ["Purch. Int.", "Purch. Lik.", "Permit-Light",
              "V: Permit", "V: Speed", "V: Quality", "Sponsorship"]
    means = df.groupby("model")[compare_vars].mean()
    fig, ax = plt.subplots(figsize=(10, 5))
    x = np.arange(len(compare_vars))
    width = 0.35
    for i, m in enumerate(models):
        ax.bar(x + i * width, means.loc[m].values, width, label=m)
    ax.set_xticks(x + width / 2)
    ax.set_xticklabels(labels, rotation=30, ha="right")
    ax.set_ylabel("Mean Rating (1-5)")
    ax.set_ylim(1, 5)
    ax.legend()
    ax.set_title("Model Comparison: Key Variables")
    plt.tight_layout()
    fig.savefig(CHARTS / "model_comparison_bars.png", dpi=150)
    plt.close()


def chart_radar_by_segment(df):
    models = df["model"].unique()
    radar_vars = ["Q1", "Q2", "Q7", "Q15", "Q16", "Q17"]
    radar_labels = ["Purch. Int.", "Purch. Lik.", "Permit-Light", "V: Permit", "V: Speed", "V: Quality"]
    segments = sorted(df["segment_name"].unique())
    n_seg = len(segments)

    fig, axes = plt.subplots(1, n_seg, figsize=(4 * n_seg, 4), subplot_kw=dict(projection="polar"))
    if n_seg == 1:
        axes = [axes]

    angles = np.linspace(0, 2 * np.pi, len(radar_vars), endpoint=False).tolist()
    angles += angles[:1]

    for ax, seg in zip(axes, segments):
        ax.set_title(seg, size=10, pad=15)
        ax.set_ylim(1, 5)
        ax.set_yticks([1, 2, 3, 4, 5])
        ax.set_yticklabels(["1", "2", "3", "4", "5"], size=7)
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(radar_labels, size=7)
        for model in models:
            subset = df[(df["model"] == model) & (df["segment_name"] == seg)]
            vals = subset[radar_vars].mean().tolist() + [subset[radar_vars[0]].mean()]
            ax.plot(angles, vals, "o-", linewidth=1.5, label=model, markersize=3)
            ax.fill(angles, vals, alpha=0.1)
        ax.legend(loc="upper right", fontsize=6, bbox_to_anchor=(1.35, 1.1))

    plt.tight_layout()
    fig.savefig(CHARTS / "radar_by_segment.png", dpi=150, bbox_inches="tight")
    plt.close()


def executive_summary(df, mc, sp):
    print("\n" + "=" * 70)
    print("  NEO SMART LIVING — SYNTHETIC RESPONDENT EXECUTIVE SUMMARY")
    print("=" * 70)
    print(f"\nN = {len(df)} respondents | Models: {', '.join(df['model'].unique())} | "
          f"Segments: {df['segment_name'].nunique()}")
    print(f"Q30 attention check pass rate: {(df['Q30'] == 3).mean():.0%}")

    print("\n--- Purchase Intent ---")
    q1m = df.groupby("segment_name")["Q1"].mean().sort_values(ascending=False)
    print(f"  Highest Q1 segment: {q1m.index[0]} (M={q1m.iloc[0]:.2f})")
    print(f"  Lowest  Q1 segment: {q1m.index[-1]} (M={q1m.iloc[-1]:.2f})")
    print(f"  Overall Q1 mean: {df['Q1'].mean():.2f}, Q2 mean: {df['Q2'].mean():.2f}")

    print("\n--- Top Barriers (overall mean) ---")
    for col, lbl in sorted(BARRIER_KEYS.items(), key=lambda x: df[x[0]].mean(), reverse=True)[:3]:
        print(f"  {lbl}: {df[col].mean():.2f}")

    print("\n--- Model Differences ---")
    sig = mc[mc["Significant (p<.05)"]]
    if sig.empty:
        print("  No significant differences at p<.05")
    else:
        for _, row in sig.iterrows():
            print(f"  {row['Label']}: U={row['U']}, p={row['p']}, r={row['Effect Size (r)']}")

    print("\n--- Top Concept Appeal ---")
    appeal_cols = ["Q9a", "Q10a", "Q11a", "Q12a", "Q13a"]
    concept_names = ["Home Office", "Guest Suite/STR", "Wellness Studio", "Adventure", "Simplicity"]
    means = df[appeal_cols].mean()
    top_idx = means.values.argmax()
    print(f"  Highest appeal: {concept_names[top_idx]} (M={means.iloc[top_idx]:.2f})")

    print(f"\nReport saved to: {OUT.resolve()}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    import pandas as pd  # noqa: needed at top but import here for clarity
    setup()
    df = load_data()
    print(f"Loaded {len(df)} rows from synthetic_responses.csv")

    print("Generating CSV tables...")
    mc, sp = save_csvs(df)

    print("Generating charts...")
    chart_purchase_by_segment(df)
    chart_barrier_heatmap(df)
    chart_concept_appeal(df)
    chart_model_comparison(df)
    chart_radar_by_segment(df)

    executive_summary(df, mc, sp)
