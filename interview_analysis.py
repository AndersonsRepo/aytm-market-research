"""Three-layer analysis pipeline for synthetic interview transcripts.

Layers:
1. Sentiment analysis (NLTK VADER — no API calls)
2. Thematic analysis (gensim LDA + 1 LLM API call)
3. Emotional tone assessment (30 LLM API calls, parallel)

Reads: output/interview_transcripts.csv
Writes: output/interview_analysis.csv, output/interview_themes.json
"""

import json
import os
import re
import time
import random
import csv
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pandas as pd
import numpy as np
import requests
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer
from gensim import corpora, models
from gensim.models import CoherenceModel

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_WORKERS = 10
MAX_RETRIES = 3

QUESTION_KEYS = ["IQ1", "IQ2", "IQ3", "IQ4", "IQ5", "IQ6", "IQ7", "IQ8"]
EMOTION_TAXONOMY = ["excitement", "skepticism", "anxiety", "curiosity", "indifference", "aspiration", "frustration", "pragmatism"]


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


def call_openrouter(api_key, model, system_prompt, user_prompt, temperature=0.3, max_tokens=2000):
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
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if model.startswith("openai/"):
        data["response_format"] = {"type": "json_object"}

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(OPENROUTER_URL, headers=headers, json=data, timeout=120)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait = min(65, (2 ** attempt) + random.uniform(0, 1))
                print(f"  Retry {attempt + 1}/{MAX_RETRIES}: {e}. Waiting {wait:.1f}s")
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


# --- Layer 1: VADER Sentiment ---

def run_sentiment(df):
    """Add VADER sentiment scores per question and overall."""
    sia = SentimentIntensityAnalyzer()

    for q in QUESTION_KEYS:
        df[f"sentiment_{q}"] = df[q].apply(
            lambda text: sia.polarity_scores(str(text))["compound"] if pd.notna(text) else 0.0
        )

    sentiment_cols = [f"sentiment_{q}" for q in QUESTION_KEYS]
    df["sentiment_overall"] = df[sentiment_cols].mean(axis=1).round(4)
    df["sentiment_label"] = df["sentiment_overall"].apply(
        lambda x: "Positive" if x > 0.05 else ("Negative" if x < -0.05 else "Neutral")
    )
    print(f"  Sentiment: {df['sentiment_label'].value_counts().to_dict()}")
    return df


# --- Layer 2: LDA + LLM Themes ---

def run_lda(df):
    """Train LDA on interview transcripts, return topics dict."""
    stemmer = PorterStemmer()
    stop_words = set(stopwords.words("english"))
    extra_stops = {"would", "could", "also", "like", "really", "think", "want", "need", "get", "one", "much", "even", "well", "lot"}
    stop_words.update(extra_stops)

    # Concatenate all answers per respondent
    docs = []
    for _, row in df.iterrows():
        text = " ".join(str(row[q]) for q in QUESTION_KEYS if pd.notna(row[q]))
        tokens = word_tokenize(text.lower())
        tokens = [stemmer.stem(t) for t in tokens if t.isalpha() and t not in stop_words and len(t) > 2]
        docs.append(tokens)

    dictionary = corpora.Dictionary(docs)
    dictionary.filter_extremes(no_below=2, no_above=0.8)
    corpus = [dictionary.doc2bow(doc) for doc in docs]

    # Select best k by coherence
    best_k, best_coherence, best_model = 5, -1, None
    for k in range(5, 9):
        lda = models.LdaModel(corpus, num_topics=k, id2word=dictionary, passes=15, random_state=42)
        cm = CoherenceModel(model=lda, texts=docs, dictionary=dictionary, coherence="c_v")
        c = cm.get_coherence()
        if c > best_coherence:
            best_k, best_coherence, best_model = k, c, lda

    print(f"  LDA: best k={best_k}, coherence={best_coherence:.3f}")

    topics = []
    for i in range(best_k):
        keywords = [word for word, _ in best_model.show_topic(i, topn=10)]
        topics.append({"topic_id": i, "label": f"Topic {i}", "keywords": keywords})

    # Assign dominant topic per respondent
    dominant_topics = []
    for bow in corpus:
        topic_dist = best_model.get_document_topics(bow, minimum_probability=0)
        dominant = max(topic_dist, key=lambda x: x[1])
        dominant_topics.append(dominant[0])
    df["lda_dominant_topic"] = dominant_topics

    return {
        "num_topics": best_k,
        "coherence_score": round(best_coherence, 4),
        "topics": topics,
    }


def run_llm_themes(api_key, df):
    """Extract themes from all transcripts with a single LLM call."""
    # Build transcript summaries
    transcript_block = ""
    for _, row in df.iterrows():
        transcript_block += f"\n--- {row['persona_id']} ({row['persona_name']}) ---\n"
        for q in QUESTION_KEYS + ["additional_thoughts"]:
            if pd.notna(row.get(q)):
                transcript_block += f"{q}: {row[q]}\n"

    system = """You are an expert qualitative researcher analyzing depth interview transcripts about homeowner backyard needs and interest in a prefabricated backyard structure (the Tahoe Mini).

Analyze all 30 transcripts and identify emergent themes and potential market segments. Return ONLY a JSON object."""

    user = f"""Analyze these 30 depth interview transcripts:

{transcript_block}

Return a JSON object with:
1. "themes": array of objects, each with:
   - "theme_name": concise label
   - "description": 2-3 sentences
   - "frequency": number of respondents showing this theme
   - "supporting_quotes": array of {{"respondent_id": "...", "quote": "..."}} (2-3 per theme)

2. "segment_suggestions": array of objects, each with:
   - "segment_name": descriptive name
   - "description": 2-3 sentences
   - "estimated_size": percentage of sample
   - "representative_respondents": array of persona_ids
   - "key_driver": primary purchase motivation
   - "primary_barrier": main obstacle

Identify 4-6 themes and 4-6 segments. Base segments on observed patterns, not predetermined categories."""

    print("  LLM theme extraction (1 call)...")
    raw = call_openrouter(api_key, "openai/gpt-4.1-mini", system, user, temperature=0.3, max_tokens=4000)
    return parse_json_response(raw)


