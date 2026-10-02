"""Wedding Agent, phase 1-2: envelope, allocation, search, shortlist, availability, scoring, top picks.

Code does the exact work (money, filtering, scoring). The LLM only interprets the couple's
priorities and writes the plain-English summary, and the agent still runs if the LLM is unavailable.
The endpoint is stateless: the app sends the plan and gets the full run back.
"""
import hashlib

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from llm import chat_json, chat_text, llm_ready
from vendor_db import estimate_cost, vendors_in_city

router = APIRouter()

CONTINGENCY = 0.05  # kept aside for surprises: never allocated to a category
STRETCH = 1.25      # up to 25% over a category's allocation is a "stretch"; more is "over"

BASE_WEIGHTS = {
    "catering": 0.30, "attire": 0.15, "decoration": 0.12, "photography": 0.10, "hotels": 0.10,
    "transport": 0.08, "music": 0.06, "gifts": 0.05, "logistics": 0.04,
}
LABELS = {
    "catering": "Catering", "attire": "Attire", "decoration": "Decoration", "photography": "Photography",
    "hotels": "Venue", "transport": "Transport", "music": "Music", "gifts": "Gifts", "logistics": "Logistics",
}


class ScheduleDay(BaseModel):
    date: str
    rituals: list[str] = []


class PlanIn(BaseModel):
    name: str = ""
    partnerName: str = ""
    date: str = ""
    location: str
    budget: int
    guestCount: int
    rituals: list[str] = []
    schedule: list[ScheduleDay] = []
    creativeDirector: bool = False


class RunIn(BaseModel):
    plan: PlanIn
    objective: str = ""
    completed: list[str] = []  # categories the couple has already finished themselves: the agent leaves them alone


def inr(n: float) -> str:
    """Indian digit grouping: 1425000 -> ₹14,25,000."""
    s = str(int(round(n)))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts) + "," + tail
    return "₹" + s


# ── Step 1: envelope ────────────────────────────────────────────────────────────

def prefer_real(pool: list[dict], minimum: int = 3) -> list[dict]:
    """Where OpenStreetMap gives at least `minimum` real listings in a category, use only those; otherwise add sample vendors to fill the gap."""
    out = []
    for cat in {v["category"] for v in pool}:
        rows = [v for v in pool if v["category"] == cat]
        real = [v for v in rows if v["source"] == "osm"]
        out += real if len(real) >= minimum else rows
    return out


def make_envelope(budget: int, guests: int) -> dict:
    reserve = round(budget * CONTINGENCY / 1000) * 1000
    per_guest = budget / max(1, guests)
    if per_guest < 3500:
        level, msg = "very_tight", "This is very tight per guest. Expect a simple celebration; a premium look will not be realistic across every event."
    elif per_guest < 6500:
        level, msg = "tight", "This is tight for a premium look. It is achievable by spending where guests see it (decor, photography, venue) and staying lean on the rest."
    elif per_guest < 12000:
        level, msg = "comfortable", "This is a comfortable budget for a polished wedding."
    else:
        level, msg = "generous", "This is a generous budget; premium choices are realistic across most categories."
    return {
        "total": budget, "reserve": reserve, "allocatable": budget - reserve,
        "perGuest": round(per_guest), "level": level, "message": msg,
    }


# ── Reading the couple's priorities (LLM, with a safe default) ───────────────────

def read_preferences(objective: str) -> tuple[dict, bool]:
    default = {"premium_look": 0.5, "strict_budget": True, "priorities": [], "notes": ""}
    if not objective.strip() or not llm_ready():
        return default, False
    try:
        data = chat_json(
            "You read a bride or groom's wedding goals and extract planning preferences. Fields: "
            '"premium_look" (number 0 to 1: how much they want an upscale look), '
            '"strict_budget" (true if they must not exceed the budget), '
            '"priorities" (list, only from: catering, attire, decoration, photography, hotels, transport, music, gifts, logistics), '
            '"notes" (max 15 words).',
            objective,
        )
    except Exception:
        return default, False
    if not data:
        return default, False
    try:
        prefs = {
            "premium_look": min(1.0, max(0.0, float(data.get("premium_look", 0.5)))),
            "strict_budget": bool(data.get("strict_budget", True)),
            "priorities": [c for c in data.get("priorities", []) if c in BASE_WEIGHTS],
            "notes": str(data.get("notes", ""))[:120],
        }
    except (TypeError, ValueError):
        return default, False
    return prefs, True


