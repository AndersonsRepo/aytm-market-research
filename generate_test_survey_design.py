"""Generate realistic AI-assisted survey design data without API calls.

Produces the same output format as survey_design.py but with hand-crafted
survey instruments that demonstrate how each model approaches instrument
construction from interview themes.

Usage:
    python generate_test_survey_design.py
    python survey_design.py --test          # Same effect
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from survey_design import OUTPUT_DIR, OUTPUT_PATH, synthesize_instrument

# Each model generates a slightly different survey structure to demonstrate
# cross-model triangulation in instrument design. All are grounded in the
# same interview themes but differ in question emphasis and ordering.


def _base_sections():
    """Shared question bank — each model selects/adapts from these."""
    return {
        "screening": {
            "id": "screening",
            "label": "Screening & Qualification",
            "purpose": "Filter for homeowners with outdoor space suitable for a backyard structure",
            "questions": [
                {
                    "id": "S1", "type": "screening",
                    "text": "Do you currently own a home in Southern California?",
                    "options": ["Yes", "No [TERMINATE]"],
                    "rationale": "Core qualification — product is targeted at SoCal homeowners",
                    "source_theme": "Client Discovery: Target Customer",
                    "research_objective": "Qualification",
                },
                {
                    "id": "S2", "type": "screening",
                    "text": "Does your property have outdoor space where a small detached structure (~117 sq ft) could be placed?",
                    "options": ["Yes", "I'm not sure, but possibly", "No [TERMINATE]"],
                    "rationale": "Product requires backyard space; 'not sure' respondents still qualify as potential market",
                    "source_theme": "Client Discovery: Product Overview",
                    "research_objective": "Qualification",
                },
            ],
        },
        "baseline": {
            "id": "baseline",
            "label": "Category Baseline (Pre-Exposure)",
            "purpose": "Measure general interest in backyard structures before showing the Tahoe Mini",
            "questions": [
                {
                    "id": "Q0b", "type": "likert_interest",
                    "text": "How interested are you in adding a compact factory-built backyard unit to your property in the next 2 years?",
                    "options": None,
                    "rationale": "Establishes baseline interest before product exposure to detect stimulus effect",
                    "source_theme": "The Desperate Home Office — reveals latent demand for separate spaces",
                    "research_objective": "RQ1: Market demand baseline",
                },
            ],
        },
        "demand": {
            "id": "demand",
            "label": "Market Demand & Purchase Feasibility",
            "purpose": "Measure purchase interest and likelihood after product description exposure",
            "questions": [
                {
                    "id": "Q1", "type": "likert_interest",
                    "text": "Based on the product description, how interested would you be in purchasing a Tahoe Mini at ~$23,000?",
                    "options": None,
                    "rationale": "Direct purchase interest at stated price point",
                    "source_theme": "Client Discovery: Research Goals — 'validate willingness to pay'",
                    "research_objective": "RQ1: Purchase interest",
                },
                {
                    "id": "Q2", "type": "likert_likelihood",
                    "text": "How likely are you to purchase a Tahoe Mini within the next 24 months?",
                    "options": None,
                    "rationale": "Time-bounded purchase intent is more actionable than general interest",
                    "source_theme": "The Smart Investment Angle — property-minded buyers think in timelines",
                    "research_objective": "RQ1: Purchase likelihood",
                },
                {
                    "id": "Q3", "type": "single_choice",
                    "text": "If you were to install a Tahoe Mini, what would be its primary use?",
                    "options": [
                        "Home office / remote workspace",
                        "Guest suite / short-term rental income",
                        "Wellness studio (gym, yoga, meditation)",
                        "Adventure basecamp (gear storage, workshop)",
                        "Creative studio (music, podcast, art)",
                        "General storage",
                        "Other",
                    ],
                    "rationale": "Identifies dominant use case — directly answers founder's #1 research question",
                    "source_theme": "All 5 interview themes map to use cases; Home Office is most frequent (n=10)",
                    "research_objective": "RQ2: Primary use case ranking",
                },
            ],
        },
        "barriers": {
            "id": "barriers",
            "label": "Barriers to Purchase",
            "purpose": "Quantify obstacles identified in qualitative interviews",
            "questions": [
                {
                    "id": "Q5_cost", "type": "likert_5",
                    "text": "How much would the total cost (~$23,000) reduce your likelihood of purchasing?",
                    "options": None,
                    "rationale": "Cost was the most frequently mentioned barrier across all interview segments",
                    "source_theme": "The Budget-Practical Family — '$23K is a significant check to write'",
                    "research_objective": "RQ3: Barrier severity — cost",
                },
                {
                    "id": "Q5_hoa", "type": "likert_5",
                    "text": "How much would HOA restrictions reduce your likelihood of purchasing?",
                    "options": None,
                    "rationale": "HOA emerged as the #1 structural barrier in founder interview and consumer interviews",
                    "source_theme": "Client Discovery: Barriers — 'HOA restrictions are our biggest barrier'",
                    "research_objective": "RQ3: Barrier severity — HOA",
                },
                {
                    "id": "Q5_permit", "type": "likert_5",
                    "text": "How much would permit uncertainty reduce your likelihood of purchasing?",
                    "options": None,
                    "rationale": "Despite being 'permit-light,' many interviewees expressed permit anxiety",
                    "source_theme": "Client Discovery: Barriers — 'customers hear building and assume full permits'",
                    "research_objective": "RQ3: Barrier severity — permits",
                },
                {
                    "id": "Q5_space", "type": "likert_5",
                    "text": "How much would limited backyard space reduce your likelihood of purchasing?",
                    "options": None,
                    "rationale": "Space constraints vary by housing type; condos and townhomes have less",
                    "source_theme": "Interview personas with small patios (INT01, INT04) expressed space concerns",
                    "research_objective": "RQ3: Barrier severity — space",
                },
                {
                    "id": "Q5_financing", "type": "likert_5",
                    "text": "How much would lack of financing options reduce your likelihood of purchasing?",
                    "options": None,
                    "rationale": "Founder confirmed no financing exists yet; need to gauge demand for it",
                    "source_theme": "The Budget-Practical Family — financing is a key enabler for this segment",
                    "research_objective": "RQ3: Barrier severity — financing",
                },
                {
                    "id": "Q5_quality", "type": "likert_5",
                    "text": "How much would concerns about build quality or durability reduce your likelihood?",
                    "options": None,
                    "rationale": "The 'just a shed' perception is a recurring challenge from discovery interview",
                    "source_theme": "Client Discovery: Barriers — 'shed perception undersells build quality'",
                    "research_objective": "RQ3: Barrier severity — quality perception",
                },
                {
                    "id": "Q5_resale", "type": "likert_5",
                    "text": "How much would uncertainty about resale value reduce your likelihood?",
                    "options": None,
                    "rationale": "Property Maximizer segment views this as an investment decision",
                    "source_theme": "The Smart Investment Angle — 'comparing favorably to renovation ROI'",
                    "research_objective": "RQ3: Barrier severity — resale value",
                },
            ],
        },
        "permit_effect": {
            "id": "permit_effect",
            "label": "Permit-Light Messaging Test",
            "purpose": "Measure how permit-light positioning affects purchase likelihood",
            "questions": [
                {
                    "id": "Q7", "type": "likert_5",
                    "text": "Knowing that the Tahoe Mini is designed under 120 sq ft to minimize permit requirements, how does this affect your likelihood of purchasing?",
                    "options": None,
                    "rationale": "Permit-light is the product's key differentiator; need to quantify its impact",
                    "source_theme": "Client Discovery: Product Overview — 'the magic number is 117 sq ft'",
                    "research_objective": "RQ4: Permit-light messaging effectiveness",
                },
            ],
        },
        "concept_test": {
            "id": "concept_test",
            "label": "Concept Testing",
            "purpose": "Compare appeal of 5 positioning concepts derived from interview themes",
            "questions": [
                {
                    "id": "Q9a", "type": "likert_interest",
                    "text": "Concept 1 — Home Office: 'Your commute is 30 seconds. The Tahoe Mini gives remote workers a real office — separate from the house, free from distractions.' How appealing is this concept?",
                    "options": None,
                    "rationale": "Home office was the most frequent interview theme (n=10)",
                    "source_theme": "The Desperate Home Office",
                    "research_objective": "RQ5: Concept appeal — Home Office",
                },
                {
                    "id": "Q10a", "type": "likert_interest",
                    "text": "Concept 2 — Guest Suite / STR: 'Turn your backyard into a guest suite or Airbnb listing. The Tahoe Mini pays for itself.' How appealing?",
                    "options": None,
                    "rationale": "Guest suite has strongest ROI narrative from interviews",
                    "source_theme": "The Smart Investment Angle",
                    "research_objective": "RQ5: Concept appeal — Guest Suite",
                },
                {
                    "id": "Q11a", "type": "likert_interest",
                    "text": "Concept 3 — Wellness Studio: 'Your personal wellness sanctuary — yoga, meditation, creative practice — steps from your back door.' How appealing?",
                    "options": None,
                    "rationale": "Wellness theme emerged strongly in interviews (n=5)",
                    "source_theme": "The Wellness Sanctuary Dream",
                    "research_objective": "RQ5: Concept appeal — Wellness",
                },
                {
                    "id": "Q12a", "type": "likert_interest",
                    "text": "Concept 4 — Adventure Basecamp: 'Your gear deserves better than the garage. The Tahoe Mini is your basecamp — store, prep, and decompress.' How appealing?",
                    "options": None,
                    "rationale": "Adventure/gear storage theme captured active lifestyle segment (n=6)",
                    "source_theme": "The Gear Overflow Problem",
                    "research_objective": "RQ5: Concept appeal — Adventure",
                },
                {
                    "id": "Q13a", "type": "likert_interest",
                    "text": "Concept 5 — Simplicity: 'One day. One price. No permits in most cases. The Tahoe Mini is the simplest way to add 117 sq ft to your life.' How appealing?",
                    "options": None,
                    "rationale": "Simplicity/speed messaging resonated across all segments",
                    "source_theme": "Client Discovery: Competitive Landscape — 'speed is our strongest moat'",
                    "research_objective": "RQ5: Concept appeal — Simplicity",
                },
                {
                    "id": "Q14", "type": "single_choice",
                    "text": "Which of the five concepts above is most appealing to you overall?",
                    "options": ["Concept 1: Home Office", "Concept 2: Guest Suite", "Concept 3: Wellness", "Concept 4: Adventure", "Concept 5: Simplicity", "None"],
                    "rationale": "Forced-choice reveals which positioning should lead marketing",
                    "source_theme": "Client Discovery: Research Goals — 'which use case to lead with'",
                    "research_objective": "RQ5: Winning concept",
                },
            ],
        },
        "value_drivers": {
            "id": "value_drivers",
            "label": "Value Drivers",
            "purpose": "Measure importance of specific product features as purchase drivers",
            "questions": [
                {
                    "id": "Q15", "type": "likert_5",
                    "text": "How important is the permit-light aspect (no full building permit needed in most areas) in your purchase decision?",
                    "options": None,
                    "rationale": "Quantifies the permit-light USP's weight in purchase decisions",
                    "source_theme": "Client Discovery: Product Overview",
                    "research_objective": "RQ4: Value driver — permit-light",
                },
                {
                    "id": "Q16", "type": "likert_5",
                    "text": "How important is same-day professional installation in your purchase decision?",
                    "options": None,
                    "rationale": "One-day install is a key differentiator vs. ADUs (months) and custom builds",
                    "source_theme": "Client Discovery: Competitive Landscape — 'nothing else goes from purchase to usable in one day'",
                    "research_objective": "RQ4: Value driver — speed",
                },
                {
                    "id": "Q17", "type": "likert_5",
                    "text": "How important is build quality (steel frame, insulation, dual-pane glass) in your purchase decision?",
                    "options": None,
                    "rationale": "Addresses the 'just a shed' perception — quality must justify price premium",
                    "source_theme": "Client Discovery: Barriers — overcoming shed perception",
                    "research_objective": "RQ4: Value driver — quality",
                },
            ],
        },
        "demographics": {
            "id": "demographics",
            "label": "Demographics",
            "purpose": "Enable segment-level cross-tabulation of all survey findings",
            "questions": [
                {
                    "id": "Q21", "type": "single_choice",
                    "text": "What is your age range?",
                    "options": ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
                    "rationale": "Age is a primary segmentation variable (sweet spot is 25-54)",
                    "source_theme": "Client Discovery: Target Customer",
                    "research_objective": "Segmentation",
                },
                {
                    "id": "Q22", "type": "single_choice",
                    "text": "What is your approximate annual household income?",
                    "options": ["Under $50K", "$50K-$74,999", "$75K-$99,999", "$100K-$149,999", "$150K-$199,999", "$200K+"],
                    "rationale": "Income determines affordability; sweet spot is $75K-$200K",
                    "source_theme": "Client Discovery: Target Customer",
                    "research_objective": "Segmentation",
                },
                {
                    "id": "Q23", "type": "single_choice",
                    "text": "Which best describes your current work arrangement?",
                    "options": ["Remote full-time", "Hybrid", "On-site full-time", "Self-employed", "Retired", "Other"],
                    "rationale": "Work arrangement is the strongest predictor of home office use case demand",
                    "source_theme": "The Desperate Home Office — remote workers are the primary segment",
                    "research_objective": "Segmentation",
                },
            ],
        },
        "attention": {
            "id": "attention",
            "label": "Attention Check",
            "purpose": "Detect inattentive responses to maintain data quality",
            "questions": [
                {
                    "id": "Q30", "type": "likert_interest",
                    "text": "For quality assurance, please select 'Moderately interested' (3) for this question.",
                    "options": None,
                    "rationale": "Standard attention check — respondents who don't select 3 are flagged",
                    "source_theme": "STAMP methodology: response quality validation",
                    "research_objective": "Data quality",
                },
            ],
        },
    }


def _model_gpt_design():
    """GPT-4.1-mini's survey design — emphasizes structured measurement."""
    base = _base_sections()
    sections = [
        base["screening"],
        base["baseline"],
        base["demand"],
        base["barriers"],
        base["permit_effect"],
        base["concept_test"],
        base["value_drivers"],
        base["demographics"],
        base["attention"],
    ]
    return {
        "title": "Neo Smart Living — Tahoe Mini Market Assessment Survey",
        "estimated_duration_minutes": 8,
        "total_questions": sum(len(s["questions"]) for s in sections),
        "sections": sections,
    }


