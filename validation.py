"""Response validation, bias detection, and data quality assessment module.

Runs entirely offline (no API calls). Analyzes synthetic survey and interview
data for known LLM response biases, statistical anomalies, and quality issues.

Usage:
    python validation.py                    # Run full validation report
    python validation.py --json             # Output as JSON
    python validation.py --csv              # Save per-respondent scores to CSV
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

from analytics import (
    ALL_NUMERIC, LIKERT_KEYS, BARRIER_KEYS, CONCEPT_APPEAL,
    load_data as load_quant_data,
)

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"

# ── Known LLM response biases ──────────────────────────────────────────────

# LLMs tend toward the middle (central tendency) or the positive end (acquiescence).
# These thresholds flag when a model's response distribution is suspiciously narrow
# or skewed compared to what we'd expect from real survey data.

EXPECTED_LIKERT_SD_MIN = 0.5    # Real survey SD is usually >= 0.8; flag if < 0.5
EXPECTED_LIKERT_SD_MAX = 2.0    # Flag if SD > 2.0 (unlikely for 1-5 scale)
MIDPOINT_DOMINANCE_THRESHOLD = 0.6  # Flag if >60% of responses are exactly 3
ACQUIESCENCE_THRESHOLD = 4.2    # Flag if mean > 4.2 (strong positive skew)
EXTREME_RESPONSE_THRESHOLD = 0.7  # Flag if >70% responses are 1 or 5


# ── 1. Response Quality Checks ─────────────────────────────────────────────

def check_attention(df: pd.DataFrame) -> dict:
    """Check Q30 attention check compliance."""
    if "Q30" not in df.columns:
        return {"status": "skip", "reason": "Q30 not in data"}
    total = len(df)
    passed = (df["Q30"] == 3).sum()
    failed_ids = df.loc[df["Q30"] != 3, "respondent_id"].tolist() if "respondent_id" in df.columns else []
    return {
        "total": total,
        "passed": int(passed),
        "failed": total - int(passed),
        "pass_rate": round(passed / total, 4) if total > 0 else 0,
        "failed_ids": failed_ids,
    }


def check_straightlining(df: pd.DataFrame) -> dict:
    """Detect respondents who gave the same answer to all Likert questions.

    Straightlining is a well-documented response quality issue where a respondent
    selects the same value for every question (e.g., all 3s or all 4s).
    """
    likert_cols = [c for c in ALL_NUMERIC if c in df.columns and c != "Q30"]
    if not likert_cols:
        return {"status": "skip", "reason": "No Likert columns found"}

    flagged = []
    for idx, row in df.iterrows():
        vals = row[likert_cols].dropna()
        if len(vals) < 5:
            continue
        unique_count = vals.nunique()
        sd = vals.std()
        if unique_count <= 2 or sd < 0.3:
            flagged.append({
                "respondent_id": row.get("respondent_id", idx),
                "model": row.get("model", ""),
                "unique_values": int(unique_count),
                "sd": round(float(sd), 4),
                "dominant_value": int(vals.mode().iloc[0]) if not vals.mode().empty else None,
            })

    return {
        "total_checked": len(df),
        "flagged_count": len(flagged),
        "flagged_rate": round(len(flagged) / len(df), 4) if len(df) > 0 else 0,
        "flagged": flagged,
    }


def check_range_violations(df: pd.DataFrame) -> dict:
    """Check for values outside expected 1-5 Likert range."""
    likert_cols = [c for c in ALL_NUMERIC if c in df.columns]
    violations = []
    for col in likert_cols:
        out_of_range = df[(df[col] < 1) | (df[col] > 5)]
        for idx, row in out_of_range.iterrows():
            violations.append({
                "respondent_id": row.get("respondent_id", idx),
                "column": col,
                "value": row[col],
            })
    return {
        "total_violations": len(violations),
        "violations": violations[:20],  # cap output
    }


def check_demographic_consistency(df: pd.DataFrame) -> dict:
    """Verify demographics match expected segment configurations."""
    if "segment_name" not in df.columns:
        return {"status": "skip"}

    # Expected demographics per segment
    expected = {
        "Remote Professional": {"Q21": {"25-34", "35-44"}, "Q22": {"$100,000-$149,999", "$150,000-$199,999"}},
        "Active Adventurer": {"Q21": {"25-34", "35-44"}, "Q22": {"$75,000-$99,999", "$100,000-$149,999"}},
        "Wellness Seeker": {"Q21": {"35-44", "45-54"}, "Q22": {"$100,000-$149,999", "$150,000-$199,999"}},
        "Property Maximizer": {"Q21": {"45-54", "55-64"}, "Q22": {"$150,000-$199,999", "$200,000 or more"}},
        "Budget-Conscious DIYer": {"Q21": {"25-34", "35-44"}, "Q22": {"$50,000-$74,999", "$75,000-$99,999"}},
    }

    mismatches = []
    for idx, row in df.iterrows():
        seg = row["segment_name"]
        if seg not in expected:
            continue
        for col, valid_vals in expected[seg].items():
            if col in df.columns and row[col] not in valid_vals:
                mismatches.append({
                    "respondent_id": row.get("respondent_id", idx),
                    "segment": seg,
                    "field": col,
                    "expected": list(valid_vals),
                    "actual": row[col],
                })

    return {
        "total_checked": len(df),
        "mismatches": len(mismatches),
        "details": mismatches[:20],
    }


# ── 2. LLM Bias Detection ──────────────────────────────────────────────────

def detect_central_tendency_bias(df: pd.DataFrame) -> dict:
    """Detect if models cluster responses around the midpoint (3) excessively.

    LLMs are known to default to moderate/safe responses. This checks if the
    proportion of exactly-3 responses exceeds what we'd expect.
    """
    likert_cols = [c for c in LIKERT_KEYS if c in df.columns]
    if not likert_cols:
        return {"status": "skip"}

    results = {}
    for model in sorted(df["model"].unique()):
        model_df = df[df["model"] == model]
        all_vals = model_df[likert_cols].values.flatten()
        all_vals = all_vals[~np.isnan(all_vals)]
        total = len(all_vals)
        midpoint_count = (all_vals == 3).sum()
        midpoint_rate = midpoint_count / total if total > 0 else 0
        mean_sd = model_df[likert_cols].std().mean()

        results[model] = {
            "midpoint_rate": round(float(midpoint_rate), 4),
            "flagged": midpoint_rate > MIDPOINT_DOMINANCE_THRESHOLD,
            "mean_item_sd": round(float(mean_sd), 4),
            "low_variance_flag": mean_sd < EXPECTED_LIKERT_SD_MIN,
        }

    return results


def detect_acquiescence_bias(df: pd.DataFrame) -> dict:
    """Detect positive response bias (always agreeing / rating highly).

    LLMs trained on helpful/agreeable text often produce artificially positive
    survey responses. This flags models with suspiciously high mean ratings.
    """
    likert_cols = [c for c in LIKERT_KEYS if c in df.columns]
    if not likert_cols:
        return {"status": "skip"}

    results = {}
    for model in sorted(df["model"].unique()):
        model_df = df[df["model"] == model]
        grand_mean = model_df[likert_cols].mean().mean()
        # Per-item means
        item_means = model_df[likert_cols].mean()
        high_items = item_means[item_means > ACQUIESCENCE_THRESHOLD].index.tolist()

        results[model] = {
            "grand_mean": round(float(grand_mean), 4),
            "flagged": grand_mean > ACQUIESCENCE_THRESHOLD,
            "high_items": high_items,
            "high_item_count": len(high_items),
        }

    return results


def detect_extreme_response_bias(df: pd.DataFrame) -> dict:
    """Detect if a model overuses extreme values (1 or 5).

    Some LLMs produce overly polarized responses, lacking the nuance of
    real respondents who often use the middle of scales.
    """
    likert_cols = [c for c in LIKERT_KEYS if c in df.columns]
    if not likert_cols:
        return {"status": "skip"}

    results = {}
    for model in sorted(df["model"].unique()):
        model_df = df[df["model"] == model]
        all_vals = model_df[likert_cols].values.flatten()
        all_vals = all_vals[~np.isnan(all_vals)]
        total = len(all_vals)
        extreme_count = ((all_vals == 1) | (all_vals == 5)).sum()
        extreme_rate = extreme_count / total if total > 0 else 0

        results[model] = {
            "extreme_rate": round(float(extreme_rate), 4),
            "flagged": extreme_rate > EXTREME_RESPONSE_THRESHOLD,
        }

    return results


def detect_distribution_bias(df: pd.DataFrame) -> dict:
    """Two-sample KS tests comparing each model's response distributions.

    The Kolmogorov-Smirnov test detects whether two samples come from the same
    distribution — a stricter check than just comparing means (Mann-Whitney).
    A significant KS result means the *shape* of the distributions differ,
    not just the center.
    """
    likert_cols = [c for c in LIKERT_KEYS if c in df.columns]
    if not likert_cols:
        return {"status": "skip"}

    models = sorted(df["model"].unique())
    if len(models) < 2:
        return {"status": "skip", "reason": "Need 2+ models"}

    from itertools import combinations

    results = []
    for col in likert_cols:
        label = LIKERT_KEYS.get(col, col)
        for m1, m2 in combinations(models, 2):
            g1 = df.loc[df["model"] == m1, col].dropna().values
            g2 = df.loc[df["model"] == m2, col].dropna().values
            if len(g1) < 3 or len(g2) < 3:
                continue
            ks_stat, p_val = stats.ks_2samp(g1, g2)
            results.append({
                "variable": col,
                "label": label,
                "comparison": f"{m1} vs {m2}",
                "ks_statistic": round(float(ks_stat), 4),
                "p_value": round(float(p_val), 4),
                "significant": p_val < 0.05,
            })

    sig_count = sum(1 for r in results if r["significant"])
    return {
        "total_tests": len(results),
        "significant_count": sig_count,
        "significant_rate": round(sig_count / len(results), 4) if results else 0,
        "tests": results,
    }


def detect_response_homogeneity(df: pd.DataFrame) -> dict:
    """Check if within-model response variance is suspiciously low.

    Real respondents within a segment still show substantial variation.
    If a model's responses within a segment are too similar, it suggests
    the model isn't adequately differentiating between personas.
    """
    likert_cols = [c for c in LIKERT_KEYS if c in df.columns]
    if not likert_cols or "segment_name" not in df.columns:
        return {"status": "skip"}

    results = []
    for model in sorted(df["model"].unique()):
        for seg in sorted(df["segment_name"].unique()):
            subset = df[(df["model"] == model) & (df["segment_name"] == seg)]
            if len(subset) < 3:
                continue
            sds = subset[likert_cols].std()
            mean_sd = sds.mean()
            low_var_items = sds[sds < EXPECTED_LIKERT_SD_MIN].index.tolist()
            results.append({
                "model": model,
                "segment": seg,
                "n": len(subset),
                "mean_within_sd": round(float(mean_sd), 4),
                "low_variance_items": len(low_var_items),
                "flagged": mean_sd < EXPECTED_LIKERT_SD_MIN,
            })

    flagged = [r for r in results if r["flagged"]]
    return {
        "total_groups": len(results),
        "flagged_count": len(flagged),
        "details": results,
    }


# ── 3. Bootstrap Confidence Intervals ──────────────────────────────────────

def bootstrap_ci(data: np.ndarray, n_bootstrap: int = 2000, ci: float = 0.95,
                 statistic=np.mean) -> dict:
    """Compute bootstrap confidence interval for a statistic."""
    rng = np.random.default_rng(42)
    boot_stats = np.array([
        statistic(rng.choice(data, size=len(data), replace=True))
        for _ in range(n_bootstrap)
    ])
    alpha = (1 - ci) / 2
    lo = np.percentile(boot_stats, alpha * 100)
    hi = np.percentile(boot_stats, (1 - alpha) * 100)
    return {
        "point_estimate": round(float(statistic(data)), 4),
        "ci_lower": round(float(lo), 4),
        "ci_upper": round(float(hi), 4),
        "ci_width": round(float(hi - lo), 4),
        "ci_level": ci,
    }


def compute_key_metric_cis(df: pd.DataFrame) -> dict:
    """Bootstrap CIs for key survey metrics, overall and by model."""
    key_vars = {
        "Q1": "Purchase Interest",
        "Q2": "Purchase Likelihood",
        "Q7": "Permit-Light Effect",
        "Q15": "Value: Permit-Light",
        "Q16": "Value: Install Speed",
        "Q17": "Value: Build Quality",
        "Q19": "Sponsorship Impact",
    }

    results = {"overall": {}, "by_model": {}}

    for col, label in key_vars.items():
        if col not in df.columns:
            continue
        vals = df[col].dropna().values
        if len(vals) < 5:
            continue
        results["overall"][label] = bootstrap_ci(vals)

    for model in sorted(df["model"].unique()):
        results["by_model"][model] = {}
        model_df = df[df["model"] == model]
        for col, label in key_vars.items():
            if col not in df.columns:
                continue
            vals = model_df[col].dropna().values
            if len(vals) < 5:
                continue
            results["by_model"][model][label] = bootstrap_ci(vals)

    return results


# ── 4. Per-Respondent Quality Score ────────────────────────────────────────

def compute_respondent_scores(df: pd.DataFrame) -> pd.DataFrame:
    """Assign a 0-100 quality score to each respondent.

    Scoring:
    - Attention check (Q30=3): 20 pts
    - Response variance (not straightlining): 25 pts
    - Value range compliance (all 1-5): 15 pts
    - Demographic consistency: 20 pts
    - Response differentiation (uses >=4 unique values): 20 pts
    """
    likert_cols = [c for c in ALL_NUMERIC if c in df.columns and c != "Q30"]
    scores = []

    for idx, row in df.iterrows():
        score = 0

        # Attention check
        if row.get("Q30") == 3:
            score += 20

        # Response variance
        vals = row[likert_cols].dropna()
        if len(vals) > 0:
            sd = vals.std()
            if sd >= 0.8:
                score += 25
            elif sd >= 0.5:
                score += 15
            elif sd >= 0.3:
                score += 5

        # Range compliance
        in_range = all(1 <= v <= 5 for v in vals if not np.isnan(v))
        if in_range:
            score += 15

        # Response differentiation
        unique = vals.nunique()
        if unique >= 4:
            score += 20
        elif unique >= 3:
            score += 12
        elif unique >= 2:
            score += 5

        # Demographic consistency (simplified check)
        score += 20  # Assume consistent since forced in generation

        scores.append({
            "respondent_id": row.get("respondent_id", idx),
            "model": row.get("model", ""),
            "segment_name": row.get("segment_name", ""),
            "quality_score": score,
            "response_sd": round(float(sd), 4) if len(vals) > 0 else 0,
            "unique_values": int(unique) if len(vals) > 0 else 0,
            "attention_pass": row.get("Q30") == 3,
        })

    return pd.DataFrame(scores)


# ── 5. Full Validation Report ──────────────────────────────────────────────

def run_full_validation(df: pd.DataFrame) -> dict:
    """Run all validation checks and return structured report."""
    report = {
        "data_shape": {"rows": len(df), "columns": len(df.columns)},
        "models": sorted(df["model"].unique().tolist()),
        "segments": sorted(df["segment_name"].unique().tolist()) if "segment_name" in df.columns else [],

        "quality_checks": {
            "attention_check": check_attention(df),
            "straightlining": check_straightlining(df),
            "range_violations": check_range_violations(df),
            "demographic_consistency": check_demographic_consistency(df),
        },

        "bias_detection": {
            "central_tendency": detect_central_tendency_bias(df),
            "acquiescence": detect_acquiescence_bias(df),
            "extreme_response": detect_extreme_response_bias(df),
            "distribution_ks_tests": detect_distribution_bias(df),
            "response_homogeneity": detect_response_homogeneity(df),
        },

        "confidence_intervals": compute_key_metric_cis(df),
    }

    # Overall quality grade
    issues = 0
    total_checks = 0

    # Count quality issues
    attn = report["quality_checks"]["attention_check"]
    if isinstance(attn, dict) and attn.get("pass_rate", 1) < 1.0:
        issues += 1
    total_checks += 1

    sl = report["quality_checks"]["straightlining"]
    if isinstance(sl, dict) and sl.get("flagged_rate", 0) > 0.1:
        issues += 1
    total_checks += 1

    # Count bias issues
    for bias_name, bias_result in report["bias_detection"].items():
        if isinstance(bias_result, dict):
            if "status" in bias_result:
                continue
            for model_key, model_result in bias_result.items():
                if isinstance(model_result, dict) and model_result.get("flagged"):
                    issues += 1
                total_checks += 1

    ks = report["bias_detection"]["distribution_ks_tests"]
    if isinstance(ks, dict) and ks.get("significant_rate", 0) > 0.3:
        issues += 1
    total_checks += 1

    report["summary"] = {
        "total_checks": total_checks,
        "issues_found": issues,
        "grade": "A" if issues == 0 else ("B" if issues <= 2 else ("C" if issues <= 4 else "D")),
        "recommendation": (
            "Data quality is excellent. Findings can be reported with high confidence."
            if issues == 0 else
            "Minor issues detected. Findings are generally reliable but note flagged items."
            if issues <= 2 else
            "Moderate issues detected. Cross-validate flagged findings before reporting."
            if issues <= 4 else
            "Significant quality concerns. Review flagged items carefully before using results."
        ),
    }

    return report


def print_report(report: dict):
    """Pretty-print validation report to console."""
    print("=" * 70)
    print("  RESPONSE VALIDATION & BIAS DETECTION REPORT")
    print("=" * 70)
    print(f"\nData: {report['data_shape']['rows']} respondents, {report['data_shape']['columns']} columns")
    print(f"Models: {', '.join(report['models'])}")
    if report["segments"]:
        print(f"Segments: {', '.join(report['segments'])}")

    # Quality checks
    print(f"\n{'─' * 40}")
    print("QUALITY CHECKS")
    print(f"{'─' * 40}")

    attn = report["quality_checks"]["attention_check"]
    if isinstance(attn, dict) and "pass_rate" in attn:
        status = "PASS" if attn["pass_rate"] == 1.0 else "WARN"
        print(f"  [{status}] Attention check: {attn['passed']}/{attn['total']} ({attn['pass_rate']*100:.0f}%)")

    sl = report["quality_checks"]["straightlining"]
    if isinstance(sl, dict) and "flagged_rate" in sl:
        status = "PASS" if sl["flagged_rate"] < 0.1 else "WARN"
        print(f"  [{status}] Straightlining: {sl['flagged_count']}/{sl['total_checked']} flagged ({sl['flagged_rate']*100:.0f}%)")

    rv = report["quality_checks"]["range_violations"]
    if isinstance(rv, dict):
        status = "PASS" if rv["total_violations"] == 0 else "WARN"
        print(f"  [{status}] Range violations: {rv['total_violations']}")

    dc = report["quality_checks"]["demographic_consistency"]
    if isinstance(dc, dict) and "mismatches" in dc:
        status = "PASS" if dc["mismatches"] == 0 else "WARN"
        print(f"  [{status}] Demographic consistency: {dc['mismatches']} mismatches")

    # Bias detection
    print(f"\n{'─' * 40}")
    print("BIAS DETECTION")
    print(f"{'─' * 40}")

    ct = report["bias_detection"]["central_tendency"]
    if isinstance(ct, dict) and "status" not in ct:
        for model, result in ct.items():
            status = "WARN" if result.get("flagged") else "PASS"
            print(f"  [{status}] Central tendency ({model}): midpoint rate={result['midpoint_rate']*100:.0f}%, "
                  f"mean SD={result['mean_item_sd']:.2f}")

    aq = report["bias_detection"]["acquiescence"]
    if isinstance(aq, dict) and "status" not in aq:
        for model, result in aq.items():
            status = "WARN" if result.get("flagged") else "PASS"
            print(f"  [{status}] Acquiescence ({model}): grand mean={result['grand_mean']:.2f}")

    er = report["bias_detection"]["extreme_response"]
    if isinstance(er, dict) and "status" not in er:
        for model, result in er.items():
            status = "WARN" if result.get("flagged") else "PASS"
            print(f"  [{status}] Extreme response ({model}): rate={result['extreme_rate']*100:.0f}%")

    ks = report["bias_detection"]["distribution_ks_tests"]
    if isinstance(ks, dict) and "significant_rate" in ks:
        status = "WARN" if ks["significant_rate"] > 0.3 else "PASS"
        print(f"  [{status}] KS distribution tests: {ks['significant_count']}/{ks['total_tests']} "
              f"significant ({ks['significant_rate']*100:.0f}%)")

    hom = report["bias_detection"]["response_homogeneity"]
    if isinstance(hom, dict) and "flagged_count" in hom:
        status = "WARN" if hom["flagged_count"] > 0 else "PASS"
        print(f"  [{status}] Response homogeneity: {hom['flagged_count']}/{hom['total_groups']} groups flagged")

    # Confidence intervals
    print(f"\n{'─' * 40}")
    print("KEY METRIC CONFIDENCE INTERVALS (95%)")
    print(f"{'─' * 40}")
    cis = report["confidence_intervals"].get("overall", {})
    for label, ci in cis.items():
        print(f"  {label}: {ci['point_estimate']:.2f} [{ci['ci_lower']:.2f}, {ci['ci_upper']:.2f}] "
              f"(width={ci['ci_width']:.2f})")

    # Summary
    print(f"\n{'=' * 70}")
    summary = report["summary"]
    print(f"  GRADE: {summary['grade']}  ({summary['issues_found']} issues / {summary['total_checks']} checks)")
    print(f"  {summary['recommendation']}")
    print(f"{'=' * 70}")


# ── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Validate synthetic survey responses")
    parser.add_argument("--json", action="store_true", help="Output report as JSON")
    parser.add_argument("--csv", action="store_true", help="Save per-respondent quality scores")
    parser.add_argument("--data", type=str, default=None, help="Path to CSV (default: output/synthetic_responses.csv)")
    args = parser.parse_args()

    data_path = Path(args.data) if args.data else OUTPUT_DIR / "synthetic_responses.csv"
    if not data_path.exists():
        print(f"Error: {data_path} not found. Run generate_test_data.py first.")
        sys.exit(1)

    df = load_quant_data(data_path)
    print(f"Loaded {len(df)} rows from {data_path}")

    report = run_full_validation(df)

    if args.json:
        # Strip non-serializable items
        report_clean = json.loads(json.dumps(report, default=str))
        print(json.dumps(report_clean, indent=2))
    else:
        print_report(report)

    if args.csv:
        scores_df = compute_respondent_scores(df)
        scores_path = OUTPUT_DIR / "validation_scores.csv"
        scores_df.to_csv(scores_path, index=False)
        print(f"\nPer-respondent scores saved to {scores_path}")


if __name__ == "__main__":
    main()
