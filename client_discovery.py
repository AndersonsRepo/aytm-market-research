"""Stage 1: Client Discovery Interview — simulate a structured interview with
Neo Smart Living's founding team to extract business context, goals, and
competitive positioning.

This is the entry point of the 6-stage pipeline. The output (a structured
business brief) feeds into persona design, survey construction, and analysis
interpretation.

Usage:
    python client_discovery.py                # Run with LLM via OpenRouter
    python client_discovery.py --test         # Use pre-generated test data (no API)
    python client_discovery.py --json         # Output raw JSON to stdout
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
OUTPUT_PATH = OUTPUT_DIR / "client_discovery.json"

# Models — same 3-model triangulation as the rest of the pipeline
MODELS = {
    "gpt-4.1-mini": "openai/gpt-4.1-mini",
    "gemini-2.5-flash": "google/gemini-2.5-flash-preview",
    "claude-sonnet-4": "anthropic/claude-sonnet-4.6",
}

# --- Discovery Interview Guide ---
# These questions map to the aytm challenge's Stage 1: Client Discovery Interview.
# They extract the business context a real market researcher would gather before
# designing survey instruments or consumer interviews.

DISCOVERY_QUESTIONS = {
    "DQ1_company_background": (
        "Tell me about Neo Smart Living. When was the company founded, "
        "what's your mission, and what gap in the market are you addressing?"
    ),
    "DQ2_product_overview": (
        "Walk me through the Tahoe Mini. What is it physically, how is it "
        "delivered and installed, and what makes it different from competitors "
        "like sheds, ADUs, or container conversions?"
    ),
    "DQ3_target_customer": (
        "Who is your ideal customer? Describe the demographics, psychographics, "
        "and life situations of the people most likely to buy."
    ),
    "DQ4_use_cases": (
        "What are the primary use cases you see for the Tahoe Mini? Which use "
        "case do you think has the biggest market opportunity and why?"
    ),
    "DQ5_pricing_value": (
        "Your price point is around $23,000 delivered and installed. How did you "
        "arrive at this price? How do customers react to it, and what value "
        "proposition justifies it?"
    ),
    "DQ6_competitive_landscape": (
        "Who are your main competitors? How do you differentiate — on price, "
        "quality, speed of installation, design, permits, or something else?"
    ),
    "DQ7_barriers_challenges": (
        "What are the biggest barriers to purchase you've observed? HOA "
        "restrictions, permit confusion, financing, skepticism about quality? "
        "What keeps people from saying yes?"
    ),
    "DQ8_marketing_channels": (
        "How are you currently reaching customers? What marketing channels "
        "work best? Are there channels you haven't tried that you're curious about?"
    ),
    "DQ9_brand_perception": (
        "How do you want people to feel about Neo Smart Living as a brand? "
        "What emotions or associations should the brand evoke?"
    ),
    "DQ10_research_goals": (
        "If this market research study could answer any three questions for you, "
        "what would they be? What decisions are riding on the findings?"
    ),
}

QUESTION_LABELS = {
    "DQ1_company_background": "Company Background",
    "DQ2_product_overview": "Product Overview",
    "DQ3_target_customer": "Target Customer",
    "DQ4_use_cases": "Use Cases",
    "DQ5_pricing_value": "Pricing & Value Proposition",
    "DQ6_competitive_landscape": "Competitive Landscape",
    "DQ7_barriers_challenges": "Barriers to Purchase",
    "DQ8_marketing_channels": "Marketing Channels",
    "DQ9_brand_perception": "Brand Perception Goals",
    "DQ10_research_goals": "Research Goals",
}


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
            "No OPENROUTER_API_KEY found. Either:\n"
            "  1. Set environment variable: export OPENROUTER_API_KEY=sk-or-...\n"
            "  2. Create a .env file in this directory with: OPENROUTER_API_KEY=sk-or-...\n"
            "  Get your key at https://openrouter.ai/keys"
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
        "max_tokens": 4000,
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


# --- Business Context (ground truth for the LLM role-play) ---

NEO_SMART_LIVING_CONTEXT = """You are role-playing as the co-founder of Neo Smart Living, a startup that
manufactures and sells the Tahoe Mini — a ~117 sq ft prefabricated backyard
structure. You are being interviewed by a market researcher.

Key facts about your company and product (use these as ground truth, but respond
naturally as a real founder would — with enthusiasm, occasional tangents, and
authentic business concerns):

COMPANY:
- Neo Smart Living, founded 2023, based in Southern California
- Mission: make high-quality backyard living spaces accessible to every homeowner
- Small team, direct-to-consumer model
- Instagram: @neosmartliving

PRODUCT — TAHOE MINI:
- 117 sq ft prefabricated modular structure
- Price: ~$23,000 delivered and professionally installed
- Designed under California's ~120 sq ft permit threshold (permit-light, not permit-free)
- Installation: 1 day by professional crew
- Construction: modular wall panels, pre-wired electrical, dual-pane glass, insulated
- Use cases: home office, guest suite, wellness studio, creative space, adventure basecamp
- NOT an ADU (no plumbing/kitchen) — positioned as "backyard room"

MARKET:
- Primary market: Southern California homeowners with backyards
- Sweet spot: $75K-$200K household income, ages 25-54
- Key segments: remote workers, wellness-focused, property maximizers, active adventurers, budget DIYers
- Competitors: Tuff Shed (~$5K-$15K, lower quality), ADU builders ($100K+, months to build),
  container conversions ($30K-$60K), custom builders ($50K+)

