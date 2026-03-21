"""Market segment definitions for Neo Smart Living Tahoe Mini synthetic respondent generation."""

import random

SEGMENTS = [
    {
        "id": 1,
        "name": "Remote Professional",
        "demographics": {
            "Q21": "25-34",  # or 35-44
            "Q22": "$100,000-$149,999",  # or $150,000-$199,999
            "Q23": "I work remotely full-time (5 days/week from home)",  # or hybrid
            "Q24": ["Yes", "No"],
            "Q25": "About once a month",
            "Q26": "No",
        },
        "psychographic": (
            "You are a knowledge worker (software engineer, designer, marketer, or analyst) "
            "who transitioned to full-time or hybrid remote work. You live in a 3-bedroom "
            "home in suburban Southern California and have been struggling with work-from-home "
            "distractions — kids, TV, shared spaces. You crave a dedicated, quiet workspace "
            "separate from the house. You value productivity, clean design, and tech-forward "
            "products. You are willing to invest in your home setup but are cost-conscious "
            "about ROI. You enjoy occasional outdoor activities but are not an avid adventurer."
        ),
    },
    {
        "id": 2,
        "name": "Active Adventurer",
        "demographics": {
            "Q21": "25-34",  # or 35-44
            "Q22": "$75,000-$99,999",  # or $100,000-$149,999
            "Q23": "I work on-site / in-person full-time",  # or hybrid
            "Q24": ["No", "I'm not sure"],
            "Q25": "Weekly or more",
            "Q26": "Yes",
        },
        "psychographic": (
            "You are passionate about outdoor sports — mountain biking, trail running, hiking, "
            "surfing, or rock climbing. Your garage is overflowing with gear, bikes, boards, "
            "and camping equipment. You are part of a local outdoor club and spend weekends "
            "on trails or at events. You see your backyard as an extension of your active "
            "lifestyle — a place to tune bikes, wax boards, and hang with fellow enthusiasts. "
            "You are less interested in home office use and more drawn to the 'basecamp' concept. "
            "You are budget-aware but willing to spend on gear and lifestyle."
        ),
    },
    {
        "id": 3,
        "name": "Wellness Seeker",
        "demographics": {
            "Q21": "35-44",  # or 45-54
            "Q22": "$100,000-$149,999",  # or $150,000-$199,999
            "Q23": "I work a hybrid schedule (at least part of my week is remote)",  # or self-employed
            "Q24": ["Yes", "No"],
            "Q25": "2-3 times per month",  # or about once a month
            "Q26": "No",
        },
        "psychographic": (
            "You prioritize mental and physical wellness. You practice yoga, meditation, or "
            "home fitness regularly and dream of a dedicated space away from the main house "
            "for your routines. You may also use the space for creative pursuits — painting, "
            "journaling, music. You value natural light, calm aesthetics, and privacy. You are "
            "drawn to the wellness studio concept and see the Tahoe Mini as a personal retreat. "
            "You are moderately active outdoors but your primary interest is in personal "
            "wellness rather than adventure sports."
        ),
    },
    {
        "id": 4,
        "name": "Property Maximizer",
        "demographics": {
            "Q21": "45-54",  # or 55-64
            "Q22": "$150,000-$199,999",  # or $200,000 or more
            "Q23": "I work on-site / in-person full-time",  # or retired
            "Q24": ["Yes", "No"],
            "Q25": "A few times a year",
            "Q26": "No",
        },
        "psychographic": (
            "You think about your home as an investment. You are interested in adding a "
            "backyard unit primarily to increase property value, host guests comfortably, "
            "or generate short-term rental income. You have a larger property and the budget "
            "to invest. You are practical and ROI-focused — you want to know about resale "
            "value, durability, and quality. You are less interested in adventure or wellness "
            "positioning and more drawn to the guest suite / STR income concept. You are "
            "cautious about permits and HOA compliance."
        ),
    },
    {
        "id": 5,
        "name": "Budget-Conscious DIYer",
        "demographics": {
            "Q21": "25-34",  # or 35-44
            "Q22": "$50,000-$74,999",  # or $75,000-$99,999
            "Q23": "I work on-site / in-person full-time",  # or hybrid
            "Q24": ["No", "I'm not sure"],
            "Q25": "A few times a year",
            "Q26": "No",
        },
        "psychographic": (
            "You are handy and resourceful. You are interested in the Tahoe Mini for practical "
            "uses — extra storage, a workshop, a creative studio, or a kids' playroom. The "
            "$23,000 price point is a significant investment for you, and cost is your primary "
            "barrier. You are drawn to the DIY/speed-shed concept but are concerned about "
            "financing and total cost. You like the permit-light feature because it reduces "
            "hassle and cost. You are less interested in premium positioning and more focused "
            "on practical value."
        ),
    },
]

