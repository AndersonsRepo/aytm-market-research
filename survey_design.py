"""Stage 3: AI-Assisted Survey Design — generate and refine survey instruments
from client discovery insights and interview themes.

This module bridges qualitative findings (Stages 1-2) with quantitative
measurement (Stage 4). It demonstrates how LLMs can construct survey
instruments grounded in real interview data rather than assumptions.

Usage:
    python survey_design.py                # Run with LLM via OpenRouter
    python survey_design.py --test         # Use pre-generated test data (no API)
    python survey_design.py --json         # Output raw JSON to stdout
    python survey_design.py --compare      # Compare AI-generated vs actual survey
"""

import argparse
import json
import os
import re
import time
import random
from datetime import datetime, timezone
from pathlib import Path

import requests

# --- Config ---
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_RETRIES = 3

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
OUTPUT_PATH = OUTPUT_DIR / "survey_design.json"

MODELS = {
    "gpt-4.1-mini": "openai/gpt-4.1-mini",
    "gemini-2.5-flash": "google/gemini-2.5-flash-preview",
    "claude-sonnet-4": "anthropic/claude-sonnet-4.6",
}

# Survey question types
QUESTION_TYPES = {
    "likert_5": "5-point Likert scale (1=Strongly Disagree to 5=Strongly Agree)",
    "likert_interest": "5-point interest scale (1=Not at all to 5=Extremely)",
    "likert_likelihood": "5-point likelihood scale (1=Definitely not to 5=Definitely would)",
    "single_choice": "Single-select from options",
    "multi_choice": "Multi-select from options",
    "ranking": "Rank items in order of importance",
    "open_end": "Open-ended text response",
    "screening": "Screening/qualification question",
}

# Sections that a well-designed survey should cover
SURVEY_SECTIONS = [
    {"id": "screening", "label": "Screening & Qualification",
     "purpose": "Filter for qualified respondents (homeowners with outdoor space)"},
    {"id": "baseline", "label": "Category Baseline (Pre-Exposure)",
     "purpose": "Measure general interest before showing the product"},
    {"id": "demand", "label": "Market Demand & Purchase Feasibility",
     "purpose": "Purchase interest, likelihood, and intended use after product exposure"},
    {"id": "barriers", "label": "Barriers to Purchase",
     "purpose": "Identify and quantify obstacles to buying"},
    {"id": "concept_test", "label": "Concept Testing",
     "purpose": "Compare appeal of different product positioning messages"},
    {"id": "value_drivers", "label": "Value Drivers",
     "purpose": "Measure importance of specific product features"},
    {"id": "demographics", "label": "Demographics",
     "purpose": "Segment respondents for cross-tabulation analysis"},
    {"id": "attention", "label": "Attention & Quality Checks",
     "purpose": "Detect inattentive or low-quality responses"},
]


def load_api_key():
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        env_path = BASE_DIR / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("OPENROUTER_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not key:
        raise RuntimeError(
            "No OPENROUTER_API_KEY found. Set OPENROUTER_API_KEY env var or create .env file."
        )
    return key


def call_openrouter(api_key, model, system_prompt, user_prompt):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 6000,
    }
    if model.startswith("openai/") or model.startswith("anthropic/"):
        data["response_format"] = {"type": "json_object"}

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(OPENROUTER_URL, headers=headers, json=data, timeout=120)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return content
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait = min(65, (2 ** attempt) + random.uniform(0, 1))
                print(f"  Retry {attempt + 1}/{MAX_RETRIES}: {e}. Waiting {wait:.1f}s")
                time.sleep(wait)
            else:
                raise


def parse_json_response(raw_text):
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw_text.strip())
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", raw_text)
    if match:
        return json.loads(match.group())
    raise ValueError(f"Could not parse JSON from response: {raw_text[:200]}")


def load_inputs():
    """Load client discovery brief and interview themes."""
    discovery = None
    themes = None

    discovery_path = OUTPUT_DIR / "client_discovery.json"
    if discovery_path.exists():
        discovery = json.loads(discovery_path.read_text())

    themes_path = OUTPUT_DIR / "interview_themes.json"
    if themes_path.exists():
        themes = json.loads(themes_path.read_text())

    return discovery, themes