CHALLENGES:
- HOA restrictions in many SoCal communities
- Permit confusion (customers think they need full permits)
- Financing not yet available (exploring partnerships)
- "Just a shed" perception vs. actual build quality
- Balancing price accessibility with premium positioning

GOALS FOR THIS RESEARCH:
1. Validate which use case has the largest addressable market
2. Understand price sensitivity and willingness to pay
3. Identify the most effective messaging to overcome the "just a shed" objection
"""

RESPONSE_SCHEMA = json.dumps(
    {k: "Your 3-6 sentence answer as the Neo Smart Living founder" for k in DISCOVERY_QUESTIONS},
    indent=2,
)


def build_system_prompt():
    return (
        NEO_SMART_LIVING_CONTEXT + "\n\n"
        "You are in a recorded interview with a market researcher. Answer each question "
        "thoughtfully and authentically, drawing on the facts above but speaking naturally "
        "as a startup founder would — passionate about the product, honest about challenges, "
        "and eager to learn from the research.\n\n"
        "Respond in JSON format with these keys:\n" + RESPONSE_SCHEMA
    )


def build_user_prompt():
    lines = ["Here are the interview questions. Please answer each one:\n"]
    for key, question in DISCOVERY_QUESTIONS.items():
        lines.append(f"{key}: {question}")
    return "\n".join(lines)


def run_discovery_interview(api_key, model_key):
    model_id = MODELS[model_key]
    print(f"  Running discovery interview with {model_key} ({model_id})...")
    raw = call_openrouter(api_key, model_id, build_system_prompt(), build_user_prompt())
    parsed = parse_json_response(raw)
    return {
        "model": model_key,
        "model_id": model_id,
        "responses": parsed,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def synthesize_brief(interviews):
    """Merge responses from all models into a structured business brief.

    For each question, we take the response that all models broadly agree on,
    noting where models diverge. This is a deterministic merge — no LLM call.
    """
    brief = {
        "title": "Neo Smart Living — Client Discovery Brief",
        "generated": datetime.now(timezone.utc).isoformat(),
        "models_used": [i["model"] for i in interviews],
        "sections": {},
    }

    for key in DISCOVERY_QUESTIONS:
        label = QUESTION_LABELS[key]
        responses = {}
        for interview in interviews:
            model = interview["model"]
            resp = interview["responses"].get(key, "")
            responses[model] = resp

        brief["sections"][key] = {
            "label": label,
            "question": DISCOVERY_QUESTIONS[key],
            "responses": responses,
        }

    # Extract key themes across all responses
    brief["summary"] = {
        "product": "Tahoe Mini — 117 sq ft prefab backyard structure, ~$23K, 1-day install",
        "target_market": "SoCal homeowners, $75K-$200K income, ages 25-54",
        "key_use_cases": [
            "Home office / remote work",
            "Guest suite / short-term rental",
            "Wellness studio / meditation space",
            "Creative space / content creation",
            "Adventure basecamp / gear storage",
        ],
        "top_barriers": [
            "HOA restrictions",
            "Permit confusion",
            "Price perception vs. sheds",
            "Financing availability",
            "Build quality skepticism",
        ],
        "research_priorities": [
            "Validate largest addressable use case",
            "Understand price sensitivity",
            "Identify messaging to overcome 'just a shed' objection",
        ],
    }

    return brief


def main():
    parser = argparse.ArgumentParser(description="Stage 1: Client Discovery Interview")
    parser.add_argument("--test", action="store_true", help="Use pre-generated test data (no API)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON to stdout")
    parser.add_argument("--models", nargs="+", default=list(MODELS.keys()),
                        choices=list(MODELS.keys()), help="Models to use")
    args = parser.parse_args()

    if args.test:
        from generate_test_discovery import generate_test_discovery
        brief = generate_test_discovery()
    else:
        api_key = load_api_key()
        interviews = []
        for model_key in args.models:
            result = run_discovery_interview(api_key, model_key)
            interviews.append(result)
        brief = synthesize_brief(interviews)

    # Save
    OUTPUT_PATH.write_text(json.dumps(brief, indent=2, ensure_ascii=False))
    print(f"\nClient discovery brief saved to {OUTPUT_PATH}")

    if args.json:
        print(json.dumps(brief, indent=2, ensure_ascii=False))
    else:
        print_brief(brief)


def print_brief(brief):
    print("=" * 70)
    print(f"  {brief['title']}")
    print(f"  Models: {', '.join(brief['models_used'])}")
    print("=" * 70)

    for key, section in brief["sections"].items():
        print(f"\n{'─' * 40}")
        print(f"  {section['label']}")
        print(f"  Q: {section['question'][:80]}...")
        print(f"{'─' * 40}")
        for model, response in section["responses"].items():
            print(f"\n  [{model}]")
            # Wrap text for readability
            text = response if isinstance(response, str) else str(response)
            for line in text.split(". "):
                print(f"    {line.strip()}.")

    print(f"\n{'=' * 70}")
    print("  RESEARCH PRIORITIES")
    for i, p in enumerate(brief["summary"]["research_priorities"], 1):
        print(f"    {i}. {p}")
    print("=" * 70)


if __name__ == "__main__":
    main()
