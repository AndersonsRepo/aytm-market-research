"""Multi-turn synthetic depth interviews with adaptive follow-up probing.

Unlike the single-turn approach (synthetic_interviews.py) which batch-asks all 8 questions,
this engine conducts interviews as real conversations:
  1. Ask core question → get persona response
  2. Analyze response → generate contextual follow-up probe
  3. Get follow-up response → move to next question

This produces richer, more realistic qualitative data with ~16 turns per interview
(8 core questions + 8 adaptive follow-ups).

Output format: Same CSV as synthetic_interviews.py with additional columns:
  IQ1_followup_question, IQ1_followup_response, IQ2_followup_question, ...
"""

import json
import os
import re
import time
import random
import csv
from datetime import datetime, timezone
from pathlib import Path

import requests

from interview_personas import INTERVIEW_PERSONAS, MODEL_ASSIGNMENTS, MODEL_LABELS

# --- Config ---
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_RETRIES = 3
CHECKPOINT_INTERVAL = 5

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

# Interviewer system prompt for generating follow-up probes
INTERVIEWER_SYSTEM = """You are an expert qualitative market researcher conducting a depth interview about backyard living and home space needs. You are interviewing a Southern California homeowner about their interest in a prefabricated backyard structure.

Your job: Given the respondent's answer to a question, generate ONE targeted follow-up probe that:
1. Digs deeper into something specific they mentioned (a concern, emotion, experience, or detail)
2. Uses their own words/phrases to show you're listening
3. Explores the "why" behind their surface-level answer
4. Feels natural and conversational, not scripted

Good follow-ups:
- "You mentioned [specific thing] — can you tell me more about that?"
- "That's interesting — what made you feel [emotion they expressed]?"
- "You said [quote]. Has that always been the case, or is this a recent thing?"
- "I noticed you didn't mention [relevant topic]. Is that not a factor for you?"

Bad follow-ups (avoid):
- Generic ("Can you elaborate?")
- Leading ("So you'd definitely buy this, right?")
- Multiple questions in one
- Repeating the original question

Return ONLY the follow-up question as plain text. No JSON, no quotes, no preamble."""


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


def call_openrouter(api_key, model, messages, temperature=0.8, max_tokens=1500, json_mode=False):
    """Call OpenRouter API with retry logic. Accepts full message list for multi-turn."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    data = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode and (model.startswith("openai/") or model.startswith("anthropic/")):
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
                print(f"    Retry {attempt + 1}/{MAX_RETRIES}: {e}. Waiting {wait:.1f}s")
                time.sleep(wait)
            else:
                raise


def build_persona_system(persona):
    """Build persona system prompt for the respondent role."""
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
1. Answer each question from the perspective of this persona.
2. Give 3-6 sentence answers that feel like natural spoken responses in a depth interview.
3. Express authentic emotions — excitement, frustration, hesitation, curiosity, etc.
4. Reference specific details from your persona (home type, family, hobbies) to ground your answers.
5. Be honest about concerns and tradeoffs, not uniformly positive or negative.
6. When the interviewer asks a follow-up, respond specifically to what they asked — don't repeat your previous answer.
7. Return ONLY your answer as plain text. No JSON, no formatting."""


def generate_followup_question(api_key, model, question_id, core_question, response):
    """Use LLM-as-interviewer to generate an adaptive follow-up probe."""
    messages = [
        {"role": "system", "content": INTERVIEWER_SYSTEM},
        {"role": "user", "content": f"The respondent was asked: \"{core_question}\"\n\nTheir response: \"{response}\"\n\nGenerate one follow-up probe:"},
    ]
    followup = call_openrouter(api_key, model, messages, temperature=0.7, max_tokens=200)
    # Clean up — remove quotes, trailing punctuation artifacts
    followup = followup.strip().strip('"').strip("'")
    return followup


