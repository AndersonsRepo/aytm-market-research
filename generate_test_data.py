"""Generate realistic test data for dashboard verification without API calls."""

import csv
import json
import random
from datetime import datetime, timezone
from pathlib import Path

from segments import SEGMENTS, get_respondent_config

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

MODELS = {
    "openai/gpt-4.1-mini": "GPT-4.1-mini",
    "google/gemini-2.5-flash": "Gemini-2.5-Flash",
}

# Segment-specific response profiles: (mean, spread) for Likert items
# Tuned so each segment behaves realistically
SEGMENT_PROFILES = {
    1: {  # Remote Professional — high office appeal, moderate overall
        "Q0a": ["Yes, I have thought about it but not researched it", "I'm aware it's possible but haven't seriously considered it"],
        "Q0b": (3.8, 0.8), "Q1": (3.9, 0.7), "Q2": (3.3, 0.9),
        "Q3": ["Home office / remote workspace"] * 5 + ["Creative studio (music, podcast, art)"],
        "Q5_cost": (2.5, 0.9), "Q5_hoa": (3.2, 1.0), "Q5_permit": (2.8, 0.9),
        "Q5_space": (2.2, 0.8), "Q5_financing": (2.0, 0.7), "Q5_quality": (2.4, 0.8), "Q5_resale": (2.6, 0.9),
        "Q6": ["HOA restrictions or community rules"] * 3 + ["The total cost (~$23,000)"] * 2 + ["Uncertainty about whether a building permit is required"],
        "Q7": (4.0, 0.7),
        "Q9a": (4.3, 0.6), "Q9b": (3.8, 0.7),   # Home Office — high
        "Q10a": (2.8, 0.9), "Q10b": (2.4, 0.8),  # Guest Suite — lower
        "Q11a": (3.0, 0.8), "Q11b": (2.6, 0.9),  # Wellness — moderate
        "Q12a": (2.2, 0.8), "Q12b": (1.9, 0.7),  # Adventure — low
        "Q13a": (3.8, 0.7), "Q13b": (3.4, 0.8),  # Simplicity — high
        "Q14": ["Concept 1: Backyard Home Office"] * 4 + ["Concept 5: Message-First"] * 2,
        "Q15": (3.9, 0.7), "Q16": (3.5, 0.8), "Q17": (3.8, 0.7),
        "Q18": ["Permit-light positioning"] * 3 + ["Build quality and details"] * 2 + ["Installation speed"],
        "Q19": (2.8, 0.8),
        "Q20": [
            ["Social media ads (Facebook, Instagram)", "Google / Search ads"],
            ["Google / Search ads", "Friend / family referral"],
            ["Social media ads (Facebook, Instagram)", "Home improvement expos"],
            ["Google / Search ads"],
            ["Friend / family referral", "Social media ads (Facebook, Instagram)"],
            ["Home improvement expos", "Google / Search ads"],
        ],
    },
    2: {  # Active Adventurer — high adventure appeal, sponsorship positive
        "Q0a": ["I'm aware it's possible but haven't seriously considered it", "No, I have never considered this", "Yes, I have thought about it but not researched it"],
        "Q0b": (3.2, 0.9), "Q1": (3.4, 0.8), "Q2": (2.8, 0.9),
        "Q3": ["Adventure basecamp (gear storage, bike workshop, hangout space)"] * 4 + ["General storage / premium speed shed", "Creative studio (music, podcast, art)"],
        "Q5_cost": (3.5, 0.8), "Q5_hoa": (2.5, 0.9), "Q5_permit": (2.3, 0.8),
        "Q5_space": (2.8, 0.9), "Q5_financing": (3.2, 0.8), "Q5_quality": (2.6, 0.8), "Q5_resale": (2.4, 0.9),
        "Q6": ["The total cost (~$23,000)"] * 3 + ["Lack of financing options"] * 2 + ["Limited backyard space or access"],
        "Q7": (3.6, 0.8),
        "Q9a": (2.5, 0.8), "Q9b": (2.2, 0.8),
        "Q10a": (2.3, 0.9), "Q10b": (2.0, 0.8),
        "Q11a": (2.8, 0.8), "Q11b": (2.4, 0.8),
        "Q12a": (4.4, 0.5), "Q12b": (3.9, 0.7),  # Adventure — very high
        "Q13a": (3.2, 0.8), "Q13b": (2.8, 0.9),
        "Q14": ["Concept 4: Adventure Lifestyle / Community"] * 5 + ["Concept 3: Wellness / Studio Space"],
        "Q15": (3.2, 0.8), "Q16": (3.6, 0.7), "Q17": (3.4, 0.8),
        "Q18": ["Installation speed"] * 3 + ["Build quality and details"] * 2 + ["Permit-light positioning"],
        "Q19": (4.2, 0.6),  # High sponsorship interest
        "Q20": [
            ["Outdoor club sponsorships / community events", "Social media ads (Facebook, Instagram)"],
            ["Outdoor club sponsorships / community events", "Friend / family referral"],
            ["Social media ads (Facebook, Instagram)", "Outdoor club sponsorships / community events"],
            ["Outdoor club sponsorships / community events"],
            ["Friend / family referral", "Outdoor club sponsorships / community events"],
            ["Social media ads (Facebook, Instagram)", "Friend / family referral"],
        ],
    },
    3: {  # Wellness Seeker — high wellness appeal
        "Q0a": ["Yes, I have thought about it but not researched it", "I'm aware it's possible but haven't seriously considered it"],
        "Q0b": (3.6, 0.8), "Q1": (3.7, 0.7), "Q2": (3.1, 0.9),
        "Q3": ["Wellness studio (gym, yoga, meditation)"] * 4 + ["Creative studio (music, podcast, art)", "Home office / remote workspace"],
        "Q5_cost": (2.8, 0.8), "Q5_hoa": (3.0, 0.9), "Q5_permit": (2.6, 0.8),
        "Q5_space": (2.5, 0.8), "Q5_financing": (2.3, 0.7), "Q5_quality": (2.8, 0.8), "Q5_resale": (2.5, 0.8),
        "Q6": ["HOA restrictions or community rules"] * 2 + ["The total cost (~$23,000)"] * 2 + ["Concerns about build quality or durability", "None — I have no significant concerns"],
        "Q7": (3.8, 0.7),
        "Q9a": (3.2, 0.8), "Q9b": (2.8, 0.8),
        "Q10a": (2.6, 0.9), "Q10b": (2.3, 0.8),
        "Q11a": (4.5, 0.5), "Q11b": (4.0, 0.6),  # Wellness — very high
        "Q12a": (2.6, 0.8), "Q12b": (2.2, 0.8),
        "Q13a": (3.5, 0.7), "Q13b": (3.1, 0.8),
        "Q14": ["Concept 3: Wellness / Studio Space"] * 4 + ["Concept 1: Backyard Home Office", "Concept 5: Message-First"],
        "Q15": (3.6, 0.7), "Q16": (3.3, 0.8), "Q17": (4.0, 0.6),
        "Q18": ["Build quality and details"] * 4 + ["Permit-light positioning", "Installation speed"],
        "Q19": (3.2, 0.8),
        "Q20": [
            ["Social media ads (Facebook, Instagram)", "Friend / family referral"],
            ["Home improvement expos", "Social media ads (Facebook, Instagram)"],
            ["Friend / family referral", "Social media ads (Facebook, Instagram)"],
            ["Social media ads (Facebook, Instagram)"],
            ["Google / Search ads", "Friend / family referral"],
            ["Home improvement expos", "Friend / family referral"],
        ],
    },
    4: {  # Property Maximizer — high guest suite, ROI focus
        "Q0a": ["Yes, I have actively researched or priced options", "Yes, I have thought about it but not researched it"],
        "Q0b": (4.0, 0.7), "Q1": (4.1, 0.6), "Q2": (3.6, 0.8),
        "Q3": ["Guest suite / short-term rental (STR) income"] * 5 + ["Home office / remote workspace"],
        "Q5_cost": (1.8, 0.7), "Q5_hoa": (3.8, 0.7), "Q5_permit": (3.5, 0.8),
        "Q5_space": (1.6, 0.6), "Q5_financing": (1.5, 0.5), "Q5_quality": (3.0, 0.8), "Q5_resale": (3.4, 0.8),
        "Q6": ["HOA restrictions or community rules"] * 3 + ["Uncertainty about whether a building permit is required"] * 2 + ["Uncertainty about resale value"],
        "Q7": (4.2, 0.6),
        "Q9a": (3.0, 0.8), "Q9b": (2.6, 0.8),
        "Q10a": (4.4, 0.5), "Q10b": (4.0, 0.6),  # Guest Suite — very high
        "Q11a": (2.4, 0.8), "Q11b": (2.0, 0.7),
        "Q12a": (1.8, 0.7), "Q12b": (1.5, 0.5),
        "Q13a": (3.6, 0.7), "Q13b": (3.2, 0.8),
        "Q14": ["Concept 2: Guest Suite / STR Income"] * 5 + ["Concept 5: Message-First"],
        "Q15": (4.0, 0.6), "Q16": (3.8, 0.7), "Q17": (4.2, 0.5),
        "Q18": ["Build quality and details"] * 3 + ["Permit-light positioning"] * 2 + ["Installation speed"],
        "Q19": (2.4, 0.8),
        "Q20": [
            ["Real estate partner referrals", "Home improvement expos"],
            ["Google / Search ads", "Real estate partner referrals"],
            ["Home improvement expos", "Real estate partner referrals"],
            ["Real estate partner referrals"],
            ["Home improvement expos", "Google / Search ads"],
            ["Real estate partner referrals", "Friend / family referral"],
        ],
    },
    5: {  # Budget-Conscious DIYer — cost-sensitive, practical
        "Q0a": ["I'm aware it's possible but haven't seriously considered it", "No, I have never considered this"],
        "Q0b": (2.8, 0.9), "Q1": (2.6, 0.9), "Q2": (2.1, 0.8),
        "Q3": ["General storage / premium speed shed"] * 3 + ["Creative studio (music, podcast, art)"] * 2 + ["Children's playroom"],
        "Q5_cost": (4.3, 0.6), "Q5_hoa": (2.4, 0.9), "Q5_permit": (2.8, 0.8),
        "Q5_space": (3.0, 0.9), "Q5_financing": (4.0, 0.7), "Q5_quality": (3.2, 0.8), "Q5_resale": (3.0, 0.9),
        "Q6": ["The total cost (~$23,000)"] * 3 + ["Lack of financing options"] * 2 + ["Limited backyard space or access"],
        "Q7": (3.8, 0.7),
        "Q9a": (2.6, 0.8), "Q9b": (2.2, 0.8),
        "Q10a": (2.2, 0.8), "Q10b": (1.8, 0.7),
        "Q11a": (2.4, 0.8), "Q11b": (2.0, 0.7),
        "Q12a": (2.2, 0.8), "Q12b": (1.8, 0.7),
        "Q13a": (4.0, 0.6), "Q13b": (3.5, 0.8),  # Simplicity — high (cost/hassle matters)
        "Q14": ["Concept 5: Message-First"] * 4 + ["Concept 1: Backyard Home Office", "None of the above"],
        "Q15": (4.2, 0.6), "Q16": (3.8, 0.7), "Q17": (3.0, 0.8),
        "Q18": ["Permit-light positioning"] * 4 + ["Installation speed"] * 2,
        "Q19": (2.6, 0.9),
        "Q20": [
            ["Google / Search ads", "Social media ads (Facebook, Instagram)"],
            ["Social media ads (Facebook, Instagram)", "Friend / family referral"],
            ["Google / Search ads"],
            ["Friend / family referral", "Google / Search ads"],
            ["Social media ads (Facebook, Instagram)"],
            ["Home improvement expos", "Google / Search ads"],
        ],
    },
}

