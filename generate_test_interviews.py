"""Generate realistic test interview data without API calls.

Produces all three output files:
- interview_transcripts.csv (30 rows)
- interview_analysis.csv (enriched with sentiment + emotion)
- interview_themes.json (LDA topics + LLM themes + segment suggestions)
"""

import csv
import json
import random
from datetime import datetime, timezone
from pathlib import Path

from interview_personas import INTERVIEW_PERSONAS, MODEL_LABELS

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# 5 latent response tendencies (NOT the 5 existing segments)
TENDENCIES = {
    "remote-worker": {
        "IQ1": [
            "My backyard is decent but I rarely use it during work hours. {home_detail} I mostly see it through the window while I'm on calls. It feels like wasted potential honestly. I wish I could make better use of it.",
            "I have a {yard_size} backyard that my {household_detail} enjoys on weekends. During the week it just sits there while I'm stuck inside working. I feel guilty not using it more. It could be so much more than just grass.",
        ],
        "IQ2": [
            "My biggest unmet need is a proper workspace. I'm currently working from {current_space} and it's not ideal. The noise from {noise_source} is constant. I desperately need a dedicated, quiet office space.",
            "I need separation between work and home. Right now my desk is in {current_space} and I can hear everything. When I'm on video calls it's embarrassing. I wish I had a real office.",
        ],
        "IQ3": [
            "I've definitely thought about it — probably looked at those prefab office pods online a dozen times. The cost always held me back though. And I wasn't sure about permits in my area. It felt like a big commitment.",
            "Yeah, I've researched backyard offices before. I even got a quote from a local contractor once. It was way more than I expected — like $40K+. So I shelved the idea, but I still think about it.",
        ],
        "IQ4": [
            "A home office, no question. I'd set up my standing desk, dual monitors, and finally have a door I can close. The commute would be 30 seconds across the yard — dream scenario. My {household_detail} would be thrilled to get their space back too.",
            "I'd make it my dedicated work studio immediately. I'd soundproof it, add good lighting, and set up my equipment. It would transform my work-from-home experience. The mental separation of walking to a separate building would be huge.",
        ],
        "IQ5": [
            "I struggle with boundaries honestly. Working from {current_space} means I'm never really 'off.' I eat lunch at my desk, I check emails in the evening. Having a physical boundary like a separate structure would be life-changing.",
            "I try to keep boundaries but it's hard. My workspace is in the {current_space} so there's always overlap. I use headphones to signal 'I'm working' but it's not great. I don't have a dedicated workspace — more like a corner I've claimed.",
        ],
        "IQ6": [
            "$23K is less than I expected for something like this! One-day installation is amazing — I was dreading weeks of construction. The permit-light part is clutch because that was my biggest worry. I'm genuinely excited but I want to know about insulation and soundproofing.",
            "My immediate reaction is positive. The price point feels reasonable compared to contractors. One-day install means minimal disruption to my work schedule. My concern would be — can it handle SoCal heat? Does it have AC options? Also, what's the actual permit situation here?",
        ],
        "IQ7": [
            "I'd need to know it's well-insulated and can handle {weather} weather. Good electrical for my equipment is non-negotiable. If the HOA blocks it, that's a dealbreaker. And I'd want to see one in person before committing $23K.",
            "Financing options would help — $23K is doable but not easy to drop all at once. I'd need good WiFi connectivity from the main house. If it felt flimsy or temporary, that would kill it. I want something that lasts 10+ years.",
        ],
        "IQ8": [
            "Sponsorship wouldn't really affect me either way. I discover home products through {discovery}. Honestly, I'd probably find something like this through a targeted ad or a work-from-home forum. Word of mouth from someone who actually has one would be most convincing.",
            "I'm neutral on sponsorship but it wouldn't hurt. I find home products through {discovery}. I'd trust a review from another remote worker more than any ad. A demo unit at a coworking event would be smart marketing.",
        ],
        "additional_thoughts": [
            "The remote work shift is permanent for me. Companies that solve the home office problem well are going to do great. I just want something that works, looks professional on camera, and keeps the noise out.",
            "I've been waiting for a product like this. The ADU trend priced me out but this size and price make sense. I hope the quality matches the promise.",
        ],
        "primary_emotion": "excitement",
        "secondary_emotion": "frustration",
        "emotion_intensity": 4,
    },
    "active-lifestyle": {
        "IQ1": [
            "My backyard is my staging area. {home_detail} I've got bikes leaning against the fence, a cooler always ready. It's where I prep for weekend rides. I love it but it's chaotic — my {household_detail} would say it's a mess.",
            "I use my backyard constantly — stretching before runs, hosing off gear, hanging out after a ride. {home_detail} It's functional but not organized. I feel like I need better storage solutions out there.",
        ],
        "IQ2": [
            "Gear storage is my number one issue. My garage is packed and I can't fit my car in there anymore. I need a place to store bikes, boards, camping gear — all of it. A proper workshop area would be amazing too.",
            "I need a dedicated space for my outdoor equipment. Right now it's spread between the garage, the shed that's falling apart, and the living room. My {household_detail} is over it. I also wish I had a place to work on equipment.",
        ],
        "IQ3": [
            "I've looked at sheds from Home Depot but they feel flimsy. A real structure with power and lighting would be awesome. Cost and effort held me back — I don't want a months-long project. I just want something that works.",
            "I actually started building a shed once but ran out of time and motivation halfway through. The permit process seemed annoying too. I'd love something turnkey that I don't have to build myself.",
        ],
        "IQ4": [
            "A gear basecamp — bike workshop with a stand, tool wall, and space to wrench. Maybe a small fridge for post-ride beers. I'd hang out there with friends after rides. It would be my happy place.",
            "Half workshop, half hangout. Pegboard for tools, rack for bikes, and a bench to sit and plan the next adventure. I'd probably spend more time in there than in the house. My {household_detail} might actually appreciate that.",
        ],
        "IQ5": [
            "I work {work_arrangement_short} so the boundaries are pretty clear. I leave work at work and come home to my hobbies. I don't really need an office — I need a workshop. My garage is my current workspace for gear and it's overflowing.",
            "Work boundaries aren't my issue — activity space boundaries are. My gear takes over the house. I need a separate space for my hobby stuff so the main house stays livable. My {household_detail} has been patient but it's wearing thin.",
        ],
        "IQ6": [
            "Interesting. $23K is real money but not crazy. One-day install is cool — I don't want a construction zone in my yard. My concern is whether 120 sq ft is big enough for what I need. Can I customize the interior? I'd want heavy-duty flooring and wall mounts.",
            "The speed is appealing — I'm impatient with projects. $23K is steep for my budget though. I'm curious about the build quality. Will it hold up to me dragging muddy bikes in and out? Permit-light is great because I just want it up and usable.",
        ],
        "IQ7": [
            "Price would need to come with financing. I'd want to see that it can handle real use — not just a pretty garden office. Heavy-duty flooring, ventilation for summer, and electrical outlets everywhere. Dealbreaker is if it feels too delicate.",
            "I'd need to see one in real life with a workshop setup. If it's just marketed as a home office, I'd skip it. Show me it can be a basecamp. The {hoa_detail} situation could block me too. Durability is everything.",
        ],
        "IQ8": [
            "Outdoor event sponsorship would actually impress me. If I saw this at a mountain bike event or a trail running expo, I'd stop and look. That's way better than a random Instagram ad. I trust brands that show up in my world.",
            "Yeah, if they sponsored my local cycling club or a trail race, I'd notice. That shows they understand the customer. I discover products through {discovery} and word of mouth from my riding crew. A demo at an outdoor event would be smart.",
        ],
        "additional_thoughts": [
            "I think there's a huge market for people like me who need gear space, not office space. Don't just market this as a home office — the adventure crowd needs storage solutions badly.",
            "My dream is a backyard that's functional, not just pretty. If this product delivers on durability and customization, I'm interested. Just don't make it too precious to use.",
        ],
        "primary_emotion": "curiosity",
        "secondary_emotion": "skepticism",
        "emotion_intensity": 3,
    },
    "wellness": {
        "IQ1": [
            "My backyard is my escape. {home_detail} I do yoga out there when the weather is nice. It's peaceful but I can still hear the neighbors and the street. I wish it felt more private and sacred.",
            "I love my backyard but it's not set up for what I really want. {home_detail} I use it for morning meditation when I can, but it's exposed and not comfortable year-round. I dream of having a proper wellness space.",
        ],
        "IQ2": [
            "I need a dedicated wellness space — somewhere I can practice yoga, meditate, or just breathe without interruption. The house is always busy with {household_detail}. I crave a personal sanctuary.",
            "My biggest need is privacy and calm. I don't have a room where I can close the door and do my practice. The {household_detail} needs are always competing with mine. A separate space would be transformative for my mental health.",
        ],
        "IQ3": [
            "I've thought about converting the garage but it's too hot in summer and we need the parking. A yoga studio in the backyard has been my Pinterest board dream for years. Cost and logistics always stopped me.",
            "I looked into building a she-shed or a yoga studio. The quotes were $30K-$50K and that felt insane. The permit process seemed daunting too. I gave up on it but the desire never went away.",
        ],
        "IQ4": [
            "A wellness studio — bamboo flooring, natural light, a little altar for meditation. I'd do my morning yoga there rain or shine. Maybe add a small sound system for ambient music. It would be my daily ritual space.",
            "A personal retreat for mind and body. I'd set up my yoga mat permanently, add some plants, soft lighting. I could do breath work, journal, create art. Having a dedicated space would make my practice consistent instead of sporadic.",
        ],
        "IQ5": [
            "I {work_arrangement_short} so I'm home a lot. The boundaries blur constantly. I don't have a dedicated workspace and honestly, work isn't the issue — it's having no space for ME. Everything is shared or multipurpose.",
            "Boundaries are a constant struggle. I {work_arrangement_short} and the house serves too many functions. I need a space that's exclusively mine — not the office, not the kids' area, mine. For wellness and creative renewal.",
        ],
        "IQ6": [
            "$23K is an investment I could see making for my wellbeing. One-day installation is wonderful — no prolonged disruption to my peace. I'm excited about the possibility. My concern is aesthetics — can I make it feel warm and inviting, not industrial?",
            "My heart says yes. The concept is exactly what I've been wanting. $23K is less than the contractor quotes I got before. My worry is about climate control — can it handle SoCal heat for hot yoga? And I'd want to see interior finish options.",
        ],
        "IQ7": [
            "It needs to feel like a sanctuary, not a shed. Good insulation, climate control, and natural light are non-negotiable. I'd want to see material quality in person. If it looks and feels cheap, I'm out. {hoa_detail} could also be an issue.",
            "I'd need to feel confident it's well-built and beautiful. Financing would make it easier to commit. I'd want testimonials from people using it for wellness — not just offices. Dealbreaker is if the HOA blocks it or it feels flimsy.",
        ],
        "IQ8": [
            "Community event sponsorship would resonate with me — especially wellness events, farmers markets, or yoga festivals. I discover products through {discovery}. I trust recommendations from my wellness community more than ads.",
            "If they sponsored a local wellness retreat or meditation event, I'd feel aligned with the brand. I find home products through {discovery}. I'd love to see this at a wellness expo where I could step inside and experience it.",
        ],
        "additional_thoughts": [
            "There's a growing movement of people who want wellness spaces at home. The pandemic made us realize how important personal sanctuaries are. Market this to the wellness community and you'll find eager customers.",
            "I think the wellness angle is undersold in the backyard structure market. Everyone focuses on offices and guest houses. A personal retreat space speaks to something deeper — self-care as a lifestyle investment.",
        ],
        "primary_emotion": "aspiration",
        "secondary_emotion": "anxiety",
        "emotion_intensity": 4,
    },
    "investment": {
        "IQ1": [
            "My backyard is large — {home_detail}. I see it as an asset, honestly. I maintain it well because curb appeal and property value matter to me. But I always think about how to get more ROI from the space.",
            "I have a {yard_size} backyard that's well-maintained. {home_detail} I think about my property as an investment portfolio. Every improvement should add value. The backyard is underutilized square footage.",
        ],
        "IQ2": [
            "I need a guest space. When {household_detail} visit, we're cramped. I've looked at ADUs but the cost and permits are ridiculous. A flexible space that could be a guest suite or an Airbnb unit would be ideal.",
            "I want to maximize my property's potential. Additional livable space — for guests, for rental income, or for aging parents — is my biggest need. The main house is maxed out and I don't want a full addition.",
        ],
        "IQ3": [
            "I've researched ADUs extensively. The $100K+ cost and 6-month timeline killed my interest. I also looked at prefab tiny homes but the permitting was a nightmare. I want something simpler, faster, and more affordable.",
            "I've had contractors out to quote an ADU. Minimum $80K, 4-6 months, full permits. It's a massive project. I've been waiting for a better option. Something that adds value without the headache.",
        ],
        "IQ4": [
            "A guest suite that could double as an Airbnb. I'd put in a murphy bed, a mini kitchenette area, and make it feel like a boutique hotel room. At $23K, if I could rent it out even occasionally, the ROI would be excellent.",
            "An income-generating space. I'd list it as a private backyard studio on Airbnb. Even at $75/night for weekends only, that's significant passive income. It pays for itself in under two years. That's the kind of math I like.",
        ],
        "IQ5": [
            "I work {work_arrangement_short} so this isn't about my workspace. It's about maximizing property value and income potential. I have a fine office setup in the house. The backyard is the untapped opportunity.",
            "Work boundaries aren't my concern — I {work_arrangement_short}. I think about this purely from an investment angle. What adds the most value per dollar spent? A well-designed backyard structure is like adding a room without a major reno.",
        ],
        "IQ6": [
            "$23K is remarkably reasonable compared to ADU alternatives. One-day install eliminates my biggest frustration with construction projects. My concern is quality at that price point — what am I getting for $23K? Also, can it appraise as added living space?",
            "Very interested. The price-to-value ratio is compelling. My questions are about durability, resale impact, and whether it qualifies for any tax benefits. One-day install is a major selling point. Permit-light is smart positioning.",
        ],
        "IQ7": [
            "I need data on property value impact. Show me comps where a backyard structure added value. Build quality must be excellent — I won't put something on my property that looks cheap. {hoa_detail} compliance is critical. Financing at reasonable rates would seal it.",
            "Clear ROI documentation. I want to know the resale value impact, the rental income potential, and the durability over 15+ years. Dealbreaker is if it looks temporary or doesn't appraise. I'd also need HOA approval upfront.",
        ],
        "IQ8": [
            "Community event sponsorship doesn't affect my decision — I buy based on value and quality. I discover products through {discovery}. Real estate agent recommendations would carry the most weight with me. Show me the numbers.",
            "I'm not influenced by sponsorship. I research thoroughly before any home investment. I find products through {discovery}. A partnership with real estate agents or home appraisers would be more effective than event marketing for someone like me.",
        ],
        "additional_thoughts": [
            "The ADU market has been overpriced and slow. There's a massive opportunity for a product that delivers 80% of the value at 20% of the cost and hassle. Nail the quality and positioning and the investment-minded buyer is yours.",
            "Think about partnering with real estate agents and property managers. They can sell this as a value-add to homeowners. The $23K price point is in impulse-buy territory for serious property investors.",
        ],
        "primary_emotion": "pragmatism",
        "secondary_emotion": None,
        "emotion_intensity": 3,
    },
    "practical-value": {
        "IQ1": [
            "My backyard is small — {home_detail}. The kids play out there sometimes but it's nothing fancy. I'd like to do more with it but we're on a budget. It feels like an afterthought in our home honestly.",
            "We've got a {yard_size} backyard. {home_detail} It's fine but nothing special. I mow it and that's about it. I'd love to make better use of it but every project seems expensive. We've been putting things off.",
        ],
        "IQ2": [
            "Storage, storage, storage. We have too much stuff and not enough space. The garage is full, the closets are full. I also wish I had a craft or hobby space but the house can't accommodate it. Everything is multipurpose.",
            "We need more room for the kids' stuff and my projects. I'm a {hobby} person and I have nowhere to do it properly. The {household_detail} setup means every room is shared. A dedicated space would solve a lot of arguments.",
        ],
        "IQ3": [
            "I've looked at Costco and Home Depot sheds but they're either flimsy or expensive. I thought about building something myself but I don't have the skills or time. The permit thing worried me too. I just want something simple that works.",
            "I priced out a couple of shed options. The cheap ones look terrible and the nice ones are $15K+. I got sticker shock. I thought about a DIY approach but between {household_detail} and work, I have no time for a big project.",
        ],
        "IQ4": [
            "A multipurpose room — craft space for me, play area for the kids, and overflow storage. Nothing fancy, just functional. Maybe a workbench along one wall and toy bins along the other. Practical and organized.",
            "I'd use it for my {hobby} projects. Having a dedicated space where I can leave things set up without cleaning up every night would be incredible. The kids could play out there on rainy days too. Just needs to be sturdy and practical.",
        ],
        "IQ5": [
            "I work {work_arrangement_short} so work boundaries aren't the main issue. Home boundaries are — finding personal space when you live with {household_detail}. Everyone needs their own corner and our house doesn't have enough corners.",
            "The issue isn't work-life balance, it's life-life balance. With {household_detail}, someone always needs the table, the couch, the TV. I {work_arrangement_short} and when I'm home, there's no quiet spot. A backyard room would give us all more breathing room.",
        ],
        "IQ6": [
            "$23K is a lot of money for us. That's not pocket change. But if it's genuinely installed in one day and doesn't need major permits, that's really appealing. My concern is whether we can afford it. Does it come with financing?",
            "Honestly, the price makes me wince a bit. We could do a lot with $23K. But the one-day install and no-permit hassle are huge selling points. I'd need financing options for sure. What does the warranty look like?",
        ],
        "IQ7": [
            "Financing is the make-or-break. If I could do $200-300/month, I'd seriously consider it. It needs to be durable — I don't want to pay $23K for something that falls apart in 5 years. And if my {hoa_detail}, that would stop me dead.",
            "Monthly payment option under $300. That's my threshold. I'd also need to know it can handle rough use — this isn't a museum piece. Dealbreaker is if it doesn't include setup and I'm stuck figuring out electrical and foundation.",
        ],
        "IQ8": [
            "Sponsorship doesn't really matter to me. I find products through {discovery}. Honestly, a neighbor having one would be the best marketing. If I could see it and touch it before buying, that would help a lot.",
            "I don't pay attention to sponsorships much. I discover home products through {discovery}. Price and value drive my decisions. If a friend recommended it and I could see theirs, I'd be sold faster than any ad campaign.",
        ],
        "additional_thoughts": [
            "There are a lot of families like mine who need more space but can't afford a home addition. The sweet spot is quality, affordability, and simplicity. Don't over-design it — make it sturdy, practical, and accessible.",
            "I think the market for practical, affordable backyard structures is huge. Not everyone needs a fancy home office or yoga studio. Some of us just need more room. Keep the price competitive and the quality honest.",
        ],
        "primary_emotion": "pragmatism",
        "secondary_emotion": "anxiety",
        "emotion_intensity": 3,
    },
}

