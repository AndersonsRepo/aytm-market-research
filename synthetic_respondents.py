"""Generate 60 synthetic survey respondents using GPT-4.1-mini and Gemini 2.5 Flash via OpenRouter."""

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

from segments import SEGMENTS, get_respondent_config

# --- Config ---
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODELS = {
    "openai/gpt-4.1-mini": "GPT-4.1-mini",
    "google/gemini-2.5-flash": "Gemini-2.5-Flash",
}
RESPONDENTS_PER_SEGMENT_PER_MODEL = 6  # 6 * 5 segments * 2 models = 60
MAX_WORKERS = 10
MAX_RETRIES = 3
CHECKPOINT_INTERVAL = 10

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
SURVEY_PATH = BASE_DIR / "Input" / "Neo Smart Living — Survey_HighMedPriority.md"

# --- Survey text (loaded once) ---
SURVEY_TEXT = SURVEY_PATH.read_text(encoding="utf-8")

# --- JSON schema for responses ---
RESPONSE_SCHEMA = """{
  "S3": "Yes | I'm not sure, but possibly",
  "Q0a": "Yes, I have actively researched or priced options | Yes, I have thought about it but not researched it | I'm aware it's possible but haven't seriously considered it | No, I have never considered this",
  "Q0b": "1-5 (integer, 1=Not at all interested, 5=Extremely interested)",
  "Q1": "1-5 (integer, 1=Not at all interested, 5=Extremely interested)",
  "Q2": "1-5 (integer, 1=Definitely would not, 5=Definitely would)",
  "Q3": "Home office / remote workspace | Guest suite / short-term rental (STR) income | Wellness studio (gym, yoga, meditation) | Adventure basecamp (gear storage, bike workshop, hangout space) | General storage / premium speed shed | Creative studio (music, podcast, art) | Children's playroom | Other",
  "Q5_cost": "1-5 (integer, 1=Would not reduce at all, 5=Would strongly reduce)",
  "Q5_hoa": "1-5",
  "Q5_permit": "1-5",
  "Q5_space": "1-5",
  "Q5_financing": "1-5",
  "Q5_quality": "1-5",
  "Q5_resale": "1-5",
  "Q6": "The total cost (~$23,000) | HOA restrictions or community rules | Uncertainty about whether a building permit is required | Limited backyard space or access | Lack of financing options | Concerns about build quality or durability | Uncertainty about resale value | None — I have no significant concerns",
  "Q7": "1-5 (integer, 1=Decreases my likelihood, 5=Greatly increases my likelihood)",
  "Q9a": "1-5", "Q9b": "1-5",
  "Q10a": "1-5", "Q10b": "1-5",
  "Q11a": "1-5", "Q11b": "1-5",
  "Q12a": "1-5", "Q12b": "1-5",
  "Q13a": "1-5", "Q13b": "1-5",
  "Q14": "Concept 1: Backyard Home Office | Concept 2: Guest Suite / STR Income | Concept 3: Wellness / Studio Space | Concept 4: Adventure Lifestyle / Community | Concept 5: Message-First | None of the above",
  "Q15": "1-5", "Q16": "1-5", "Q17": "1-5",
  "Q18": "Permit-light positioning | Installation speed | Build quality and details",
  "Q19": "1-5 (integer, 1=Decrease a lot, 5=Increase a lot)",
  "Q20": ["list of 1-2 from: Outdoor club sponsorships / community events, Social media ads (Facebook, Instagram), Google / Search ads, Home improvement expos, Real estate partner referrals, Friend / family referral"],
  "Q21": "age bracket string",
  "Q22": "income bracket string",
  "Q23": "work arrangement string",
  "Q24": "Yes | No | I'm not sure",
  "Q25": "Never | A few times a year | About once a month | 2-3 times per month | Weekly or more",
  "Q26": "Yes | No",
  "Q30": "3 (ALWAYS answer 3 for the attention check)"
}"""


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


def build_system_prompt(config):
    """Build persona system prompt from respondent config."""
    demo = config["demographics"]
    return f"""You are role-playing as a synthetic survey respondent named {config['name']}.

PERSONA:
- Segment: {config['segment_name']}
- Age: {demo['Q21']}
- Household income: {demo['Q22']}
- Work arrangement: {demo['Q23']}
- HOA status: {demo['Q24']}
- Outdoor recreation: {demo['Q25']}
- Outdoor club member: {demo['Q26']}

PSYCHOGRAPHIC PROFILE:
{config['psychographic']}

PERSONALITY VARIATION:
{config['variation']}

INSTRUCTIONS:
1. Answer every survey question from the perspective of this persona.
2. Your demographic answers (Q21-Q26) MUST match the persona demographics above exactly.
3. For Q30 (attention check), you MUST answer 3 (Moderately interested).
4. For all other questions, answer authentically as this persona would — vary your responses naturally, do not always pick the midpoint or extreme.
5. Return ONLY a single JSON object with the exact keys specified. No explanations, no markdown."""


def build_user_prompt():
    """Build the user prompt containing the survey and schema."""
    return f"""Complete the following survey as the persona described. Return ONLY a valid JSON object.

--- SURVEY START ---
{SURVEY_TEXT}
--- SURVEY END ---

Return a JSON object with exactly these keys and valid values:
{RESPONSE_SCHEMA}

IMPORTANT: Q20 must be a JSON array of 1-2 strings. All Likert-scale questions must be integers 1-5. Q30 must be 3. Return ONLY JSON, no other text."""


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
        "max_tokens": 2000,
    }
    # GPT supports response_format; Gemini does not
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
    # Try direct parse
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass
    # Strip markdown fences
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", raw_text.strip())
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Regex extract first {...}
    match = re.search(r"\{[\s\S]*\}", raw_text)
    if match:
        return json.loads(match.group())
    raise ValueError(f"Could not parse JSON from response: {raw_text[:200]}")


