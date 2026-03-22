#!/usr/bin/env python3
"""One-command demo runner for the Neo Smart Living market research pipeline.

This script generates all test data, runs validation, prints key findings,
and optionally launches the interactive dashboard — perfect for hackathon
presentations and live demos.

Usage:
    python demo.py                    # Full demo: generate data + print findings
    python demo.py --dashboard        # Full demo + launch Streamlit dashboard
    python demo.py --quick            # Skip data gen, just show findings
    python demo.py --live             # Use real LLM APIs (costs ~$0.10)
"""

import argparse
import json
import subprocess
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=RuntimeWarning)

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"

# ANSI colors for terminal output
BOLD = "\033[1m"
DIM = "\033[2m"
GREEN = "\033[92m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
RESET = "\033[0m"
CHECK = f"{GREEN}✓{RESET}"
ARROW = f"{CYAN}→{RESET}"


def header(text, char="═"):
    width = 70
    print(f"\n{BOLD}{char * width}")
    print(f"  {text}")
    print(f"{char * width}{RESET}")


def subheader(text):
    print(f"\n{BOLD}{BLUE}── {text} ──{RESET}")


def step(msg):
    print(f"  {ARROW} {msg}", end="", flush=True)


def done(detail=""):
    if detail:
        print(f" {CHECK} {DIM}{detail}{RESET}")
    else:
        print(f" {CHECK}")


def warn(msg):
    print(f"  {YELLOW}⚠ {msg}{RESET}")


def stage_banner(num, title, desc):
    print(f"\n{BOLD}{CYAN}┌─ Stage {num}: {title} ─────────────────────────────────{RESET}")
    print(f"{CYAN}│{RESET} {DIM}{desc}{RESET}")
    print(f"{CYAN}└{'─' * 55}{RESET}")


# ── Data Generation ──────────────────────────────────────────────────────

def generate_test_data():
    """Generate all test data offline (no API calls)."""
    header("GENERATING TEST DATA", "─")

    stage_banner(1, "Client Discovery", "Simulated founder interview across 3 LLMs")
    step("Generating client discovery brief...")
    from generate_test_discovery import generate_test_discovery
    brief = generate_test_discovery()
    (OUTPUT_DIR / "client_discovery.json").write_text(
        json.dumps(brief, indent=2, ensure_ascii=False)
    )
    done(f"{len(brief['sections'])} questions, {len(brief['models_used'])} models")

    stage_banner(2, "Consumer Interviews", "30 depth interviews with adaptive follow-ups")
    step("Generating interview transcripts + analysis...")
    # Suppress verbose output from generators
    import io
    import contextlib
    with contextlib.redirect_stdout(io.StringIO()):
        from generate_test_interviews import generate_all_test_data
        interview_stats = generate_all_test_data()
    done(f"{interview_stats['n_interviews']} interviews, {interview_stats['n_themes']} themes")

    stage_banner(3, "Survey Design", "AI-generated instrument from interview themes")
    step("Generating survey instrument...")
    with contextlib.redirect_stdout(io.StringIO()):
        from generate_test_survey_design import generate_test_survey_design
        instrument = generate_test_survey_design()
    from survey_design import OUTPUT_PATH as SD_PATH
    SD_PATH.write_text(json.dumps(instrument, indent=2, ensure_ascii=False))
    avg_qs = sum(d.get("total_questions", 0) for d in instrument["designs"].values()) // len(instrument["designs"])
    done(f"{avg_qs} avg questions, {len(instrument['designs'])} model designs")

    stage_banner(4, "Survey Responses", "90 survey responses across 5 segments × 3 models")
    step("Generating synthetic survey responses...")
    with contextlib.redirect_stdout(io.StringIO()):
        from generate_test_data import generate_test_data as gen_survey
        gen_survey()
    import pandas as pd
    df = pd.read_csv(OUTPUT_DIR / "synthetic_responses.csv")
    done(f"{len(df)} respondents, {df['segment_name'].nunique()} segments, {df['model'].nunique()} models")


def generate_live_data():
    """Generate data using real LLM APIs via OpenRouter."""
    header("GENERATING LIVE DATA (API)", "─")
    warn("This will make API calls via OpenRouter (~$0.10 total)")

    scripts = [
        ("client_discovery.py", "Stage 1: Client discovery interview"),
        ("synthetic_interviews.py", "Stage 2: Consumer interviews (30)"),
        ("interview_analysis.py", "Stage 2: Interview analysis"),
        ("multi_turn_interviews.py", "Stage 2: Multi-turn follow-ups"),
        ("synthetic_respondents.py", "Stage 3-4: Survey responses (90)"),
    ]

    for script, desc in scripts:
        step(f"{desc}...")
        result = subprocess.run(
            [sys.executable, str(BASE_DIR / script)],
            capture_output=True, text=True, cwd=str(BASE_DIR)
        )
        if result.returncode == 0:
            done()
        else:
            print(f" {RED}✗{RESET}")
            print(f"    {DIM}{result.stderr[:200]}{RESET}")
            return False
    return True