def _model_gemini_design():
    """Gemini's design — adds a sponsorship/discovery section from interview themes."""
    base = _base_sections()

    # Gemini adds a marketing channel question based on interview theme about discovery
    discovery_section = {
        "id": "discovery",
        "label": "Brand Discovery & Marketing",
        "purpose": "Understand how target customers discover home improvement products",
        "questions": [
            {
                "id": "Q18", "type": "single_choice",
                "text": "How do you typically discover new home improvement products?",
                "options": [
                    "Social media (Instagram, TikTok, Pinterest)",
                    "Google search",
                    "Home shows / expos",
                    "Word of mouth / neighbor recommendation",
                    "YouTube reviews",
                    "Home improvement stores",
                    "Other",
                ],
                "rationale": "Founder wants to optimize marketing spend; channel data is critical",
                "source_theme": "Client Discovery: Marketing Channels — Instagram and Google are current top channels",
                "research_objective": "RQ6: Marketing channel effectiveness",
            },
            {
                "id": "Q19", "type": "likert_5",
                "text": "Would brand sponsorship of outdoor/community events (trail runs, yoga sessions) positively affect your perception of a backyard structure brand?",
                "options": None,
                "rationale": "Founder is considering event sponsorship; need to gauge impact",
                "source_theme": "Client Discovery: Marketing Channels — 'sponsoring trail running events'",
                "research_objective": "RQ6: Sponsorship impact",
            },
        ],
    }

    sections = [
        base["screening"],
        base["baseline"],
        base["demand"],
        base["barriers"],
        base["permit_effect"],
        base["concept_test"],
        base["value_drivers"],
        discovery_section,
        base["demographics"],
        base["attention"],
    ]
    return {
        "title": "Neo Smart Living — Tahoe Mini Consumer Research Survey",
        "estimated_duration_minutes": 9,
        "total_questions": sum(len(s["questions"]) for s in sections),
        "sections": sections,
    }