# Assign tendencies to personas based on lifestyle_note keywords
TENDENCY_KEYWORDS = {
    "remote-worker": ["remote", "work from home", "software", "video calls", "editing suite", "soundproof", "accounting", "tech lead", "accountant"],
    "active-lifestyle": ["bik", "trail", "surf", "climb", "outdoor", "fitness", "coach", "gear"],
    "wellness": ["yoga", "meditat", "journal", "sanctuary", "decompression", "wellness", "birdwatch"],
    "investment": ["real estate", "property", "e-commerce", "inventory", "entertain", "client", "executive", "rental"],
    "practical-value": ["DIY", "budget", "craft", "gamer", "stream", "musician", "guitar", "Etsy", "tutor"],
}


def assign_tendency(persona):
    """Assign a response tendency based on lifestyle_note keywords."""
    note = persona["lifestyle_note"].lower() + " " + persona["work_arrangement"].lower()
    for tendency, keywords in TENDENCY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in note:
                return tendency
    return "practical-value"  # fallback


def fill_slots(template, persona, rng):
    """Replace placeholder slots in response templates."""
    home = persona["home_situation"]
    yard_size = "small" if "small" in home or "tiny" in home else ("large" if "large" in home else "medium")
    household = persona["household"]

    # Simplify household for inline references
    if "alone" in household.lower():
        household_detail = "just me"
    elif "partner" in household.lower() and "kid" not in household.lower() and "child" not in household.lower():
        household_detail = "my partner"
    elif "kid" in household.lower() or "child" in household.lower():
        household_detail = "the kids"
    else:
        household_detail = "my family"

    work = persona["work_arrangement"]
    if "remote" in work.lower():
        work_short = "work from home full-time"
    elif "hybrid" in work.lower():
        work_short = "work a hybrid schedule"
    elif "self-employed" in work.lower() or "freelance" in work.lower():
        work_short = "am self-employed and work from home"
    elif "retired" in work.lower():
        work_short = "am retired"
    else:
        work_short = "work on-site full-time"

    current_spaces = ["the dining table", "the guest bedroom", "a corner of the living room", "the kitchen counter"]
    noise_sources = ["the kids", "the TV", "the dog", "my partner's calls", "the neighbors"]
    weathers = ["summer", "hot SoCal", "triple-digit"]
    discoveries = ["Instagram", "Google searches", "YouTube reviews", "friends and neighbors", "Reddit"]
    hobbies = ["DIY", "crafting", "woodworking", "creative"]

    hoa = persona["hoa_status"]
    if hoa == "Yes":
        hoa_detail = "HOA says no"
    elif hoa == "I'm not sure":
        hoa_detail = "HOA might be an issue"
    else:
        hoa_detail = "it requires a full permit"

    replacements = {
        "{home_detail}": home,
        "{yard_size}": yard_size,
        "{household_detail}": household_detail,
        "{current_space}": rng.choice(current_spaces),
        "{noise_source}": rng.choice(noise_sources),
        "{weather}": rng.choice(weathers),
        "{discovery}": rng.choice(discoveries),
        "{work_arrangement_short}": work_short,
        "{hoa_detail}": hoa_detail,
        "{hobby}": rng.choice(hobbies),
    }

    for key, val in replacements.items():
        template = template.replace(key, val)
    return template


