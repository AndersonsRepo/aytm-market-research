"""Generate 30 synthetic depth interviews using GPT-4.1-mini and Gemini 2.5 Flash via OpenRouter."""

import json
import os
import re
import time
import random
import csv
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

from interview_personas import INTERVIEW_PERSONAS, MODEL_ASSIGNMENTS, MODEL_LABELS

# --- Config ---
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_WORKERS = 10
MAX_RETRIES = 3
CHECKPOINT_INTERVAL = 10

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# --- Interview Guide ---
INTERVIEW_QUESTIONS = {
    "IQ1": "Tell me about your backyard. How do you use it? How do you feel about it?",
    "IQ2": "What are the biggest unmet needs in your home? Anything you wish you had more space for?",
    "IQ3": "Have you ever thought about adding a separate structure (shed, studio, office)? What drove that or held you back?",
    "IQ4": "If you could add a ~120 sq ft private backyard space tomorrow, what would you use it for and why?",
    "IQ5": "How do you handle work/personal boundaries at home? Do you have a dedicated workspace?",
    "IQ6": "[The Tahoe Mini by Neo Smart Living is a ~120 sq ft prefabricated backyard structure priced at $23,000, professionally installed in one day, and designed to be permit-light in most jurisdictions.] What's your immediate reaction — what excites you, what concerns you?",
    "IQ7": "What would need to be true for you to seriously consider this? What's the dealbreaker?",
    "IQ8": "Would brand sponsorship of outdoor/community events affect your perception of this brand? How do you typically discover new home products?",
}

RESPONSE_KEYS = list(INTERVIEW_QUESTIONS.keys()) + ["additional_thoughts"]

RESPONSE_SCHEMA = json.dumps(
    {k: "Your 3-6 sentence answer" for k in RESPONSE_KEYS},
    indent=2,
)


def load_api_key():
    """Load OpenRouter API key from environment variable or .env file."""
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
    """Call OpenRouter API with retry logic."""
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
        "temperature": 0.8,
        "max_tokens": 3000,
    }
    if model.startswith("openai/"):
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
                print(f"  Retry {attempt + 1}/{MAX_RETRIES} for {model}: {e}. Waiting {wait:.1f}s")
                time.sleep(wait)
            else:
                raise


def parse_json_response(raw_text):
    """Parse JSON from LLM response, handling markdown fences."""
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


def build_system_prompt(persona):
    """Build persona system prompt for interview."""
    return f"""You are role-playing as {persona['name']}, a real homeowner in Southern California being interviewed about your home and backyard needs.

PERSONA:
- Age bracket: {persona['age']}
- Household income: {persona['income']}
- Work arrangement: {persona['work_arrangement']}
- Home: {persona['home_situation']}
- Household: {persona['household']}
- Lifestyle: {persona['lifestyle_note']}
- HOA: {persona['hoa_status']}

INSTRUCTIONS:
1. Answer each interview question from the perspective of this persona.
2. Give 3-6 sentence answers that feel like natural spoken responses in a depth interview.
3. Express authentic emotions — excitement, frustration, hesitation, curiosity, etc.
4. Reference specific details from your persona (home type, family, hobbies) to ground your answers.
5. Be honest about concerns and tradeoffs, not uniformly positive or negative.
6. Return ONLY a single JSON object with the exact keys specified. No explanations, no markdown."""


def build_user_prompt():
    """Build the user prompt with interview questions and schema."""
    q_text = "\n".join(f"{k}. {v}" for k, v in INTERVIEW_QUESTIONS.items())
    return f"""You are being interviewed about your home, backyard, and potential interest in a backyard structure product. Answer each question thoughtfully as your persona.

--- INTERVIEW QUESTIONS ---
{q_text}

Finally, share any additional_thoughts you have about backyard living, home improvement, or this product concept.
--- END ---

Return a JSON object with exactly these keys:
{RESPONSE_SCHEMA}

IMPORTANT: Each value must be a string of 3-6 sentences. Return ONLY JSON, no other text."""


def validate_response(data):
    """Validate interview response — check keys present and minimum length."""
    for key in RESPONSE_KEYS:
        if key not in data or not isinstance(data[key], str) or len(data[key].strip()) == 0:
            data[key] = "[No response]"
        elif len(data[key].strip()) < 20:
            print(f"  Warning: {key} response is very short ({len(data[key])} chars)")
    return data


def generate_one(api_key, model_id, persona):
    """Generate one synthetic interview."""
    system_prompt = build_system_prompt(persona)
    user_prompt = build_user_prompt()

    raw = call_openrouter(api_key, model_id, system_prompt, user_prompt)
    parsed = parse_json_response(raw)
    validated = validate_response(parsed)

    model_label = MODEL_LABELS[model_id]
    row = {
        "interview_id": f"{persona['persona_id']}_{model_label}",
        "model": model_label,
        "persona_id": persona["persona_id"],
        "persona_name": persona["name"],
        "age": persona["age"],
        "income": persona["income"],
        "work_arrangement": persona["work_arrangement"],
        "home_situation": persona["home_situation"],
        "household": persona["household"],
        "lifestyle_note": persona["lifestyle_note"],
        "hoa_status": persona["hoa_status"],
    }
    for key in RESPONSE_KEYS:
        row[key] = validated[key]
    row["generation_timestamp"] = datetime.now(timezone.utc).isoformat()
    row["raw_json"] = json.dumps(validated, ensure_ascii=False)

    return row


def save_checkpoint(results, path):
    """Save intermediate results to checkpoint CSV."""
    if not results:
        return
    fieldnames = list(results[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)


def main():
    api_key = load_api_key()
    print(f"Loaded API key: ...{api_key[-6:]}")

    # Build task list
    tasks = []
    for model_id, personas in MODEL_ASSIGNMENTS.items():
        for persona in personas:
            tasks.append((model_id, persona))

    print(f"Generating {len(tasks)} synthetic interviews...")
    results = []
    checkpoint_path = OUTPUT_DIR / "interview_checkpoint.csv"

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_task = {}
        for model_id, persona in tasks:
            future = executor.submit(generate_one, api_key, model_id, persona)
            future_to_task[future] = (MODEL_LABELS[model_id], persona["persona_id"])

        for i, future in enumerate(as_completed(future_to_task), 1):
            label, pid = future_to_task[future]
            try:
                row = future.result()
                results.append(row)
                print(f"  [{i}/{len(tasks)}] {row['interview_id']} ({label}, {pid}) OK")
            except Exception as e:
                print(f"  [{i}/{len(tasks)}] FAILED ({label}, {pid}): {e}")

            if i % CHECKPOINT_INTERVAL == 0:
                save_checkpoint(results, checkpoint_path)
                print(f"  Checkpoint saved ({len(results)} rows)")

    # Sort by persona_id for consistent output
    results.sort(key=lambda r: r["persona_id"])

    output_path = OUTPUT_DIR / "interview_transcripts.csv"
    save_checkpoint(results, output_path)
    print(f"\nDone! {len(results)} interviews saved to {output_path}")

    from collections import Counter
    model_counts = Counter(r["model"] for r in results)
    print(f"\nBy model: {dict(model_counts)}")


if __name__ == "__main__":
    main()