# ── Step 2: category allocation ──────────────────────────────────────────────────

def allocate(allocatable: int, prefs: dict, guests: int, creative_director: bool) -> dict[str, int]:
    w = dict(BASE_WEIGHTS)
    if guests > 400:
        w["catering"], w["attire"], w["hotels"] = 0.35, 0.12, 0.08
    elif guests < 100:
        w["catering"], w["attire"], w["photography"] = 0.22, 0.18, 0.14
    p = prefs["premium_look"]
    w["decoration"] *= 1 + 0.5 * p
    w["photography"] *= 1 + 0.4 * p
    w["hotels"] *= 1 + 0.3 * p
    w["catering"] *= 1 - 0.1 * p
    w["transport"] *= 1 - 0.3 * p
    w["gifts"] *= 1 - 0.3 * p
    w["logistics"] *= 1 - 0.2 * p
    if creative_director:
        w["decoration"] *= 1.1
    for c in prefs["priorities"]:
        w[c] *= 1.25
    total = sum(w.values())
    alloc = {c: int(round(allocatable * x / total / 1000) * 1000) for c, x in w.items()}
    alloc["catering"] += allocatable - sum(alloc.values())  # absorb rounding drift
    return alloc


# ── Step 6: availability (simulated calendar) ────────────────────────────────────

def busy_dates(vendor: dict, dates: list[str]) -> list[str]:
    """Deterministic fake calendar: better-rated vendors are busier. Real calendars arrive with vendor onboarding."""
    if vendor["source"] == "osm":
        return []  # unknown: we never pretend to know a real business's calendar
    pct = 10 + (vendor["rating"] - 4.0) * 25
    return [d for d in dates if int(hashlib.md5(f"{vendor['id']}:{d}".encode()).hexdigest(), 16) % 100 < pct]


# ── Step 7: scoring ──────────────────────────────────────────────────────────────

def score_weights(prefs: dict) -> dict[str, float]:
    w = {"price_fit": 0.40 if prefs["strict_budget"] else 0.30, "quality": 0.15, "reliability": 0.15, "premium": 0.10 + 0.25 * prefs["premium_look"],
         "distance": 0.08, "response": 0.07}
    t = sum(w.values())
    return {k: v / t for k, v in w.items()}


def score_vendor(v: dict, cost: int, alloc: int, weights: dict) -> tuple[int, dict]:
    unknown = 0.5  # real listings have no rating, reliability or response data: neutral, not invented
    parts = {
        "price_fit": 1.0 if cost <= alloc else max(0.0, 1 - (cost - alloc) / max(1, alloc)),
        "quality": (unknown if v.get("listing_score") is None else (v["listing_score"] - 35) / 60) if v["rating"] is None else min(1.0, max(0.0, (v["rating"] - 3.5) / 1.5)),
        "reliability": unknown if v["reliability"] is None else v["reliability"],
        "premium": unknown if v["premium_look"] is None else v["premium_look"],
        "distance": max(0.0, 1 - v["distance_km"] / 40),
        "response": unknown if v["response_hours"] is None else max(0.0, 1 - v["response_hours"] / 24),
    }
    total = sum(weights[k] * parts[k] for k in parts)
    return round(total * 100), {k: round(x * 100) for k, x in parts.items()}


