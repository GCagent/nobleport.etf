"""
Weekly Content Calendar Generator for @nobleportroofs
Produces a repeatable 7-day posting schedule optimized for reach and engagement.
"""

from datetime import date, timedelta

WEEKLY_CONTENT_TEMPLATE = {
    "Monday": {
        "reel": {
            "theme": "Motivation Monday — Crew Energy",
            "format": "Crew arriving at 5AM, trucks rolling out, hype music",
            "hook_examples": [
                "While you were sleeping, we were already on the roof.",
                "5AM. No days off. This is roofing.",
                "Monday morning energy hits different on a rooftop.",
            ],
            "best_time": "6:00 AM",
        },
        "stories": [
            "7AM — Jobsite arrival timelapse",
            "10AM — Progress check poll: 'How's your Monday going?'",
            "1PM — Material delivery unboxing",
            "4PM — End of day roof reveal",
        ],
    },
    "Tuesday": {
        "reel": {
            "theme": "Transformation Tuesday — Before/After",
            "format": "Dramatic split-screen or swipe transition, drone footage",
            "hook_examples": [
                "This roof hadn't been touched in 30 years...",
                "Same house. You won't believe the difference.",
                "The neighbors couldn't believe this was the same house.",
            ],
            "best_time": "12:00 PM",
        },
        "carousel": {
            "theme": "Educational — Roof Materials Comparison",
            "slides": 7,
            "cta": "Save this for when you need a new roof",
        },
        "stories": [
            "9AM — Before shots of today's project",
            "12PM — Mid-project progress",
            "3PM — Crew spotlight: meet [crew member name]",
            "6PM — After shot teaser for tomorrow's Reel",
        ],
    },
    "Wednesday": {
        "reel": {
            "theme": "Oddly Satisfying / ASMR Install",
            "format": "Close-up nail gun shots, shingle alignment, clean ridge caps",
            "hook_examples": [
                "POV: You're a shingle about to be perfectly placed.",
                "This sound is therapy. 🔨",
                "Watch this and try not to feel satisfied.",
            ],
            "best_time": "6:00 PM",
        },
        "stories": [
            "8AM — Question box: 'What roofing questions do you have?'",
            "11AM — Answer 3 questions on camera (talking head)",
            "2PM — Behind the scenes: how we cut metal flashing",
            "5PM — Share a customer review screenshot",
        ],
    },
    "Thursday": {
        "reel": {
            "theme": "Educational — Homeowner Tips",
            "format": "Talking head on a roof or at desk, text overlay key points",
            "hook_examples": [
                "5 things your roofer will never tell you.",
                "Stop doing THIS to your roof. Seriously.",
                "Your insurance company doesn't want you to know this.",
            ],
            "best_time": "12:00 PM",
        },
        "carousel": {
            "theme": "Insurance Claims / Cost Breakdown / Scam Alert",
            "slides": 5,
            "cta": "Share this with a homeowner who needs to see it",
        },
        "stories": [
            "9AM — Poll: 'Would you DIY your roof? Yes/No'",
            "12PM — Share a DM from a happy customer",
            "3PM — Show a common roofing mistake you found on inspection",
            "7PM — Countdown to Friday's viral Reel",
        ],
    },
    "Friday": {
        "reel": {
            "theme": "Roof Fails Friday — Inspection Horrors",
            "format": "Walk up to a roof, peel back layers, reveal nightmare damage",
            "hook_examples": [
                "This family had NO idea what was above their heads.",
                "Worst. Roof. Of the week. 😳",
                "I wish I was making this up...",
            ],
            "best_time": "9:00 AM",
        },
        "stories": [
            "8AM — 'Rate this roof 1–10' poll",
            "11AM — Jobsite update, weekend prep",
            "2PM — Crew appreciation shoutout",
            "5PM — Weekend plans? We don't stop. Timelapse edit.",
        ],
    },
    "Saturday": {
        "reel": {
            "theme": "Customer Reaction / Testimonial",
            "format": "Homeowner seeing finished roof, emotional reactions, drone reveal",
            "hook_examples": [
                "Her face when she saw her new roof for the first time...",
                "This veteran's roof was leaking for 3 years. Watch what happens.",
                "'I can't believe this is my house.' 🥲",
            ],
            "best_time": "10:00 AM",
        },
        "stories": [
            "9AM — Saturday crew vibes, coffee + jobsite",
            "12PM — Share a fan DM or comment",
            "3PM — Engage: respond to this week's top comments on camera",
            "6PM — Teaser for next week's content",
        ],
    },
    "Sunday": {
        "activity": "Content Planning & Batch Editing Day",
        "tasks": [
            "Review last week's analytics — identify top 3 performing posts",
            "Plan next week's content themes and hooks",
            "Batch edit 3–5 Reels from the week's raw footage",
            "Schedule Monday–Wednesday posts using Meta Business Suite",
            "Research trending audio and competitor content",
            "Engage: comment on 30 posts from target accounts",
            "Update Story Highlights with best content from the week",
        ],
        "stories": [
            "10AM — 'What content do you want to see this week?' question box",
            "4PM — Sneak peek of next week's transformation project",
        ],
    },
}


def generate_weekly_calendar(start_date=None):
    if start_date is None:
        today = date.today()
        start_date = today - timedelta(days=today.weekday())

    calendar = {}
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    for i, day_name in enumerate(days):
        current_date = start_date + timedelta(days=i)
        template = WEEKLY_CONTENT_TEMPLATE[day_name]
        calendar[current_date.isoformat()] = {
            "day": day_name,
            "plan": template,
        }

    return calendar


VIRAL_HOOKS_BANK = {
    "curiosity": [
        "Nobody talks about this roofing problem...",
        "I've been roofing for 15 years and I've NEVER seen this.",
        "This is why your roof is failing and you don't even know it.",
        "We pulled back the shingles and found THIS.",
        "Your roofer is lying to you. Here's proof.",
    ],
    "transformation": [
        "3 days. 1 crew. Unrecognizable.",
        "This house went from condemned to dream home.",
        "Before and after that made our crew emotional.",
        "The realtor said 'tear it down.' We said 'hold on.'",
        "90 days later, same house, $200K more value.",
    ],
    "emotional": [
        "She cried when she saw her new roof.",
        "This veteran hasn't had a dry ceiling in 4 years.",
        "We surprised this single mom with a free roof.",
        "His insurance denied him 3 times. We didn't give up.",
        "This family was about to lose their home over a leaking roof.",
    ],
    "educational": [
        "The #1 mistake homeowners make with their roof.",
        "Here's exactly what a $15,000 roof looks like.",
        "Metal vs shingle: the truth nobody tells you.",
        "How to tell if your roofer is scamming you in 30 seconds.",
        "3 things to check on your roof RIGHT NOW.",
    ],
    "satisfying": [
        "Watch this perfect ridge cap installation.",
        "The most satisfying tear-off you'll see today.",
        "POV: laying 40 squares of architectural shingles.",
        "This copper flashing install is pure art.",
        "Clean lines, clean cuts, clean roof. 🤌",
    ],
}
