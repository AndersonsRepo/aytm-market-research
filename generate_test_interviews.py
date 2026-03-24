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


FOLLOWUP_TEMPLATES = {
    "remote-worker": {
        "IQ1": ["You mentioned you mostly see it through the window — do you ever feel like you're missing out on the space you're paying for?",
                "It sounds like there's some guilt about the backyard sitting unused. Has that changed your thinking about how you use your home overall?"],
        "IQ2": ["You mentioned noise as a big issue. How does that affect your actual work productivity day-to-day?",
                "When you say 'desperately need' — have you looked at any temporary solutions? What happened?"],
        "IQ3": ["What specifically about the permit process worried you? Was it the paperwork, the cost, or something else?",
                "You got a quote for $40K+ — what made that feel unreasonable? Was it the number itself or the value-for-money?"],
        "IQ4": ["You mentioned the 30-second commute — is that separation more about physical space or mental transition?",
                "The standing desk and dual monitors — do you already have those set up somewhere else right now?"],
        "IQ5": ["You said you eat lunch at your desk and check emails in the evening — has that gotten worse over time or was it always this way?",
                "That 'headphones as a signal' approach — does it actually work, or do people still interrupt?"],
        "IQ6": ["You mentioned soundproofing as a priority — have you priced soundproofing separately for an existing room? How does that compare?",
                "The permit-light aspect — is that relief about the process itself, or more about the timeline?"],
        "IQ7": ["When you say you'd want to see one in person — what specifically would you be looking for? Build quality, size, aesthetics?",
                "You mentioned financing — what monthly payment range would feel comfortable for something like this?"],
        "IQ8": ["You said word of mouth from someone who actually has one would be most convincing — do you know anyone in your network who has a backyard structure?",
                "Work-from-home forums — are those a place you actively spend time, or more occasional browsing?"],
    },
    "active-lifestyle": {
        "IQ1": ["When you say it's 'chaotic' — is that a source of stress for you, or do you kind of love the controlled chaos?",
                "You mentioned hosing off gear — does your current setup actually work for that, or is it a pain point?"],
        "IQ2": ["Your car can't fit in the garage anymore — at what point did that happen, and has it caused any actual problems?",
                "When you say your family is 'over it' — have they given you an ultimatum, or is it more of a slow burn?"],
        "IQ3": ["You started building a shed and ran out of motivation — what specifically killed the momentum?",
                "When you say 'turnkey' — is the installation the main appeal, or is it more about not having to make design decisions?"],
        "IQ4": ["A post-ride beer fridge in the workshop — is this structure more about function or is it also a social space for you?",
                "You mentioned hanging out with friends after rides. How many people would this space realistically need to hold?"],
        "IQ5": ["You said the gear takes over the house — can you give me an example of a recent 'incident' where that was a problem?",
                "Activity space vs. work space — do you think most products in this category miss that distinction?"],
        "IQ6": ["You asked about customizing the interior — what's the minimum you'd need in terms of flooring and wall mounts?",
                "120 sq ft concern — have you measured your current gear footprint? Do you have a sense of how much space you actually need?"],
        "IQ7": ["You said if it 'feels too delicate' you'd skip it — what would delicate look like to you? What are the warning signs?",
                "Financing is important — is this a savings vs. credit decision, or more about monthly budget impact?"],
        "IQ8": ["You said you'd stop and look at a mountain bike event — have you ever actually bought something from an event sponsor?",
                "Your riding crew as word-of-mouth — do they tend to influence each other's home improvement decisions too?"],
    },
    "wellness": {
        "IQ1": ["You mentioned hearing the neighbors — is privacy the main barrier to using your backyard for wellness, or is it something else?",
                "Morning meditation in the backyard — how often does that actually happen vs. how often you'd like it to?"],
        "IQ2": ["You said a separate space would be 'transformative for mental health' — can you unpack that? What would specifically change?",
                "When you say every room is competing — is this about physical space or emotional energy?"],
        "IQ3": ["Your Pinterest board dream — how long has that been there? What keeps you going back to look at it?",
                "The $30K-$50K quotes — did you try to negotiate or find cheaper alternatives after that?"],
        "IQ4": ["A little altar for meditation — how important is the aesthetic of the space vs. the functionality?",
                "You said 'consistent instead of sporadic' — what breaks your current practice routine most often?"],
        "IQ5": ["You said the issue isn't work boundaries but having space for YOU — when did you last feel like you had that?",
                "Everything being shared or multipurpose — is this about negotiating with family, or is it a design limitation of your home?"],
        "IQ6": ["You asked about making it feel warm and not industrial — what aesthetic specifically are you imagining?",
                "Hot yoga in SoCal heat — that's a specific use case. How often would you realistically use it for that?"],
        "IQ7": ["When you say 'not a shed' — is this about your own perception or how others would see it?",
                "Testimonials from wellness users — how would that change your confidence vs. seeing office-focused marketing?"],
        "IQ8": ["Farmers markets and yoga festivals — do you associate brands with values when you see them in those spaces?",
                "You trust your wellness community — is that an online community or local/in-person relationships?"],
    },
    "investment": {
        "IQ1": ["You think of your property as an investment portfolio — do you track your property value regularly?",
                "Every improvement should add value — have there been improvements you regret from an ROI perspective?"],
        "IQ2": ["You mentioned Airbnb potential — have you actually looked into local regulations for short-term rental in your area?",
                "Aging parents as a use case — is that a near-term reality or more of a future contingency plan?"],
        "IQ3": ["The $100K+ ADU cost — at what price point would an ADU have been worth it to you?",
                "You said you've been 'waiting for a better option' — how long have you been looking, and what else have you considered?"],
        "IQ4": ["You mentioned Airbnb at $75/night — have you done any research on what similar listings go for in your area?",
                "The 'pays for itself in two years' math — is ROI the primary decision driver, or would you use it yourself too?"],
        "IQ5": ["You said this is purely about maximizing property value — would you still buy it if it didn't increase your home's appraised value?",
                "The untapped opportunity — have you gotten an appraiser's opinion on what backyard improvements actually add value?"],
        "IQ6": ["Quality at that price point — what specifically worries you? Materials, longevity, or fit and finish?",
                "Can it appraise as added living space — have you asked your real estate agent about that specifically?"],
        "IQ7": ["Property value impact data — what format would be most convincing? Comps, appraiser letters, or before/after case studies?",
                "Financing at reasonable rates — what rate would make this a clear 'yes' for you?"],
        "IQ8": ["Real estate agent recommendations — do you already have an agent you trust? Would their endorsement carry that much weight?",
                "You said 'show me the numbers' — what numbers specifically would seal the deal?"],
    },
    "practical-value": {
        "IQ1": ["When you say 'nothing fancy' — is that contentment or resignation? Would you do more if budget weren't a factor?",
                "The backyard feels like an afterthought — is that because of the space itself, or because you haven't had time/money to invest?"],
        "IQ2": ["Storage, storage, storage — if you could only solve one storage problem, which room or item category would you tackle first?",
                "Arguments about shared space — can you give me a recent example of how that plays out?"],
        "IQ3": ["Costco sheds — what specifically about them felt flimsy? Was it in person or online?",
                "No skills or time for DIY — do you wish you could, or do you genuinely prefer someone else to handle it?"],
        "IQ4": ["A multipurpose room — if you had to pick ONE primary use, what wins? Your hobbies, kids' space, or storage?",
                "Leaving things set up without cleaning up — is that the main appeal? What do you currently have to pack away each time?"],
        "IQ5": ["Life-life balance — interesting phrase. Is the bigger tension between you and your partner, you and kids, or all of the above?",
                "Not enough corners in the house — have you considered any interior rearrangement, or is it truly a square footage problem?"],
        "IQ6": ["You winced at the price — what's the max you'd pay without hesitation? Is there a number that feels more comfortable?",
                "Financing is the key — do you typically finance home improvements, or is this one different because of the amount?"],
        "IQ7": ["$200-300/month — is that based on a specific budget calculation, or just a gut feel of what's manageable?",
                "Not a museum piece — that's a strong phrase. What kind of wear and tear are you anticipating?"],
        "IQ8": ["A neighbor having one as the best marketing — have you ever asked a neighbor about a home product they have?",
                "Price and value drive your decisions — between those two, which one wins if they conflict?"],
    },
}