def reasons_for(v: dict, cost: int, alloc: int, fit: str) -> list[str]:
    if fit == "within":
        money = f"Within your {inr(alloc)} allocation (est. {inr(cost)})"
    else:
        money = f"{inr(cost - alloc)} over your {inr(alloc)} allocation (est. {inr(cost)})"
    if v["source"] == "osm":
        contact = "phone listed" if v.get("phone") else ("website listed" if v.get("website") else "no contact details listed")
        return [money, f"Partner score {v['listing_score']}/100, based on how complete and well known the listing is (no reviews yet)", f"{v['distance_km']} km from the city centre, {contact}"]
    return [money, f"{v['rating']}★ and {round(v['reliability'] * 100)}% reliable", f"Replies in about {v['response_hours']}h, {v['distance_km']} km away"]


# ── The run ──────────────────────────────────────────────────────────────────────

@router.post("/agent/run")
def run_agent(req: RunIn):
    plan = req.plan
    if plan.budget <= 0 or plan.guestCount <= 0:
        raise HTTPException(422, "Budget and guest count must be positive.")

    days = [d.date for d in plan.schedule if d.date] or ([plan.date] if plan.date else [])
    n_days = max(1, len(days))
    events: list[dict] = []

    def log(step: int, title: str, detail: str, status: str = "done", data: dict | None = None):
        events.append({"step": step, "title": title, "detail": detail, "status": status, "data": data or {}})

    # 1. Envelope
    env = make_envelope(plan.budget, plan.guestCount)
    log(1, "Create the budget envelope",
        f"{inr(env['total'])} total, with {inr(env['reserve'])} (5%) held back as a contingency reserve, leaving {inr(env['allocatable'])} to allocate. "
        f"That is {inr(env['perGuest'])} per guest. {env['message']}",
        "warn" if env["level"] in ("tight", "very_tight") else "done", env)

    # 2. Allocation
    prefs, used_llm_prefs = read_preferences(req.objective)
    alloc = allocate(env["allocatable"], prefs, plan.guestCount, plan.creativeDirector)
    top3 = sorted(alloc.items(), key=lambda kv: -kv[1])[:3]
    log(2, "Allocate category budgets",
        f"From your goals I read: premium look {round(prefs['premium_look'] * 100)}%, "
        + ("must stay within budget" if prefs["strict_budget"] else "some flexibility on budget")
        + ". Largest shares: " + ", ".join(f"{LABELS[c]} {inr(a)}" for c, a in top3) + ".",
        "done", {"allocation": alloc, "preferences": prefs})

    # 3. Search the vendor database
    skipped = [c for c in LABELS if c in req.completed]  # the couple already did these: do not touch them
    everything = vendors_in_city(plan.location)
    pool = [v for v in everything if v["category"] not in skipped]

    def early_exit(detail: str, summary: str):
        log(3, "Search your vendor database", detail, "warn")
        return {"events": events, "envelope": env, "allocation": alloc, "shortlists": {}, "preferences": prefs,
                "summary": summary, "usedLlm": used_llm_prefs}

    if not everything:
        return early_exit(f"No vendors are listed for {plan.location} yet, so nothing can be shortlisted.",
                          f"I have no vendors for {plan.location} in the database yet, so I could only set up the budget envelope and allocation.")
    if not pool:
        return early_exit("Every category with vendors is already marked done on your checklist.",
                          "You've marked every vendor item as done, so there is nothing left for me to search. Untick an item if you want me to work on it.")
    cats = sorted({v["category"] for v in pool}, key=lambda c: -alloc.get(c, 0))
    no_listings = [c for c in LABELS if c not in skipped and c not in cats]
    log(3, "Search your vendor database",
        f"Found {len(pool)} real listings in {plan.location} across {len(cats)} open categories."
        + (f" No listings found yet for {', '.join(LABELS[c] for c in no_listings)}." if no_listings else "")
        + (f" Skipping {', '.join(LABELS[c] for c in skipped)}: you marked {'it' if len(skipped) == 1 else 'them'} done." if skipped else ""))

    # 4. External sources
    log(4, "Search external sources",
        "Not connected yet. This needs a web or places search API; for now only your own vendor database is used.", "skipped")

    # 5. Shortlist (capacity and budget fit)
    candidates: dict[str, list[dict]] = {}
    removed_notes = []
    for cat in cats:
        rows = []
        for v in (x for x in pool if x["category"] == cat):
            if cat == "hotels" and v["capacity"] and v["capacity"] < plan.guestCount:
                removed_notes.append(f"{v['name']} (holds {v['capacity']}, you need {plan.guestCount})")
                continue
            cost = estimate_cost(v, plan.guestCount, n_days)
            a = alloc.get(cat, 0)
            fit = "within" if cost <= a else ("stretch" if cost <= a * STRETCH else "over")
            rows.append({"v": v, "cost": cost, "fit": fit})
        keep = [r for r in rows if r["fit"] != "over"]
        if len(keep) < 3:  # too few affordable options: keep the cheapest "over" ones so the couple still sees choices
            overs = sorted((r for r in rows if r["fit"] == "over"), key=lambda r: r["cost"])
            keep += overs[: 3 - len(keep)]
        removed_notes += [f"{r['v']['name']} ({inr(r['cost'])}, over allocation)" for r in rows if r not in keep]
        candidates[cat] = keep
    total_kept = sum(len(x) for x in candidates.values())
    log(5, "Shortlist vendors", f"{total_kept} of {len(pool)} vendors kept after checking capacity and budget fit."
        + (f" Dropped: {'; '.join(removed_notes[:4])}{'…' if len(removed_notes) > 4 else ''}." if removed_notes else ""))

    # 6. Availability
    unavailable = []
    for cat in candidates:
        still = []
        for r in candidates[cat]:
            busy = busy_dates(r["v"], days)
            if busy:
                unavailable.append(f"{r['v']['name']} ({', '.join(busy)})")
            else:
                still.append(r)
        candidates[cat] = still
    log(6, "Check availability",
        f"Checked {total_kept} vendors against {', '.join(days) or 'your date'}. "
        + (f"{len(unavailable)} are booked on at least one day: {'; '.join(unavailable[:4])}{'…' if len(unavailable) > 4 else ''}. " if unavailable else "All are free. ")
        + ("Real listings: availability is unknown until the vendor replies. " if any(r["v"]["source"] == "osm" for rows in candidates.values() for r in rows) else "")
        + "Real calendars arrive once vendors reply or are onboarded.",
        "info", {"simulated": True})

    # 7. Score
    weights = score_weights(prefs)
    shortlists: dict[str, list[dict]] = {}
    for cat, rows in candidates.items():
        scored = []
        for r in rows:
            s, parts = score_vendor(r["v"], r["cost"], alloc.get(cat, 0), weights)
            v = r["v"]
            scored.append({
                "id": v["id"], "name": v["name"], "area": v["area"], "category": cat, "tier": v["tier"],
                "rating": v["rating"], "estCost": r["cost"], "fit": r["fit"], "score": s, "breakdown": parts,
                "source": v["source"], "rated": v["rating"] is not None, "phone": v.get("phone"),
                "reasons": reasons_for(v, r["cost"], alloc.get(cat, 0), r["fit"]),
            })
        # 8. top 5. If the couple must stay within budget, options that fit always rank above ones that do not.
        fit_rank = {"within": 0, "stretch": 1, "over": 2}
        shortlists[cat] = sorted(scored, key=lambda x: ((fit_rank[x["fit"]] if prefs["strict_budget"] else 0), -x["score"]))[:5]
    log(7, "Score vendors against your preferences",
        "Weights: " + ", ".join(f"{k.replace('_', ' ')} {round(v * 100)}%" for k, v in weights.items()) + ".", "done", {"weights": weights})

    # 8. Top picks
    picks = [f"{LABELS[c]}: {shortlists[c][0]['name']} ({shortlists[c][0]['score']}/100)" for c in cats if shortlists.get(c)]
    empty = [LABELS[c] for c in cats if not shortlists.get(c)]
    log(8, "Pick the top options",
        "Top pick per category: " + "; ".join(picks) + "."
        + (f" No available options left for: {', '.join(empty)}." if empty else ""),
        "warn" if empty else "done")

    # Summary
    top_costs = sum(shortlists[c][0]["estCost"] for c in cats if shortlists.get(c))
    stretch = [LABELS[c] for c in cats if shortlists.get(c) and shortlists[c][0]["fit"] != "within"]
    # Amounts are pre-formatted so the model copies them instead of re-formatting (and getting Indian grouping wrong).
    facts = {
        "total": inr(env["total"]), "reserve": inr(env["reserve"]), "allocatable": inr(env["allocatable"]),
        "perGuest": inr(env["perGuest"]), "feasibility": env["message"], "city": plan.location, "days": n_days,
        "topPicks": {LABELS[c]: {"name": shortlists[c][0]["name"], "estCost": inr(shortlists[c][0]["estCost"]), "fit": shortlists[c][0]["fit"]} for c in cats if shortlists.get(c)},
        "sumOfTopPicks": inr(top_costs), "topPicksFitBudget": top_costs <= env["allocatable"],
        "categoriesOverAllocation": stretch,
        "categoriesTheCoupleAlreadyFinishedAndIWillNotTouch": [LABELS[c] for c in skipped],
        "categoriesWhereEveryVendorIsBookedOnYourDates": [LABELS[c] for c in cats if not shortlists.get(c)],
        "categoriesWithNoListingsYet": [LABELS[c] for c in no_listings],
        "noteOnScores": "A vendor's score reflects how complete and well known its listing is. There are no customer reviews yet.",
        "noteOnPrices": "Costs are typical estimates for the category, not quotes.",
    }
    summary, used_llm_summary = write_summary(facts)
    return {"events": events, "envelope": env, "allocation": alloc, "shortlists": shortlists, "preferences": prefs,
            "summary": summary, "usedLlm": used_llm_prefs or used_llm_summary,
            "totals": {"sumOfTopPicks": top_costs, "allocatable": env["allocatable"]}}