def generate_test_transcript(persona, model_label):
    """Generate one test interview transcript."""
    rng = random.Random(hash((persona["persona_id"], model_label, "test_interview")))
    tendency = assign_tendency(persona)
    profile = TENDENCIES[tendency]

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

    for key in ["IQ1", "IQ2", "IQ3", "IQ4", "IQ5", "IQ6", "IQ7", "IQ8", "additional_thoughts"]:
        templates = profile[key]
        template = rng.choice(templates)
        row[key] = fill_slots(template, persona, rng)

    row["generation_timestamp"] = datetime(2026, 3, 8, 14, 0, 0, tzinfo=timezone.utc).isoformat()
    row["raw_json"] = json.dumps({k: row[k] for k in ["IQ1", "IQ2", "IQ3", "IQ4", "IQ5", "IQ6", "IQ7", "IQ8", "additional_thoughts"]})

    return row, tendency, profile


def generate_test_analysis(row, tendency, profile):
    """Generate pre-computed sentiment and emotion columns for one row."""
    rng = random.Random(hash((row["persona_id"], row["model"], "analysis")))

    # Simulated VADER sentiment scores per tendency
    sentiment_baselines = {
        "remote-worker": {"IQ1": -0.1, "IQ2": -0.3, "IQ3": -0.2, "IQ4": 0.7, "IQ5": -0.2, "IQ6": 0.6, "IQ7": 0.1, "IQ8": 0.1},
        "active-lifestyle": {"IQ1": 0.5, "IQ2": -0.1, "IQ3": -0.1, "IQ4": 0.8, "IQ5": 0.3, "IQ6": 0.3, "IQ7": 0.0, "IQ8": 0.5},
        "wellness": {"IQ1": 0.4, "IQ2": -0.2, "IQ3": -0.2, "IQ4": 0.8, "IQ5": -0.1, "IQ6": 0.7, "IQ7": 0.2, "IQ8": 0.4},
        "investment": {"IQ1": 0.2, "IQ2": -0.1, "IQ3": -0.3, "IQ4": 0.6, "IQ5": 0.3, "IQ6": 0.5, "IQ7": 0.1, "IQ8": 0.0},
        "practical-value": {"IQ1": 0.0, "IQ2": -0.3, "IQ3": -0.2, "IQ4": 0.5, "IQ5": -0.1, "IQ6": 0.2, "IQ7": -0.1, "IQ8": 0.0},
    }

    baselines = sentiment_baselines[tendency]
    analysis_row = dict(row)

    sentiments = []
    for q in ["IQ1", "IQ2", "IQ3", "IQ4", "IQ5", "IQ6", "IQ7", "IQ8"]:
        score = baselines[q] + rng.gauss(0, 0.15)
        score = max(-1.0, min(1.0, round(score, 4)))
        analysis_row[f"sentiment_{q}"] = score
        sentiments.append(score)

    overall = round(sum(sentiments) / len(sentiments), 4)
    analysis_row["sentiment_overall"] = overall
    analysis_row["sentiment_label"] = "Positive" if overall > 0.05 else ("Negative" if overall < -0.05 else "Neutral")

    # Emotional tone
    analysis_row["primary_emotion"] = profile["primary_emotion"]
    analysis_row["secondary_emotion"] = profile.get("secondary_emotion") or ""
    analysis_row["emotion_intensity"] = profile["emotion_intensity"] + rng.choice([-1, 0, 0, 1])
    analysis_row["emotion_intensity"] = max(1, min(5, analysis_row["emotion_intensity"]))
    analysis_row["emotion_reasoning"] = f"Respondent shows {profile['primary_emotion']} based on language in IQ6-IQ7 responses, consistent with {tendency} tendency."

    return analysis_row