# Persona name pools for diversity
FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Avery",
    "Dakota", "Reese", "Skyler", "Jamie", "Drew", "Sage", "Rowan", "Emery",
    "Cameron", "Hayden", "Parker", "Finley", "Peyton", "Kendall", "Tatum", "Blake",
    "Marley", "Remy", "Ellis", "Lennox", "Phoenix", "Kai",
]


def get_respondent_config(segment, respondent_index, model_name):
    """Generate a unique respondent configuration with slight persona variation."""
    rng = random.Random(hash((segment["id"], respondent_index, model_name)))

    # Pick a unique persona name
    name = rng.choice(FIRST_NAMES)

    # Vary demographics slightly within segment range
    demo = dict(segment["demographics"])

    # Age variation
    age_options = {
        1: ["25-34", "35-44"],
        2: ["25-34", "35-44"],
        3: ["35-44", "45-54"],
        4: ["45-54", "55-64"],
        5: ["25-34", "35-44"],
    }
    demo["Q21"] = rng.choice(age_options[segment["id"]])

    # Income variation
    income_options = {
        1: ["$100,000-$149,999", "$150,000-$199,999"],
        2: ["$75,000-$99,999", "$100,000-$149,999"],
        3: ["$100,000-$149,999", "$150,000-$199,999"],
        4: ["$150,000-$199,999", "$200,000 or more"],
        5: ["$50,000-$74,999", "$75,000-$99,999"],
    }
    demo["Q22"] = rng.choice(income_options[segment["id"]])

    # Work arrangement variation
    work_options = {
        1: [
            "I work remotely full-time (5 days/week from home)",
            "I work a hybrid schedule (at least part of my week is remote)",
        ],
        2: [
            "I work on-site / in-person full-time",
            "I work a hybrid schedule (at least part of my week is remote)",
        ],
        3: [
            "I work a hybrid schedule (at least part of my week is remote)",
            "I am self-employed / freelance (primarily work from home)",
        ],
        4: [
            "I work on-site / in-person full-time",
            "I am retired",
        ],
        5: [
            "I work on-site / in-person full-time",
            "I work a hybrid schedule (at least part of my week is remote)",
        ],
    }
    demo["Q23"] = rng.choice(work_options[segment["id"]])

    # HOA: pick from segment options
    if isinstance(demo["Q24"], list):
        demo["Q24"] = rng.choice(demo["Q24"])

    # Outdoor frequency variation for segments 3 and 5
    outdoor_options = {
        3: ["About once a month", "2-3 times per month"],
        5: ["A few times a year", "About once a month"],
    }
    if segment["id"] in outdoor_options:
        demo["Q25"] = rng.choice(outdoor_options[segment["id"]])

    # Psychographic variation prompt
    variation_seeds = [
        "You lean slightly more practical than most in your group.",
        "You are more design-conscious than the average person in your segment.",
        "You tend to be more skeptical of new products and need strong evidence.",
        "You are an early adopter who gets excited about innovative solutions.",
        "You prioritize durability and long-term value over aesthetics.",
        "You are very social and often host gatherings at your home.",
    ]
    variation = rng.choice(variation_seeds)

    return {
        "name": name,
        "demographics": demo,
        "psychographic": segment["psychographic"],
        "variation": variation,
        "segment_id": segment["id"],
        "segment_name": segment["name"],
    }