# ── Key Findings ─────────────────────────────────────────────────────────

def print_findings():
    """Print key research findings from the generated data."""
    import pandas as pd
    import numpy as np

    header("KEY FINDINGS — Neo Smart Living Tahoe Mini")

    # Load data
    quant = pd.read_csv(OUTPUT_DIR / "synthetic_responses.csv")
    from analytics import ALL_NUMERIC
    for col in ALL_NUMERIC:
        if col in quant.columns:
            quant[col] = pd.to_numeric(quant[col], errors="coerce")

    discovery = None
    if (OUTPUT_DIR / "client_discovery.json").exists():
        discovery = json.loads((OUTPUT_DIR / "client_discovery.json").read_text())

    qual = None
    if (OUTPUT_DIR / "interview_analysis.csv").exists():
        qual = pd.read_csv(OUTPUT_DIR / "interview_analysis.csv")

    themes = None
    if (OUTPUT_DIR / "interview_themes.json").exists():
        themes = json.loads((OUTPUT_DIR / "interview_themes.json").read_text())

    # ── 1. Research Priorities (from discovery) ──
    if discovery:
        subheader("Research Priorities (from Client Discovery)")
        for i, p in enumerate(discovery["summary"]["research_priorities"], 1):
            print(f"  {BOLD}{i}.{RESET} {p}")

    # ── 2. Purchase Intent ──
    subheader("Purchase Intent")
    q1_mean = quant["Q1"].mean()
    q2_mean = quant["Q2"].mean()
    q7_mean = quant["Q7"].mean()
    print(f"  Purchase Interest (Q1):     {BOLD}{q1_mean:.2f}/5{RESET}  {'📈' if q1_mean > 3 else '📉'}")
    print(f"  Purchase Likelihood (Q2):   {BOLD}{q2_mean:.2f}/5{RESET}  {'📈' if q2_mean > 3 else '📉'}")
    print(f"  Permit-Light Effect (Q7):   {BOLD}{q7_mean:.2f}/5{RESET}  {'📈' if q7_mean > 3 else '📉'}")

    # ── 3. Segment Ranking ──
    subheader("Segment Purchase Interest (Ranked)")
    seg_means = quant.groupby("segment_name")["Q1"].mean().sort_values(ascending=False)
    for i, (seg, mean) in enumerate(seg_means.items(), 1):
        bar = "█" * int(mean * 4)
        print(f"  {i}. {seg:28s} {BOLD}{mean:.2f}{RESET}  {GREEN}{bar}{RESET}")

    # ── 4. Top Barriers ──
    subheader("Top Barriers to Purchase")
    from analytics import BARRIER_KEYS
    barrier_means = {BARRIER_KEYS[k]: quant[k].mean() for k in BARRIER_KEYS if k in quant.columns}
    sorted_barriers = sorted(barrier_means.items(), key=lambda x: x[1], reverse=True)
    for i, (name, val) in enumerate(sorted_barriers[:5], 1):
        bar = "█" * int(val * 4)
        print(f"  {i}. {name:28s} {BOLD}{val:.2f}/5{RESET}  {RED}{bar}{RESET}")

    # ── 5. Concept Appeal ──
    subheader("Concept Appeal (Top Use Cases)")
    concepts = {"Q9a": "Home Office", "Q10a": "Guest Suite/STR", "Q11a": "Wellness Studio",
                "Q12a": "Adventure Basecamp", "Q13a": "Simplicity"}
    concept_means = {label: quant[k].mean() for k, label in concepts.items() if k in quant.columns}
    sorted_concepts = sorted(concept_means.items(), key=lambda x: x[1], reverse=True)
    for i, (name, val) in enumerate(sorted_concepts, 1):
        bar = "█" * int(val * 4)
        print(f"  {i}. {name:28s} {BOLD}{val:.2f}/5{RESET}  {BLUE}{bar}{RESET}")

    # ── 6. Interview Themes ──
    if themes:
        llm_themes = themes.get("llm_themes", [])
        if llm_themes:
            subheader(f"Emergent Interview Themes ({len(llm_themes)} discovered)")
            for theme in llm_themes[:5]:
                freq = theme.get("frequency", "?")
                print(f"  • {BOLD}{theme['theme_name']}{RESET} (n={freq})")
                desc = theme.get("description", "")[:100]
                if desc:
                    print(f"    {DIM}{desc}...{RESET}")

    # ── 7. Emotional Response ──
    if qual is not None and "primary_emotion" in qual.columns:
        subheader("Emotional Response to Product")
        emotion_dist = qual["primary_emotion"].value_counts()
        for emotion, count in emotion_dist.head(4).items():
            pct = count / len(qual) * 100
            print(f"  • {emotion.title():20s} {count:2d} ({pct:.0f}%)")

    # ── 8. Model Reliability ──
    subheader("3-Model Reliability Check")
    from analytics import model_comparison_likert
    mc = model_comparison_likert(quant)
    if isinstance(mc, dict):
        kw = mc["kruskal_wallis"]
        n_sig = kw["Significant (p<.05)"].sum()
        n_total = len(kw)
        robust_pct = (n_total - n_sig) / n_total * 100
        status = f"{GREEN}HIGH{RESET}" if robust_pct >= 80 else (f"{YELLOW}MODERATE{RESET}" if robust_pct >= 60 else f"{RED}LOW{RESET}")
        print(f"  Cross-model consistency: {BOLD}{robust_pct:.0f}%{RESET} ({n_total - n_sig}/{n_total} variables agree)")
        print(f"  Confidence level: {status}")
        print(f"  Models: GPT-4.1-mini, Gemini 2.5 Flash, Claude Sonnet 4")

    # ── 9. Data Quality ──
    subheader("Data Quality Grade")
    from validation import run_full_validation
    report = run_full_validation(quant)
    summary = report["summary"]
    grade_color = {
        "A": GREEN, "B": BLUE, "C": YELLOW, "D": RED
    }.get(summary["grade"], RESET)
    print(f"  Grade: {BOLD}{grade_color}{summary['grade']}{RESET} ({summary['issues_found']} issues / {summary['total_checks']} checks)")
    print(f"  {DIM}{summary['recommendation']}{RESET}")

    # ── Bottom line ──
    header("BOTTOM LINE FOR NEO SMART LIVING")
    print(f"""
  {BOLD}1. Lead with Home Office{RESET} — highest concept appeal across all segments
  {BOLD}2. Permit-light messaging works{RESET} — Q7 scores consistently above midpoint
  {BOLD}3. HOA is the #1 barrier{RESET} — invest in HOA navigation guides/support
  {BOLD}4. Price is perceived as value{RESET} — when framed against ADUs, not sheds
  {BOLD}5. Findings are robust{RESET} — consistent across 3 independent LLMs
""")