FOLLOWUP_RESPONSE_TEMPLATES = {
    "remote-worker": {
        "IQ1": ["Yeah, absolutely. I'm paying Bay Area-adjacent prices for this property and barely touching the backyard. It's wasted potential that nags at me every time I look outside during a meeting.",
                "It's definitely changed how I think about home. I used to see it as just living space but now it's also office space, and neither function works well. The backyard is the only unused capacity."],
        "IQ2": ["It's brutal honestly. I lose probably 20 minutes every time someone interrupts a call. And the mental cost of context-switching is even worse. I've started wearing noise-canceling headphones all day.",
                "I tried a room divider and a white noise machine. The divider looked terrible and the white noise wasn't enough. This is fundamentally a walls-and-a-door problem."],
        "IQ3": ["Honestly, the timeline scared me most. The idea of dealing with city planning for weeks while I'm trying to meet deadlines at work — I just couldn't take that on.",
                "The number itself was fine if it truly added value. But $40K for a shed that might or might not be what I need, with unknown timelines? The risk-to-reward felt off."],
        "IQ4": ["It's both, but the mental transition is bigger. When I 'leave' for work by walking to a separate building, my brain shifts gears. That's the magic. The physical separation creates the mental boundary.",
                "Yeah, I have them crammed into the guest bedroom right now. The ergonomics are terrible and I can't close the door because we need the room for actual guests sometimes."],
        "IQ5": ["It's definitely gotten worse. When I first started remote in 2020, I was disciplined. Now the lines have completely blurred. I'll be cooking dinner and answering Slack messages. It's unsustainable.",
                "It works maybe 50% of the time. Kids under 8 don't really understand headphone signals. My partner tries to respect it but urgent things come up. It's a band-aid, not a solution."],
        "IQ6": ["I actually looked into adding soundproofing to the guest room — about $3K-5K and it would still be a shared room. For $23K I'd get a dedicated, purpose-built space. The math actually favors this.",
                "Mostly the timeline. I've heard permit horror stories from neighbors — 3-6 month waits, plan revisions, inspections. If this truly avoids most of that, it removes the biggest friction."],
        "IQ7": ["Build quality primarily. I'd be looking at wall thickness, window seals, the flooring. Does it feel like a real room or a glorified tent? I'd literally knock on the walls.",
                "I could swing $350-400/month over 5 years without stress. Under $300 would make it an easy yes. The key is whether financing is built in or I'd need to find my own."],
        "IQ8": ["No, actually. I don't know anyone with one, which is part of the problem. If I could visit someone's and spend 30 minutes working from it, I'd have my answer immediately.",
                "I'm on r/remotework and a few Slack communities daily. Those are genuinely where I get product recommendations. A real user posting their setup there would go viral."],
    },
    "active-lifestyle": {
        "IQ1": ["Honestly? I kind of love it. But my partner absolutely does not. It's become a negotiation point. The chaos is fine for me but it's objectively not a great living situation for two people.",
                "It works but it's hacky. I'm literally hosing off gear on the lawn and leaning bikes against the house. A proper wash station and storage area would make a huge difference."],
        "IQ2": ["It happened gradually and then all at once. I got a new mountain bike last year and suddenly there was literally no room. Now I park outside. In a neighborhood where I shouldn't be parking outside.",
                "It's more of a slow burn with occasional flare-ups. Like when I left muddy cycling shoes in the hallway and got 'the look.' We need a proper solution before it becomes a real fight."],
        "IQ3": ["Weekend two. I spent the first weekend excited and motivated. The second weekend it rained, I got behind, and then life took over. It sat half-built for three months before I tore it down.",
                "Both honestly. I don't want to spend months deciding on dimensions and materials. Give me a solid product, drop it in my yard, and let me fill it with gear. Simple."],
        "IQ4": ["It starts as function but it would absolutely become social. After rides, we always need somewhere to hang out and talk about the ride. Right now that's the driveway. A proper basecamp would be the move.",
                "Realistically? Me plus 2-3 friends comfortably. We're not hosting parties in there. Just enough room to work on bikes, store gear, and hang out. Four people max."],
        "IQ5": ["Last month I had three bikes, a surfboard, and a box of camping gear in the living room because I was 'organizing.' My partner took a photo and sent it to me with just a sad face emoji.",
                "Totally. Every backyard structure I see marketed is a beautiful home office with a MacBook and a plant. That's not me. Show me a dirty workshop with bikes hanging from the ceiling."],
        "IQ6": ["At minimum: heavy-duty rubber or composite flooring, four to six heavy-duty wall hooks, and at least one workbench surface. Basically industrial, not decorative.",
                "I actually measured once — my bikes alone take up about 40 sq ft laid out, plus the workbench takes 15. 120 sq ft would be tight but workable if I use vertical space well."],
        "IQ7": ["If the walls flex when you push on them. If the floor shows scratches after a month. If it feels like it was designed for a yoga mat, not a bike stand. I'd know in the first 30 seconds.",
                "Monthly budget impact. I already spend $200/month on cycling-related stuff so I'd need to feel like this replaces some other expense. Total monthly outlay matters more than the sticker price."],
        "IQ8": ["Actually yes — I bought my current helmet from a brand I first saw at a trail race. Event sponsorship works on me if it's authentic and in my world.",
                "Absolutely. If one of my riding buddies got one, we'd all want to see it. And if it passed the 'real use' test, half the group would probably order one within six months."],
    },
    "wellness": {
        "IQ1": ["It's the main barrier. I can hear my neighbor's TV and their kids playing. For meditation you need quiet. Real quiet. Even the sounds of the street pull me out of my practice.",
                "Honestly? Maybe once a week successfully. I want it to be daily but the conditions have to be perfect — quiet, right temperature, no one home. That's maybe one morning a week."],
        "IQ2": ["I think my anxiety would genuinely decrease. Right now I carry tension from never having a space that's mine. My nervous system never fully relaxes at home. A sanctuary would change that baseline.",
                "It's emotional energy. Even when a room is 'available,' it doesn't feel like mine. There's always someone else's stuff, someone else's schedule. I need a space that's psychologically mine."],
        "IQ3": ["Three years. I still add pins to it. It's this aspirational board of bamboo floors and floor-to-ceiling windows and hanging plants. Every time I add something, it reminds me I haven't done it yet.",
                "I asked about smaller structures but everyone wanted to upsell me to a full ADU. Nobody was interested in building a simple 100 sq ft wellness space. The market gap is real."],
        "IQ4": ["Honestly? Equally important. The aesthetics ARE the functionality for wellness. A beautiful space calms your nervous system before you even start practicing. An ugly space would work against the purpose.",
                "The dog, the phone, meal prep, my partner wanting to talk. If I had a physical door between me and all of that, I could actually commit to 30 minutes daily instead of skipping 4 out of 5 days."],
        "IQ5": ["Honestly, not since before the pandemic. I had a brief period in 2019 when the kids were in school and the house was empty for a few hours. That was the last time I felt like I had true space.",
                "Both. The home wasn't designed for this many needs. But also, rearranging furniture doesn't create walls. What I need is a physically separate space with a door I can close and lock."],
        "IQ6": ["Natural materials, warm lighting, earth tones. Think Japanese minimalism meets California boho. Not chrome and white plastic. I'd want to feel grounded the moment I step inside.",
                "In peak summer? Probably 3-4 times a week if the AC works. I practice Bikram-style occasionally but really it's about having a temperature-controlled sanctuary year-round, not just hot yoga."],
        "IQ7": ["My own perception. A shed feels like storage. A retreat feels like self-care. The language, the design, the experience — it all needs to say 'you're worth this investment.' I'm buying a feeling.",
                "Hugely. Right now I see this product and think 'that could be my office.' I'd buy it for wellness but I need to see someone using it that way. Representation matters in marketing."],
        "IQ8": ["Absolutely. When I see a brand at a yoga festival, I assume they share my values — sustainability, community, wellbeing. That creates instant trust that no ad can replicate.",
                "Both. I have a local yoga studio community and I'm in several online wellness groups. Both are influential but the in-person relationships carry more weight for big purchases."],
    },
    "investment": {
        "IQ1": ["I check Zillow and Redfin monthly. I know my property has appreciated 40% since purchase. Every dollar I spend on improvements, I think about in terms of what it adds to that number.",
                "One — the koi pond. Cost $8K and adds zero resale value. My wife loves it, so it stays, but I learned my lesson. Now everything has to pass the ROI test."],
        "IQ2": ["I have, actually. My area allows them but with a 60-day minimum stay requirement. That changes the math significantly. I'd need to think about it differently — more long-term rental than Airbnb.",
                "Near-term. My mother-in-law's health is declining and we're looking at options for the next 2-3 years. An in-law suite alternative at $23K vs. $100K for an ADU is very compelling."],
        "IQ3": ["Honestly? Around $50K with a guaranteed 6-month timeline and clear permits. The value is there but the execution risk was too high at $100K with uncertain timelines.",
                "About 18 months seriously. I've looked at container homes, prefab ADUs, garage conversions. Everything is either too expensive, too complicated, or too ugly."],
        "IQ4": ["I've looked. Studios and guest houses in my area rent for $1,200-$2,500/month long-term. Even at the low end, the ROI timeline on $23K is outstanding compared to any other home improvement.",
                "I'd use it too — as a home office initially, then convert to rental when I retire. The dual-use potential is what makes it smart. Pure rental play would also work, but flexibility is the real value."],
        "IQ5": ["Honestly? Probably not. The pure lifestyle value doesn't justify $23K for me. But if it adds $40-50K in property value AND I get to use it? That's a completely different calculation.",
                "My agent said ADUs add the most value, but at 10x the cost. She hasn't had a client with one of these smaller structures yet. First-mover risk, but also first-mover opportunity."],
        "IQ6": ["Materials primarily. At $23K I need to know what I'm getting. What's the framing? Insulation R-value? Roofing material? Warranty on structural components? I'd want a spec sheet.",
                "Not yet, but I should. My gut says it wouldn't appraise as living space since it's under 120 sq ft, but it would add 'amenity value.' I'd want clarity on that before committing."],
        "IQ7": ["Before/after case studies with actual appraisal numbers. 'Homeowner X installed this, property value increased by Y%.' That's the gold standard. Comps are helpful but case studies sell.",
                "Under 6% APR makes it a no-brainer. At 8-10% I'd pay cash if I have it. Above 10% I'd wait for a better deal. The financing terms could make or break this for the mass market."],
        "IQ8": ["Yes — she's sold us two houses and manages a rental property for us. If she said 'this adds value, buy it,' I'd have it installed next week. Agent endorsement is my cheat code.",
                "ROI data, rental income projections, and property value impact. If you can show me it pays for itself in 24 months, I'll buy it today. That's not hyperbole."],
    },
    "practical-value": {
        "IQ1": ["If I'm honest? Resignation mostly. We'd love a nicer backyard but between the mortgage and the kids, there's always something more urgent. The backyard keeps getting pushed to 'next year.'",
                "Both really. The space is small and we haven't invested in it. But even with investment, I'm not sure what we'd do with 15x20 feet. It's genuinely limited."],
        "IQ2": ["The garage. Without question. If I could get the holiday decorations, camping gear, and bikes out of the garage, we'd reclaim usable space. Everything cascades from that one bottleneck.",
                "Last week my partner wanted to do a puzzle but the table was covered in my craft supplies. So the puzzle went on the couch. Then there was nowhere to sit. It's like a space Tetris that never ends."],
        "IQ3": ["In person at Costco. I tapped on the walls and they flexed. The floor was thin plywood. For $2K it's fine, but it wouldn't survive my kids or real weather. You get what you pay for.",
                "I'd genuinely prefer turnkey. I have exactly zero free weekends and the thought of a DIY project gives me anxiety. I'd pay a premium for 'show up, install it, leave.'"],
        "IQ4": ["Kids' space, if I'm being selfless. My hobbies, if I'm being honest. In practice it would probably be 60% kids stuff and 40% my projects, and I'd be fine with that.",
                "My sewing machine lives in a closet. I pull it out, set up on the dining table, and pack everything away before dinner. Every single time. Having it permanently set up would save hours a week."],
        "IQ5": ["All of the above but the kids drive most of it. They need space for homework, play, and their stuff. We need space for adulting. Nobody has enough room and everyone compromises.",
                "We've tried rearranging three times. The problem is we have three bedrooms for four people and none of them are big enough for dual purpose. It's fundamentally a square footage issue."],
        "IQ6": ["Without hesitation? Probably $15K. That feels proportional to what we'd pay for other home improvements. $23K isn't impossible but it's in 'let me think about it for three months' territory.",
                "We finance everything over $2K typically — appliances, car repairs, that kind of thing. This would be the biggest single purchase we've financed for the home, so the terms really matter."],
        "IQ7": ["Gut feel based on our monthly budget. We have about $500/month discretionary after bills and savings. $200-300 leaves room for life to happen. $400 would feel tight.",
                "Real wear and tear. Kids running in and out, craft supplies everywhere, maybe a dog bed in the corner. I need to know the floor can handle dirt, spills, and foot traffic without looking destroyed in a year."],
        "IQ8": ["Actually yes. Our neighbors got a hot tub last year and we walked over to see it the first week. If they had one of these structures, we'd be over there within a day asking questions.",
                "Price wins every time. I'll sacrifice some style for a better price point. But value means durability too — if a cheaper option falls apart in 3 years, the expensive one was actually the better value."],
    },
}