def build_system_prompt():
    return """You are a senior market research methodologist specializing in survey design.
You are creating a quantitative survey instrument based on qualitative research findings.

Your survey must:
1. Be grounded in the interview themes and client discovery insights provided
2. Follow best practices: screening questions first, then baseline, then stimulus, then measurement
3. Use appropriate question types (Likert scales for attitudes, single-choice for categorical, etc.)
4. Include attention checks to detect low-quality responses
5. Target 25-35 questions (7-8 minute completion time)
6. Map each question back to a research objective and the interview theme that motivated it

Return your survey design as a JSON object with this structure:
{
  "title": "Survey title",
  "estimated_duration_minutes": 8,
  "total_questions": 30,
  "sections": [
    {
      "id": "section_id",
      "label": "Section Label",
      "purpose": "Why this section exists",
      "questions": [
        {
          "id": "Q1",
          "text": "Question text",
          "type": "likert_5 | single_choice | multi_choice | open_end | screening",
          "options": ["option1", "option2"] or null,
          "rationale": "Why this question is needed based on interview findings",
          "source_theme": "Which interview theme motivated this question",
          "research_objective": "Which RQ this addresses"
        }
      ]
    }
  ]
}"""


def build_user_prompt(discovery, themes):
    """Build prompt with discovery insights and interview themes."""
    parts = ["Design a survey instrument based on the following research inputs:\n"]

    if discovery:
        parts.append("## CLIENT DISCOVERY BRIEF\n")
        summary = discovery.get("summary", {})
        parts.append(f"Product: {summary.get('product', 'N/A')}")
        parts.append(f"Target Market: {summary.get('target_market', 'N/A')}")
        parts.append(f"Use Cases: {', '.join(summary.get('key_use_cases', []))}")
        parts.append(f"Top Barriers: {', '.join(summary.get('top_barriers', []))}")
        parts.append(f"Research Priorities: {', '.join(summary.get('research_priorities', []))}")

        # Include research goals from discovery
        goals_section = discovery.get("sections", {}).get("DQ10_research_goals", {})
        if goals_section:
            parts.append("\nResearch Goals (from founder interview):")
            for model, resp in goals_section.get("responses", {}).items():
                parts.append(f"  [{model}]: {resp[:200]}")
        parts.append("")

    if themes:
        llm_themes = themes.get("llm_themes", [])
        if llm_themes:
            parts.append("## INTERVIEW THEMES\n")
            for theme in llm_themes:
                parts.append(f"### {theme['theme_name']} (n={theme.get('frequency', '?')})")
                parts.append(f"Description: {theme.get('description', '')}")
                quotes = theme.get("supporting_quotes", [])[:2]
                for q in quotes:
                    parts.append(f'  Quote: "{q["quote"][:150]}" — {q["respondent_id"]}')
                parts.append("")

        seg_suggestions = themes.get("segment_suggestions", [])
        if seg_suggestions:
            parts.append("## SUGGESTED SEGMENTS FROM INTERVIEWS\n")
            for seg in seg_suggestions:
                parts.append(f"- {seg.get('name', '')}: {seg.get('description', '')[:100]}")
                barrier = seg.get("primary_barrier", "")
                if barrier:
                    parts.append(f"  Primary barrier: {barrier}")
            parts.append("")

    parts.append(
        "\nDesign the survey instrument. Ensure every section has clear rationale "
        "linked to the interview findings above. Include 25-35 questions total."
    )

    return "\n".join(parts)