def generate_test_themes(analysis_rows):
    """Generate realistic theme structure with segment suggestions."""
    themes = {
        "lda_topics": {
            "num_topics": 6,
            "coherence_score": 0.42,
            "topics": [
                {"topic_id": 0, "label": "Remote Work Space", "keywords": ["work", "office", "desk", "quiet", "space", "home", "remote", "calls", "noise", "dedicated"]},
                {"topic_id": 1, "label": "Outdoor Activity Storage", "keywords": ["gear", "bike", "storage", "garage", "workshop", "outdoor", "equipment", "tools", "space", "organize"]},
                {"topic_id": 2, "label": "Personal Wellness Retreat", "keywords": ["yoga", "meditation", "peace", "sanctuary", "wellness", "calm", "practice", "studio", "retreat", "personal"]},
                {"topic_id": 3, "label": "Property Value & Investment", "keywords": ["value", "property", "invest", "rental", "income", "adu", "cost", "roi", "quality", "appraisal"]},
                {"topic_id": 4, "label": "Family Space Needs", "keywords": ["kids", "family", "storage", "play", "room", "house", "space", "budget", "practical", "affordable"]},
                {"topic_id": 5, "label": "Creative Studio", "keywords": ["studio", "creative", "music", "art", "record", "film", "design", "content", "setup", "equipment"]},
            ],
        },
        "llm_themes": [
            {
                "theme_name": "The Desperate Home Office",
                "description": "Remote and hybrid workers frustrated with makeshift workspaces, craving physical separation between work and personal life.",
                "frequency": 10,
                "supporting_quotes": [
                    {"respondent_id": "INT01", "quote": "I'm currently working from the dining table and it's not ideal."},
                    {"respondent_id": "INT06", "quote": "Working from the guest bedroom means I'm never really off."},
                    {"respondent_id": "INT12", "quote": "I need better work-life separation — my desk is in the living room."},
                ],
            },
            {
                "theme_name": "The Gear Overflow Problem",
                "description": "Active lifestyle enthusiasts whose equipment has taken over garages, closets, and living spaces, seeking dedicated storage and workshop space.",
                "frequency": 6,
                "supporting_quotes": [
                    {"respondent_id": "INT04", "quote": "My garage is packed and I can't fit my car in there anymore."},
                    {"respondent_id": "INT14", "quote": "I need gear storage and an editing station for outdoor photography."},
                ],
            },
            {
                "theme_name": "The Wellness Sanctuary Dream",
                "description": "Health-conscious individuals seeking a personal retreat space for yoga, meditation, and creative practices away from household interruptions.",
                "frequency": 5,
                "supporting_quotes": [
                    {"respondent_id": "INT06", "quote": "I dream of a proper wellness space separate from the house."},
                    {"respondent_id": "INT21", "quote": "I crave a personal sanctuary at home for decompression after long shifts."},
                ],
            },
            {
                "theme_name": "The Smart Investment Angle",
                "description": "Property-minded homeowners who view backyard structures as value-add investments, comparing favorably to expensive ADU alternatives.",
                "frequency": 5,
                "supporting_quotes": [
                    {"respondent_id": "INT08", "quote": "I follow property values closely — every improvement should add value."},
                    {"respondent_id": "INT22", "quote": "I want an impressive, private meeting space that also adds to property value."},
                ],
            },
            {
                "theme_name": "The Budget-Practical Family",
                "description": "Cost-conscious families needing multipurpose space for kids, hobbies, and storage, where $23K is a significant but potentially worthwhile investment.",
                "frequency": 4,
                "supporting_quotes": [
                    {"respondent_id": "INT10", "quote": "We have too much stuff and not enough space."},
                    {"respondent_id": "INT17", "quote": "I need somewhere to practice guitar without bothering neighbors."},
                ],
            },
        ],
        "segment_suggestions": [
            {
                "segment_name": "Remote Work Refugees",
                "description": "Professionals working from home full-time or hybrid who lack dedicated workspace and suffer from blurred work-life boundaries.",
                "estimated_size": "30-35%",
                "representative_respondents": ["INT01", "INT06", "INT12", "INT16", "INT23", "INT27"],
                "key_driver": "Physical separation of work and home",
                "primary_barrier": "HOA restrictions and cost justification",
            },
            {
                "segment_name": "Adventure Basecamp Seekers",
                "description": "Outdoor enthusiasts drowning in gear who want workshop/storage space integrated into their active lifestyle.",
                "estimated_size": "15-20%",
                "representative_respondents": ["INT04", "INT14", "INT28"],
                "key_driver": "Gear organization and hobby workspace",
                "primary_barrier": "Budget and 120 sqft size limitations",
            },
            {
                "segment_name": "Wellness Retreat Builders",
                "description": "Health-focused individuals seeking a personal sanctuary for yoga, meditation, and creative practice.",
                "estimated_size": "15-20%",
                "representative_respondents": ["INT05", "INT06", "INT19", "INT21"],
                "key_driver": "Privacy and personal renewal space",
                "primary_barrier": "Interior aesthetics and climate control",
            },
            {
                "segment_name": "Property Value Maximizers",
                "description": "Investment-oriented homeowners who see backyard structures as affordable alternatives to ADUs with strong ROI potential.",
                "estimated_size": "15-20%",
                "representative_respondents": ["INT08", "INT11", "INT18", "INT22"],
                "key_driver": "ROI, rental income, property appreciation",
                "primary_barrier": "Quality perception and appraisal impact",
            },
            {
                "segment_name": "Budget-Practical Families",
                "description": "Cost-sensitive households needing multipurpose space for kids, hobbies, and storage. Financing is the key enabler.",
                "estimated_size": "15-20%",
                "representative_respondents": ["INT10", "INT17", "INT26", "INT30"],
                "key_driver": "Affordable additional space for family needs",
                "primary_barrier": "Price and financing availability",
            },
        ],
        "existing_segment_mapping": {
            "Remote Work Refugees": "Remote Professional",
            "Adventure Basecamp Seekers": "Active Adventurer",
            "Wellness Retreat Builders": "Wellness Seeker",
            "Property Value Maximizers": "Property Maximizer",
            "Budget-Practical Families": "Budget-Conscious DIYer",
        },
    }
    return themes