def _model_claude_design():
    """Claude's design — adds HOA-specific questions and a price sensitivity section."""
    base = _base_sections()

    # Claude adds HOA navigation and price sensitivity based on discovery insights
    hoa_section = {
        "id": "hoa_navigation",
        "label": "HOA Navigation",
        "purpose": "Understand the HOA barrier in depth — founder's #1 challenge",
        "questions": [
            {
                "id": "Q24", "type": "single_choice",
                "text": "Is your property governed by a Homeowners Association (HOA)?",
                "options": ["Yes", "No", "I'm not sure"],
                "rationale": "HOA status is the strongest predictor of purchase barrier severity",
                "source_theme": "Client Discovery: Barriers — '40% of leads are in HOA communities'",
                "research_objective": "RQ3: HOA barrier characterization",
            },
            {
                "id": "Q25", "type": "single_choice",
                "text": "If your HOA requires approval, how would that affect your interest?",
                "options": [
                    "I would not proceed if HOA approval is needed",
                    "I would attempt the HOA process if the product came with HOA guidance",
                    "I would attempt the HOA process regardless",
                    "My HOA does not restrict backyard structures",
                    "Not applicable (no HOA)",
                ],
                "rationale": "Tests whether HOA guidance materials could convert otherwise-lost leads",
                "source_theme": "Client Discovery: Research Goals — 'how do we crack the HOA-restricted market?'",
                "research_objective": "RQ3: HOA barrier mitigation",
            },
        ],
    }

    price_section = {
        "id": "price_sensitivity",
        "label": "Price Sensitivity",
        "purpose": "Test price framing strategies identified in discovery interview",
        "questions": [
            {
                "id": "Q8a", "type": "likert_5",
                "text": "When you compare $23,000 to the cost of a full ADU ($100K+), how does this price feel?",
                "options": None,
                "rationale": "Tests the 'cheaper than an ADU' price frame",
                "source_theme": "Client Discovery: Pricing — 'the comparison isn't Tuff Shed at $5K, it's a contractor at $50K'",
                "research_objective": "RQ7: Price framing — ADU comparison",
            },
            {
                "id": "Q8b", "type": "likert_5",
                "text": "If financing were available (e.g., $400/month for 5 years), how would this affect your likelihood of purchasing?",
                "options": None,
                "rationale": "Founder is considering a financing partnership; need to gauge demand",
                "source_theme": "The Budget-Practical Family — financing is the missing enabler",
                "research_objective": "RQ7: Financing impact",
            },
        ],
    }

    sections = [
        base["screening"],
        base["baseline"],
        base["demand"],
        base["barriers"],
        base["permit_effect"],
        hoa_section,
        price_section,
        base["concept_test"],
        base["value_drivers"],
        base["demographics"],
        base["attention"],
    ]
    return {
        "title": "Neo Smart Living — Tahoe Mini Market Opportunity Assessment",
        "estimated_duration_minutes": 10,
        "total_questions": sum(len(s["questions"]) for s in sections),
        "sections": sections,
    }


def generate_test_survey_design():
    """Generate the full survey design instrument from pre-written test data."""
    designs = [
        {
            "model": "gpt-4.1-mini",
            "model_id": "test/gpt-4.1-mini",
            "design": _model_gpt_design(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        {
            "model": "gemini-2.5-flash",
            "model_id": "test/gemini-2.5-flash",
            "design": _model_gemini_design(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        {
            "model": "claude-sonnet-4",
            "model_id": "test/claude-sonnet-4",
            "design": _model_claude_design(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    ]
    return synthesize_instrument(designs)


def main():
    instrument = generate_test_survey_design()
    OUTPUT_PATH.write_text(json.dumps(instrument, indent=2, ensure_ascii=False))
    print(f"Test survey design saved to {OUTPUT_PATH}")
    print(f"  Models: {', '.join(instrument['models_used'])}")
    for model, design in instrument["designs"].items():
        print(f"  {model}: {design['total_questions']} questions, {len(design['sections'])} sections")


if __name__ == "__main__":
    main()