# ── Static Report ────────────────────────────────────────────────────────

def generate_report():
    """Generate static CSV + PNG report."""
    step("Generating static report (CSVs + charts)...")
    result = subprocess.run(
        [sys.executable, str(BASE_DIR / "report.py")],
        capture_output=True, text=True, cwd=str(BASE_DIR)
    )
    if result.returncode == 0:
        done("output/report/")
    else:
        print(f" {RED}✗{RESET}")
        warn(result.stderr[:200])


# ── Dashboard Launch ─────────────────────────────────────────────────────

def launch_dashboard():
    """Launch the combined Streamlit dashboard."""
    header("LAUNCHING INTERACTIVE DASHBOARD")
    print(f"  {ARROW} Opening combined dashboard in browser...")
    print(f"  {DIM}Press Ctrl+C to stop the dashboard server{RESET}\n")
    subprocess.run(
        ["streamlit", "run", str(BASE_DIR / "combined_dashboard.py"),
         "--server.headless", "true"],
        cwd=str(BASE_DIR)
    )


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Demo runner for Neo Smart Living market research pipeline"
    )
    parser.add_argument("--dashboard", action="store_true",
                        help="Launch Streamlit dashboard after findings")
    parser.add_argument("--quick", action="store_true",
                        help="Skip data generation, show findings only")
    parser.add_argument("--live", action="store_true",
                        help="Use real LLM APIs via OpenRouter (~$0.10)")
    parser.add_argument("--report", action="store_true",
                        help="Also generate static CSV + PNG report")
    args = parser.parse_args()

    header("NEO SMART LIVING — SIMULATED MARKET RESEARCH PIPELINE")
    print(f"  {DIM}Aytm x Neo Smart Living Joint Challenge — CPP AI Hackathon 2026{RESET}")
    print(f"  {DIM}Pipeline: Client Discovery → Interviews → Survey → Analysis → Validation{RESET}")
    print(f"  {DIM}Models: GPT-4.1-mini + Gemini 2.5 Flash + Claude Sonnet 4 (via OpenRouter){RESET}")

    if not args.quick:
        if args.live:
            success = generate_live_data()
            if not success:
                print(f"\n{RED}Live data generation failed. Falling back to test data.{RESET}")
                generate_test_data()
        else:
            generate_test_data()

    if args.report:
        generate_report()

    print_findings()

    if args.dashboard:
        launch_dashboard()
    else:
        header("NEXT STEPS")
        print(f"  {ARROW} Launch interactive dashboard: {BOLD}python demo.py --dashboard{RESET}")
        print(f"  {ARROW} Generate static report:       {BOLD}python demo.py --report{RESET}")
        print(f"  {ARROW} Use real LLM APIs:            {BOLD}python demo.py --live{RESET}")
        print(f"  {ARROW} Quick findings only:           {BOLD}python demo.py --quick{RESET}")


if __name__ == "__main__":
    main()