def main():
    # Interleaved model assignment
    model_ids = ["openai/gpt-4.1-mini", "google/gemini-2.5-flash"]

    transcript_rows = []
    analysis_rows = []
    tendency_map = {}

    for i, persona in enumerate(INTERVIEW_PERSONAS):
        model_id = model_ids[i % 2]
        model_label = MODEL_LABELS[model_id]
        row, tendency, profile = generate_test_transcript(persona, model_label)
        transcript_rows.append(row)
        tendency_map[row["interview_id"]] = (tendency, profile)

        analysis_row = generate_test_analysis(row, tendency, profile)
        analysis_rows.append(analysis_row)

    # Save transcripts
    transcript_path = OUTPUT_DIR / "interview_transcripts.csv"
    fieldnames = list(transcript_rows[0].keys())
    with open(transcript_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(transcript_rows)
    print(f"Generated {len(transcript_rows)} test transcripts -> {transcript_path}")

    # Save analysis
    analysis_path = OUTPUT_DIR / "interview_analysis.csv"
    fieldnames = list(analysis_rows[0].keys())
    with open(analysis_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(analysis_rows)
    print(f"Generated {len(analysis_rows)} analysis rows -> {analysis_path}")

    # Save themes
    themes = generate_test_themes(analysis_rows)
    themes_path = OUTPUT_DIR / "interview_themes.json"
    with open(themes_path, "w", encoding="utf-8") as f:
        json.dump(themes, f, indent=2, ensure_ascii=False)
    print(f"Generated themes -> {themes_path}")

    # Quick stats
    import pandas as pd
    df = pd.DataFrame(analysis_rows)
    print(f"\nBy model:\n{df['model'].value_counts().to_string()}")
    print(f"\nSentiment labels:\n{df['sentiment_label'].value_counts().to_string()}")
    print(f"\nPrimary emotions:\n{df['primary_emotion'].value_counts().to_string()}")
    print(f"\nMean sentiment by question:")
    for q in ["IQ1", "IQ2", "IQ3", "IQ4", "IQ5", "IQ6", "IQ7", "IQ8"]:
        print(f"  {q}: {df[f'sentiment_{q}'].mean():.3f}")


if __name__ == "__main__":
    main()