LIKERT_KEYS = [
    "Q0b", "Q1", "Q2", "Q5_cost", "Q5_hoa", "Q5_permit", "Q5_space",
    "Q5_financing", "Q5_quality", "Q5_resale", "Q7",
    "Q9a", "Q9b", "Q10a", "Q10b", "Q11a", "Q11b", "Q12a", "Q12b",
    "Q13a", "Q13b", "Q15", "Q16", "Q17", "Q19", "Q30",
]


def validate_response(data, config):
    """Validate and fix response values. Returns cleaned dict."""
    # Clamp Likert values
    for key in LIKERT_KEYS:
        if key in data:
            try:
                val = int(data[key])
                data[key] = max(1, min(5, val))
            except (ValueError, TypeError):
                data[key] = 3  # default to midpoint

    # Force Q30 attention check
    data["Q30"] = 3

    # Force demographics to match persona
    demo = config["demographics"]
    data["Q21"] = demo["Q21"]
    data["Q22"] = demo["Q22"]
    data["Q23"] = demo["Q23"]
    data["Q24"] = demo["Q24"]
    data["Q25"] = demo["Q25"]
    data["Q26"] = demo["Q26"]

    # Ensure Q20 is a list
    if isinstance(data.get("Q20"), str):
        data["Q20"] = [data["Q20"]]
    elif not isinstance(data.get("Q20"), list):
        data["Q20"] = ["Social media ads (Facebook, Instagram)"]

    return data


def generate_one(api_key, model_id, model_label, segment, resp_index):
    """Generate a single synthetic respondent."""
    config = get_respondent_config(segment, resp_index, model_id)
    system_prompt = build_system_prompt(config)
    user_prompt = build_user_prompt()

    raw = call_openrouter(api_key, model_id, system_prompt, user_prompt)
    parsed = parse_json_response(raw)
    validated = validate_response(parsed, config)

    # Build flat row
    row = {
        "respondent_id": f"S{segment['id']}_{model_label}_{resp_index + 1}",
        "model": model_label,
        "segment_id": segment["id"],
        "segment_name": segment["name"],
    }

    # Survey fields
    survey_keys = [
        "S3", "Q0a", "Q0b", "Q1", "Q2", "Q3",
        "Q5_cost", "Q5_hoa", "Q5_permit", "Q5_space", "Q5_financing", "Q5_quality", "Q5_resale",
        "Q6", "Q7",
        "Q9a", "Q9b", "Q10a", "Q10b", "Q11a", "Q11b", "Q12a", "Q12b", "Q13a", "Q13b",
        "Q14", "Q15", "Q16", "Q17", "Q18", "Q19",
        "Q21", "Q22", "Q23", "Q24", "Q25", "Q26", "Q30",
    ]
    for key in survey_keys:
        row[key] = validated.get(key, "")

    # Q20 split into Q20_1 and Q20_2
    q20_list = validated.get("Q20", [])
    row["Q20_1"] = q20_list[0] if len(q20_list) > 0 else ""
    row["Q20_2"] = q20_list[1] if len(q20_list) > 1 else ""

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

    user_prompt = build_user_prompt()  # shared across all calls

    # Build task list: (model_id, model_label, segment, respondent_index)
    tasks = []
    for model_id, model_label in MODELS.items():
        for segment in SEGMENTS:
            for i in range(RESPONDENTS_PER_SEGMENT_PER_MODEL):
                tasks.append((model_id, model_label, segment, i))

    print(f"Generating {len(tasks)} synthetic respondents...")
    results = []
    checkpoint_path = OUTPUT_DIR / "checkpoint.csv"

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_task = {}
        for model_id, model_label, segment, idx in tasks:
            future = executor.submit(
                generate_one, api_key, model_id, model_label, segment, idx
            )
            future_to_task[future] = (model_label, segment["name"], idx)

        for i, future in enumerate(as_completed(future_to_task), 1):
            label, seg_name, idx = future_to_task[future]
            try:
                row = future.result()
                results.append(row)
                print(f"  [{i}/{len(tasks)}] {row['respondent_id']} ({label}, {seg_name}) OK")
            except Exception as e:
                print(f"  [{i}/{len(tasks)}] FAILED ({label}, {seg_name}, #{idx}): {e}")

            if i % CHECKPOINT_INTERVAL == 0:
                save_checkpoint(results, checkpoint_path)
                print(f"  Checkpoint saved ({len(results)} rows)")

    # Save final output
    output_path = OUTPUT_DIR / "synthetic_responses.csv"
    save_checkpoint(results, output_path)
    print(f"\nDone! {len(results)} respondents saved to {output_path}")

    # Summary
    from collections import Counter
    model_counts = Counter(r["model"] for r in results)
    segment_counts = Counter(r["segment_name"] for r in results)
    q30_pass = sum(1 for r in results if r.get("Q30") == 3)
    print(f"\nBy model: {dict(model_counts)}")
    print(f"By segment: {dict(segment_counts)}")
    print(f"Q30 attention check pass: {q30_pass}/{len(results)}")


if __name__ == "__main__":
    main()