def generate_test_transcript(persona, model_label):
    """Generate one test interview transcript with multi-turn follow-ups."""
    rng = random.Random(hash((persona["persona_id"], model_label, "test_interview")))
    tendency = assign_tendency(persona)
    profile = TENDENCIES[tendency]
    followup_qs = FOLLOWUP_TEMPLATES.get(tendency, {})
    followup_rs = FOLLOWUP_RESPONSE_TEMPLATES.get(tendency, {})

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
        "num_turns": 17,
    }

    for key in ["IQ1", "IQ2", "IQ3", "IQ4", "IQ5", "IQ6", "IQ7", "IQ8"]:
        templates = profile[key]
        template = rng.choice(templates)
        row[key] = fill_slots(template, persona, rng)

        # Follow-up question and response
        fq_templates = followup_qs.get(key, ["Can you tell me more about that?"])
        fr_templates = followup_rs.get(key, ["I think I've covered the main points. It really comes down to making the space work for our situation."])
        row[f"{key}_followup_question"] = rng.choice(fq_templates)
        row[f"{key}_followup_response"] = fill_slots(rng.choice(fr_templates), persona, rng)

    # Additional thoughts
    templates = profile["additional_thoughts"]
    row["additional_thoughts"] = fill_slots(rng.choice(templates), persona, rng)

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
    followup_sentiments = []
    for q in ["IQ1", "IQ2", "IQ3", "IQ4", "IQ5", "IQ6", "IQ7", "IQ8"]:
        score = baselines[q] + rng.gauss(0, 0.15)
        score = max(-1.0, min(1.0, round(score, 4)))
        analysis_row[f"sentiment_{q}"] = score
        sentiments.append(score)

        # Follow-up sentiment — slightly more extreme (follow-ups go deeper)
        fu_score = baselines[q] * 1.2 + rng.gauss(0, 0.12)
        fu_score = max(-1.0, min(1.0, round(fu_score, 4)))
        analysis_row[f"sentiment_{q}_followup"] = fu_score
        followup_sentiments.append(fu_score)

    overall = round(sum(sentiments) / len(sentiments), 4)
    analysis_row["sentiment_overall"] = overall
    all_scores = sentiments + followup_sentiments
    analysis_row["sentiment_combined"] = round(sum(all_scores) / len(all_scores), 4)
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
    # 3-way interleaved model assignment: GPT, Gemini, Claude
    model_ids = ["openai/gpt-4.1-mini", "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.6"]

    transcript_rows = []
    analysis_rows = []
    tendency_map = {}

    for i, persona in enumerate(INTERVIEW_PERSONAS):
        model_id = model_ids[i % 3]
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


def generate_all_test_data():
    """Generate all test interview data and return stats dict (for demo.py)."""
    main()
    import pandas as pd
    df = pd.read_csv(OUTPUT_DIR / "interview_analysis.csv")
    themes = json.loads((OUTPUT_DIR / "interview_themes.json").read_text())
    return {
        "n_interviews": len(df),
        "n_themes": len(themes.get("llm_themes", [])),
        "models": sorted(df["model"].unique().tolist()),
    }


if __name__ == "__main__":
    main()