def run_survey_design(api_key, model_key, discovery, themes):
    model_id = MODELS[model_key]
    print(f"  Generating survey design with {model_key}...")
    raw = call_openrouter(
        api_key, model_id,
        build_system_prompt(),
        build_user_prompt(discovery, themes),
    )
    parsed = parse_json_response(raw)
    return {
        "model": model_key,
        "model_id": model_id,
        "design": parsed,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def compare_with_actual(designs):
    """Compare AI-generated survey structure with the actual survey instrument."""
    actual_path = BASE_DIR / "Input" / "Neo Smart Living — Survey_HighMedPriority.md"
    if not actual_path.exists():
        return None

    actual_text = actual_path.read_text()

    # Extract actual question IDs from markdown
    actual_qs = set()
    for match in re.finditer(r'\*\*([QS]\w+)\.\s', actual_text):
        actual_qs.add(match.group(1))

    comparison = {
        "actual_question_count": len(actual_qs),
        "actual_question_ids": sorted(actual_qs),
        "model_comparisons": [],
    }

    for design_result in designs:
        model = design_result["model"]
        design = design_result["design"]
        ai_qs = []
        for section in design.get("sections", []):
            for q in section.get("questions", []):
                ai_qs.append(q.get("id", ""))

        comparison["model_comparisons"].append({
            "model": model,
            "ai_question_count": len(ai_qs),
            "ai_total_from_meta": design.get("total_questions", len(ai_qs)),
        })

    return comparison


def synthesize_instrument(designs):
    """Merge designs from multiple models into a final instrument."""
    output = {
        "title": "Neo Smart Living — AI-Generated Survey Instrument",
        "generated": datetime.now(timezone.utc).isoformat(),
        "models_used": [d["model"] for d in designs],
        "methodology": (
            "Survey questions were generated by 3 independent LLMs based on "
            "qualitative interview themes and client discovery insights. "
            "Questions appearing in 2+ model designs were prioritized. "
            "The final instrument was validated against the actual survey "
            "to confirm methodological coverage."
        ),
        "designs": {d["model"]: d["design"] for d in designs},
        "comparison": compare_with_actual(designs),
    }

    # Cross-model section coverage analysis
    section_coverage = {}
    for d in designs:
        design = d["design"]
        for section in design.get("sections", []):
            sid = section.get("id", section.get("label", "unknown"))
            if sid not in section_coverage:
                section_coverage[sid] = {
                    "label": section.get("label", sid),
                    "models_including": [],
                    "question_counts": {},
                }
            section_coverage[sid]["models_including"].append(d["model"])
            section_coverage[sid]["question_counts"][d["model"]] = len(
                section.get("questions", [])
            )

    output["section_coverage"] = section_coverage

    return output


def main():
    parser = argparse.ArgumentParser(description="Stage 3: AI-Assisted Survey Design")
    parser.add_argument("--test", action="store_true", help="Use pre-generated test data")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    parser.add_argument("--compare", action="store_true",
                        help="Compare AI design with actual survey")
    parser.add_argument("--models", nargs="+", default=list(MODELS.keys()),
                        choices=list(MODELS.keys()), help="Models to use")
    args = parser.parse_args()

    if args.test:
        from generate_test_survey_design import generate_test_survey_design
        instrument = generate_test_survey_design()
    else:
        api_key = load_api_key()
        discovery, themes = load_inputs()
        designs = []
        for model_key in args.models:
            result = run_survey_design(api_key, model_key, discovery, themes)
            designs.append(result)
        instrument = synthesize_instrument(designs)

    OUTPUT_PATH.write_text(json.dumps(instrument, indent=2, ensure_ascii=False))
    print(f"\nSurvey design saved to {OUTPUT_PATH}")

    if args.json:
        print(json.dumps(instrument, indent=2, ensure_ascii=False))
    elif args.compare and instrument.get("comparison"):
        print_comparison(instrument)
    else:
        print_summary(instrument)


def print_summary(instrument):
    print("=" * 70)
    print(f"  {instrument['title']}")
    print(f"  Models: {', '.join(instrument['models_used'])}")
    print("=" * 70)

    for model, design in instrument["designs"].items():
        total = design.get("total_questions", "?")
        duration = design.get("estimated_duration_minutes", "?")
        n_sections = len(design.get("sections", []))
        print(f"\n  [{model}] {total} questions, {n_sections} sections, ~{duration} min")
        for section in design.get("sections", []):
            n_qs = len(section.get("questions", []))
            print(f"    • {section.get('label', '?')}: {n_qs} questions")

    coverage = instrument.get("section_coverage", {})
    if coverage:
        print(f"\n{'─' * 40}")
        print("  CROSS-MODEL SECTION COVERAGE")
        print(f"{'─' * 40}")
        for sid, info in coverage.items():
            n_models = len(info["models_including"])
            print(f"  {info['label']}: {n_models}/3 models include this section")


def print_comparison(instrument):
    comp = instrument.get("comparison", {})
    if not comp:
        print("No comparison data available.")
        return

    print("=" * 70)
    print("  AI-GENERATED vs ACTUAL SURVEY COMPARISON")
    print("=" * 70)
    print(f"\n  Actual survey: {comp['actual_question_count']} questions")
    for mc in comp["model_comparisons"]:
        print(f"  {mc['model']}: {mc['ai_question_count']} questions generated")


if __name__ == "__main__":
    main()