def write_summary(facts: dict) -> tuple[str, bool]:
    fallback = (
        f"I set aside {facts['reserve']} as a reserve and split {facts['allocatable']} across categories. "
        f"The top picks add up to about {facts['sumOfTopPicks']} against {facts['allocatable']}. "
        + (f"Over their category allocation: {', '.join(facts['categoriesOverAllocation'])}. " if facts["categoriesOverAllocation"] else "")
        + (f"Every vendor is booked on your dates for: {', '.join(facts['categoriesWhereEveryVendorIsBookedOnYourDates'])}. " if facts["categoriesWhereEveryVendorIsBookedOnYourDates"] else "")
        + (f"No listings found yet for: {', '.join(facts['categoriesWithNoListingsYet'])}. " if facts["categoriesWithNoListingsYet"] else "")
        + "Costs are typical estimates, not quotes. Next I would request quotes from the shortlisted vendors."
    )
    if not llm_ready():
        return fallback, False
    try:
        text = chat_text(
            "You are Partner's wedding planning agent. Write a short summary for the bride in plain, warm English, max 110 words. "
            "Use ONLY the facts in the JSON; do not invent vendors, prices or availability, and copy amounts exactly as written. "
            "Do not open with a greeting. Mention that costs are typical estimates, not quotes, and that scores reflect listing quality rather than reviews. If categoriesWithNoListingsYet is not empty, say those categories have no listings yet. State the feasibility honestly, say whether the top picks fit the budget "
            "and which categories are the problem, and end with the next step: requesting quotes from shortlisted vendors.",
            str(facts),
        )
        return (text or fallback), bool(text)
    except Exception:
        return fallback, False
