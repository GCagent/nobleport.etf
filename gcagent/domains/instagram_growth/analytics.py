"""
Analytics & KPI Tracking for @nobleportroofs Instagram Growth
"""

TRACKING_FRAMEWORK = {
    "daily_metrics": [
        "follower_count",
        "profile_visits",
        "website_clicks",
        "reach",
        "impressions",
        "stories_views",
    ],
    "per_post_metrics": [
        "views",
        "likes",
        "comments",
        "shares",
        "saves",
        "reach",
        "watch_time_avg",
        "completion_rate",
    ],
    "weekly_metrics": [
        "follower_growth_rate",
        "engagement_rate",
        "top_performing_content_type",
        "best_posting_time",
        "story_completion_rate",
        "dms_received",
        "leads_generated",
    ],
    "monthly_metrics": [
        "total_follower_gain",
        "viral_posts_count",
        "revenue_attributed_to_ig",
        "brand_deal_inquiries",
        "email_signups_from_ig",
        "cost_per_follower_if_paid",
    ],
}

GROWTH_MILESTONES = [
    {"followers": 1_000, "unlock": "Link in Stories (already available to all)", "timeline": "Month 1"},
    {"followers": 5_000, "unlock": "Brand partnership eligibility begins", "timeline": "Month 2"},
    {"followers": 10_000, "unlock": "Credibility threshold, micro-influencer status", "timeline": "Month 3"},
    {"followers": 25_000, "unlock": "Paid partnership opportunities open up", "timeline": "Month 5"},
    {"followers": 50_000, "unlock": "Significant local authority, speaking invites", "timeline": "Month 7"},
    {"followers": 100_000, "unlock": "Verified badge eligible, national brand deals", "timeline": "Month 8–10"},
    {"followers": 250_000, "unlock": "Industry thought leader status, course launch viable", "timeline": "Month 12"},
    {"followers": 500_000, "unlock": "Major media attention, franchise/licensing inquiries", "timeline": "Month 18"},
    {"followers": 800_000, "unlock": "Category king — top roofing account in the US", "timeline": "Month 20–24"},
]

ENGAGEMENT_RATE_FORMULA = """
Engagement Rate = (Likes + Comments + Shares + Saves) / Reach * 100

Benchmarks for roofing/construction niche:
- Excellent: 6%+
- Good: 4–6%
- Average: 2–4%
- Needs work: <2%

NOTE: As follower count grows, engagement rate naturally decreases.
At 800K, maintaining 3%+ engagement is exceptional.
"""

ALGORITHM_SIGNALS_RANKED = [
    {"signal": "Shares (Send to friend)", "weight": "Highest", "tactic": "Create 'tag someone who needs to see this' content"},
    {"signal": "Saves", "weight": "Very High", "tactic": "Educational carousels, checklists, cost breakdowns"},
    {"signal": "Watch Time / Completion Rate", "weight": "Very High", "tactic": "Hook in 0.5s, keep Reels 15–30s, loop endings"},
    {"signal": "Comments", "weight": "High", "tactic": "Ask questions, use controversial takes, polls"},
    {"signal": "Profile Visits after viewing", "weight": "High", "tactic": "End with 'Follow for more roof content'"},
    {"signal": "Follows from content", "weight": "High", "tactic": "Make every Reel a standalone value piece"},
    {"signal": "Likes", "weight": "Medium", "tactic": "Emotional content, satisfying visuals"},
    {"signal": "Time on post (Carousels)", "weight": "Medium", "tactic": "Dense carousels with 7–10 slides"},
]

COMPETITOR_BENCHMARKS = {
    "top_roofing_accounts": [
        {"handle": "@dirtyroofing", "followers": "400K+", "strength": "Humor + transformation Reels"},
        {"handle": "@roofclaim", "followers": "200K+", "strength": "Educational + insurance content"},
        {"handle": "@baker_roofing", "followers": "50K+", "strength": "Professional brand, crew culture"},
    ],
    "lessons": [
        "Humor and personality drive follows more than pure education",
        "Before/after content consistently outperforms all other formats",
        "Crew culture content builds loyalty and repeat engagement",
        "Storm content spikes are massive — always be ready to film",
        "Consistency (daily posting) matters more than production quality",
    ],
}


def calculate_engagement_rate(likes, comments, shares, saves, reach):
    if reach == 0:
        return 0.0
    return round((likes + comments + shares + saves) / reach * 100, 2)


def project_growth(current_followers, monthly_growth_rate, months):
    projections = []
    followers = current_followers
    for month in range(1, months + 1):
        followers = int(followers * (1 + monthly_growth_rate))
        projections.append({"month": month, "projected_followers": followers})
    return projections