# Slight model-level bias: GPT tends slightly more positive, Gemini slightly more varied
MODEL_BIAS = {
    "GPT-4.1-mini": 0.15,
    "Gemini-2.5-Flash": -0.10,
}

S3_OPTIONS = ["Yes", "I'm not sure, but possibly"]


def likert(mean, spread, rng, model_label):
    """Sample a Likert 1-5 value with model bias."""
    val = rng.gauss(mean + MODEL_BIAS.get(model_label, 0), spread)
    return max(1, min(5, round(val)))


def pick(options, rng):
    """Pick from a list of options."""
    return rng.choice(options)


def generate_test_row(segment, resp_index, model_id, model_label):
    """Generate one test respondent row."""
    rng = random.Random(hash((segment["id"], resp_index, model_id, "test")))
    config = get_respondent_config(segment, resp_index, model_id)
    profile = SEGMENT_PROFILES[segment["id"]]
    demo = config["demographics"]

    data = {}

    # S3 — mostly Yes for valid respondents
    data["S3"] = rng.choices(S3_OPTIONS, weights=[0.8, 0.2])[0]

    # Q0a
    data["Q0a"] = pick(profile["Q0a"], rng)

    # Likert questions
    for key in ["Q0b", "Q1", "Q2", "Q5_cost", "Q5_hoa", "Q5_permit", "Q5_space",
                 "Q5_financing", "Q5_quality", "Q5_resale", "Q7",
                 "Q9a", "Q9b", "Q10a", "Q10b", "Q11a", "Q11b",
                 "Q12a", "Q12b", "Q13a", "Q13b", "Q15", "Q16", "Q17", "Q19"]:
        mean, spread = profile[key]
        data[key] = likert(mean, spread, rng, model_label)

    # Categorical single-choice
    for key in ["Q3", "Q6", "Q14", "Q18"]:
        data[key] = pick(profile[key], rng)

    # Q20 — pick from pre-defined channel combos
    q20_options = profile["Q20"]
    q20 = pick(q20_options, rng)

    # Demographics — forced from persona config
    data["Q21"] = demo["Q21"]
    data["Q22"] = demo["Q22"]
    data["Q23"] = demo["Q23"]
    data["Q24"] = demo["Q24"]
    data["Q25"] = demo["Q25"]
    data["Q26"] = demo["Q26"]

    # Q30 attention check
    data["Q30"] = 3

    # Build CSV row
    row = {
        "respondent_id": f"S{segment['id']}_{model_label}_{resp_index + 1}",
        "model": model_label,
        "segment_id": segment["id"],
        "segment_name": segment["name"],
    }

    survey_keys = [
        "S3", "Q0a", "Q0b", "Q1", "Q2", "Q3",
        "Q5_cost", "Q5_hoa", "Q5_permit", "Q5_space", "Q5_financing", "Q5_quality", "Q5_resale",
        "Q6", "Q7",
        "Q9a", "Q9b", "Q10a", "Q10b", "Q11a", "Q11b", "Q12a", "Q12b", "Q13a", "Q13b",
        "Q14", "Q15", "Q16", "Q17", "Q18", "Q19",
        "Q21", "Q22", "Q23", "Q24", "Q25", "Q26", "Q30",
    ]
    for key in survey_keys:
        row[key] = data.get(key, "")

    row["Q20_1"] = q20[0] if len(q20) > 0 else ""
    row["Q20_2"] = q20[1] if len(q20) > 1 else ""
    row["generation_timestamp"] = datetime(2026, 3, 8, 12, 0, 0, tzinfo=timezone.utc).isoformat()
    row["raw_json"] = json.dumps(data, ensure_ascii=False)

    return row


def main():
    rows = []
    for model_id, model_label in MODELS.items():
        for segment in SEGMENTS:
            for i in range(6):
                row = generate_test_row(segment, i, model_id, model_label)
                rows.append(row)

    output_path = OUTPUT_DIR / "synthetic_responses.csv"
    fieldnames = list(rows[0].keys())
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} test respondents -> {output_path}")

    # Quick stats
    import pandas as pd
    df = pd.DataFrame(rows)
    print(f"\nBy model:\n{df['model'].value_counts().to_string()}")
    print(f"\nBy segment:\n{df['segment_name'].value_counts().to_string()}")
    print(f"\nQ30 attention check = 3: {(df['Q30'] == 3).sum()}/{len(df)}")
    print(f"\nQ1 mean by segment:\n{df.groupby('segment_name')['Q1'].mean().round(2).to_string()}")
    print(f"\nQ1 mean by model:\n{df.groupby('model')['Q1'].mean().round(2).to_string()}")


if __name__ == "__main__":
    main()