def conduct_interview(api_key, model_id, persona):
    """Conduct a full multi-turn interview with one persona.

    Flow per question:
      1. Interviewer asks core question
      2. Persona responds (3-6 sentences)
      3. Interviewer generates adaptive follow-up
      4. Persona responds to follow-up (2-4 sentences)
    """
    persona_system = build_persona_system(persona)
    model_label = MODEL_LABELS[model_id]

    # Build conversation history as we go
    conversation = [{"role": "system", "content": persona_system}]
    results = {}

    for q_id, question in INTERVIEW_QUESTIONS.items():
        # Step 1: Ask core question
        conversation.append({"role": "user", "content": question})
        core_response = call_openrouter(api_key, model_id, conversation, temperature=0.8, max_tokens=800)
        core_response = core_response.strip()
        conversation.append({"role": "assistant", "content": core_response})
        results[q_id] = core_response

        # Step 2: Generate adaptive follow-up (using a separate interviewer call)
        try:
            followup_q = generate_followup_question(api_key, model_id, q_id, question, core_response)
        except Exception as e:
            print(f"    Warning: Follow-up generation failed for {q_id}: {e}")
            followup_q = "Can you tell me more about that?"

        # Step 3: Ask follow-up and get response
        conversation.append({"role": "user", "content": followup_q})
        try:
            followup_response = call_openrouter(api_key, model_id, conversation, temperature=0.8, max_tokens=600)
            followup_response = followup_response.strip()
        except Exception as e:
            print(f"    Warning: Follow-up response failed for {q_id}: {e}")
            followup_response = "[No follow-up response]"

        conversation.append({"role": "assistant", "content": followup_response})
        results[f"{q_id}_followup_question"] = followup_q
        results[f"{q_id}_followup_response"] = followup_response

    # Final: additional thoughts
    closing = "We're wrapping up. Any additional thoughts about backyard living, home improvement, or this product concept that we haven't covered?"
    conversation.append({"role": "user", "content": closing})
    additional = call_openrouter(api_key, model_id, conversation, temperature=0.8, max_tokens=600)
    results["additional_thoughts"] = additional.strip()

    # Build output row
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
        "interview_mode": "multi_turn",
        "num_turns": len(conversation) - 1,  # exclude system
    }
    # Add all Q&A pairs
    for key in INTERVIEW_QUESTIONS:
        row[key] = results.get(key, "[No response]")
        row[f"{key}_followup_question"] = results.get(f"{key}_followup_question", "")
        row[f"{key}_followup_response"] = results.get(f"{key}_followup_response", "")
    row["additional_thoughts"] = results.get("additional_thoughts", "")
    row["generation_timestamp"] = datetime.now(timezone.utc).isoformat()
    row["conversation_json"] = json.dumps(conversation[1:], ensure_ascii=False)  # exclude system

    return row


def get_fieldnames():
    """Return ordered fieldnames for the multi-turn CSV."""
    fields = [
        "interview_id", "model", "persona_id", "persona_name",
        "age", "income", "work_arrangement", "home_situation",
        "household", "lifestyle_note", "hoa_status",
        "interview_mode", "num_turns",
    ]
    for key in INTERVIEW_QUESTIONS:
        fields.extend([key, f"{key}_followup_question", f"{key}_followup_response"])
    fields.extend(["additional_thoughts", "generation_timestamp", "conversation_json"])
    return fields


def save_results(results, path):
    """Save results to CSV."""
    if not results:
        return
    fieldnames = get_fieldnames()
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

    print(f"\nConducting {len(tasks)} multi-turn interviews (8 core + 8 follow-up questions each)...")
    print(f"Estimated API calls: ~{len(tasks) * 17} (sequential per interview)\n")

    results = []
    checkpoint_path = OUTPUT_DIR / "multiturn_checkpoint.csv"

    for i, (model_id, persona) in enumerate(tasks, 1):
        label = MODEL_LABELS[model_id]
        pid = persona["persona_id"]
        print(f"  [{i}/{len(tasks)}] {pid} ({label}, {persona['name']})...")

        try:
            row = conduct_interview(api_key, model_id, persona)
            results.append(row)
            print(f"    OK — {row['num_turns']} turns")
        except Exception as e:
            print(f"    FAILED: {e}")

        if i % CHECKPOINT_INTERVAL == 0:
            save_results(results, checkpoint_path)
            print(f"    Checkpoint saved ({len(results)} rows)")

        # Small delay between interviews to avoid rate limits
        if i < len(tasks):
            time.sleep(1)

    # Sort by persona_id
    results.sort(key=lambda r: r["persona_id"])

    output_path = OUTPUT_DIR / "interview_transcripts.csv"
    save_results(results, output_path)
    print(f"\nDone! {len(results)} multi-turn interviews saved to {output_path}")

    from collections import Counter
    model_counts = Counter(r["model"] for r in results)
    print(f"By model: {dict(model_counts)}")
    avg_turns = sum(r["num_turns"] for r in results) / len(results) if results else 0
    print(f"Average turns per interview: {avg_turns:.1f}")


if __name__ == "__main__":
    main()