# --- Layer 3: Emotional Tone ---

def classify_emotion(api_key, row):
    """Classify emotional tone for one respondent based on IQ6 + IQ7."""
    iq6 = str(row.get("IQ6", ""))
    iq7 = str(row.get("IQ7", ""))

    system = f"""You are a qualitative research analyst classifying emotional tone in interview responses.

Classify the respondent's emotional reaction to the Tahoe Mini product concept.

Use ONLY these emotions: {', '.join(EMOTION_TAXONOMY)}

Return ONLY a JSON object with:
- "primary_emotion": one of the emotions above
- "secondary_emotion": one of the emotions above, or null
- "intensity": integer 1-5 (1=subtle, 5=very strong)
- "reasoning": 1-2 sentences explaining your classification"""

    user = f"""Respondent {row['persona_id']} ({row['persona_name']}):

IQ6 (Product reaction): {iq6}

IQ7 (Barriers & drivers): {iq7}

Classify the emotional tone."""

    raw = call_openrouter(api_key, "openai/gpt-4.1-mini", system, user, temperature=0.3, max_tokens=300)
    result = parse_json_response(raw)

    # Validate
    if result.get("primary_emotion") not in EMOTION_TAXONOMY:
        result["primary_emotion"] = "pragmatism"
    if result.get("secondary_emotion") and result["secondary_emotion"] not in EMOTION_TAXONOMY:
        result["secondary_emotion"] = None
    result["intensity"] = max(1, min(5, int(result.get("intensity", 3))))

    return {
        "persona_id": row["persona_id"],
        "primary_emotion": result["primary_emotion"],
        "secondary_emotion": result.get("secondary_emotion") or "",
        "emotion_intensity": result["intensity"],
        "emotion_reasoning": result.get("reasoning", ""),
    }


def run_emotional_tone(api_key, df):
    """Classify emotional tone for all respondents in parallel."""
    print(f"  Emotional tone classification ({len(df)} calls, parallel)...")
    results = {}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}
        for _, row in df.iterrows():
            f = executor.submit(classify_emotion, api_key, row)
            futures[f] = row["persona_id"]

        for i, future in enumerate(as_completed(futures), 1):
            pid = futures[future]
            try:
                result = future.result()
                results[result["persona_id"]] = result
                print(f"    [{i}/{len(df)}] {pid}: {result['primary_emotion']}")
            except Exception as e:
                print(f"    [{i}/{len(df)}] {pid} FAILED: {e}")
                results[pid] = {
                    "persona_id": pid,
                    "primary_emotion": "pragmatism",
                    "secondary_emotion": "",
                    "emotion_intensity": 3,
                    "emotion_reasoning": f"Classification failed: {e}",
                }

    # Merge into dataframe
    for col in ["primary_emotion", "secondary_emotion", "emotion_intensity", "emotion_reasoning"]:
        df[col] = df["persona_id"].map(lambda pid, c=col: results.get(pid, {}).get(c, ""))

    return df


# --- Main Pipeline ---

def main():
    transcript_path = OUTPUT_DIR / "interview_transcripts.csv"
    if not transcript_path.exists():
        print(f"Error: {transcript_path} not found. Run generate_test_interviews.py or synthetic_interviews.py first.")
        return

    api_key = load_api_key()
    print(f"Loaded API key: ...{api_key[-6:]}")

    df = pd.read_csv(transcript_path)
    print(f"Loaded {len(df)} interview transcripts")

    # Layer 1: VADER sentiment
    print("\n[1/3] VADER Sentiment Analysis...")
    df = run_sentiment(df)

    # Layer 2: LDA topics
    print("\n[2/3] Thematic Analysis (LDA + LLM)...")
    lda_results = run_lda(df)
    llm_themes = run_llm_themes(api_key, df)

    themes = {
        "lda_topics": lda_results,
        "llm_themes": llm_themes.get("themes", []),
        "segment_suggestions": llm_themes.get("segment_suggestions", []),
    }

    # Layer 3: Emotional tone
    print("\n[3/3] Emotional Tone Assessment...")
    df = run_emotional_tone(api_key, df)

    # Save analysis CSV
    analysis_path = OUTPUT_DIR / "interview_analysis.csv"
    df.to_csv(analysis_path, index=False)
    print(f"\nSaved analysis -> {analysis_path}")

    # Save themes JSON
    themes_path = OUTPUT_DIR / "interview_themes.json"
    with open(themes_path, "w", encoding="utf-8") as f:
        json.dump(themes, f, indent=2, ensure_ascii=False)
    print(f"Saved themes -> {themes_path}")

    # Summary
    print(f"\n--- Summary ---")
    print(f"Respondents: {len(df)}")
    print(f"Sentiment: {df['sentiment_label'].value_counts().to_dict()}")
    print(f"LDA topics: {lda_results['num_topics']} (coherence={lda_results['coherence_score']})")
    print(f"LLM themes: {len(themes['llm_themes'])}")
    print(f"Segments suggested: {len(themes['segment_suggestions'])}")
    print(f"Emotions: {df['primary_emotion'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
