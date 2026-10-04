"""The autopilot vendor: writes the reply a vendor would send to a couple's message (Wizard of Oz).

What the vendor decides (available or not, how much to quote, whether to give a discount) is worked out here from the
vendor's id, so the same vendor always behaves the same way. The language model only phrases the reply, and is told the
exact numbers to use. If it is unavailable, plain templates are used instead.
"""
import hashlib
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

from fastapi import APIRouter
from pydantic import BaseModel

from agent import inr
from llm import chat_text, llm_ready

router = APIRouter()
_pool = ThreadPoolExecutor(max_workers=6)
LLM_BUDGET_SECONDS = 7  # past this, the plain template goes out so a reply is never late

INCLUDES = {
    "hotels": "the banquet hall, rooms for your family and a dedicated events manager",
    "catering": "the full menu with live counters, service staff and a tasting session",
    "decoration": "the mandap, stage and lighting for all your events",
    "photography": "candid photos and a wedding film with two photographers",
    "attire": "custom fittings, alterations and trousseau planning",
    "music": "a DJ, sound system and a dhol troupe for the sangeet and baraat",
    "transport": "baraat cars and guest transfers across all your days",
    "gifts": "curated return gifts with packing and delivery",
    "logistics": "a coordination crew for deliveries and day-of timelines",
}
NOUN = {
    "hotels": "venue", "catering": "catering", "decoration": "decor", "photography": "photography", "attire": "outfits",
    "music": "music", "transport": "transport", "gifts": "gifts", "logistics": "coordination",
}


class Msg(BaseModel):
    frm: str  # "me" (the couple) or "vendor"
    text: str


class Vendor(BaseModel):
    id: str
    name: str
    category: str
    city: str
    estCost: int = 0


class CoupleInfo(BaseModel):
    names: str = ""
    city: str = ""
    date: str = ""
    guests: int = 200
    days: int = 1
    styles: list[str] = []
    diet: str | None = None   # "veg" if the wedding is vegetarian only


class ReplyIn(BaseModel):
    vendor: Vendor
    couple: CoupleInfo
    history: list[Msg] = []          # the conversation so far, oldest first; the last one is the couple's message
    lastQuote: int | None = None     # the amount this vendor quoted earlier, if any
    discounted: bool = False         # whether they already gave a discount
    fast: bool = False               # skip the language model (used when the agent writes to many vendors at once)


def _h(vendor_id: str) -> int:
    return int(hashlib.md5(vendor_id.encode()).hexdigest(), 16)


def intent_of(text: str) -> str:
    t = text.lower()
    if re.search(r"discount|negotiat|lower|reduce|too (high|much|expensive)|best price|cheaper|budget is", t):
        return "negotiate"
    if re.search(r"advance|pay(ment)?\b|invoice|bank|account|deposit|upi|link", t):
        return "payment"
    if re.search(r"confirm|book(ed|ing)?\b|go ahead|finali[sz]e|lock", t):
        return "confirm"
    if re.search(r"thank|ok(ay)?\b|great|perfect|sounds good", t) and not re.search(r"quote|price|cost|available", t):
        return "thanks"
    if re.search(r"quote|price|cost|rate|how much|estimate|package", t):
        return "quote"
    return "enquiry"


def decide(req: ReplyIn, intent: str) -> dict:
    h = _h(req.vendor.id)
    est = req.vendor.estCost or 100000
    available = (h % 100) < 85
    factor = 0.92 + ((h >> 8) % 27) / 100          # between 92% and 118% of our estimate
    base = max(5000, round(est * factor / 5000) * 5000)
    amount = req.lastQuote or base
    discounted = req.discounted
    if intent == "negotiate" and available and not req.discounted:
        amount, discounted = max(5000, round(amount * 0.93 / 5000) * 5000), True
    return {"available": available, "amount": amount, "discounted": discounted, "advancePct": 30, "validDays": 7}


def template(req: ReplyIn, intent: str, d: dict) -> str:
    v, c = req.vendor, req.couple
    first = (c.names.split("&")[0] or "there").strip()
    what = INCLUDES.get(v.category, "everything we discussed")
    if c.diet == "veg" and v.category in ("catering", "hotels"):
        what += ", and we can do a fully vegetarian menu"
    amt, adv = inr(d["amount"]), inr(round(d["amount"] * d["advancePct"] / 100 / 100) * 100)
    if not d["available"]:
        return f"Hi {first}, thank you for thinking of us. Unfortunately we're already booked around your dates. We'd be happy to recommend someone we trust if that helps."
    if intent == "negotiate":
        if d["discounted"] and not req.discounted:
            return f"Hi {first}, we'd love to be part of your wedding. Our best price is {amt} for {what}, a special rate for your dates. A {d['advancePct']}% advance ({adv}) confirms it."
        return f"Hi {first}, {amt} is already our best rate for {what}. We can't go lower, but we'll look after you well on the day."
    if intent == "payment":
        return f"Hi {first}, the advance is {d['advancePct']}% ({adv}) of {amt}, and the balance is due a week before the wedding. Send it through Partnered and we'll confirm right away."
    if intent == "confirm":
        return f"Wonderful, {first}! We'll block your dates once the {adv} advance comes in. Thank you for choosing us."
    if intent == "thanks":
        return f"You're most welcome, {first}! Let us know whenever you're ready to go ahead."
    return (f"Hi {first}, thank you for reaching out! Yes, we're available. For {c.guests} guests over {c.days} day{'s' if c.days != 1 else ''}, "
            f"our quote is {amt}, which includes {what}. A {d['advancePct']}% advance ({adv}) confirms the booking, and the quote is valid for {d['validDays']} days.")


def phrase(req: ReplyIn, intent: str, d: dict) -> str | None:
    """Ask the language model to word the reply. Returns None if it is unavailable or ignores the facts."""
    if not llm_ready():
        return None
    v, c = req.vendor, req.couple
    facts = {
        "vendorName": v.name, "kindOfWork": NOUN.get(v.category, v.category), "city": v.city, "intent": intent,
        "available": d["available"], "quotedAmount": inr(d["amount"]) if d["available"] else None,
        "advance": f"{d['advancePct']}% ({inr(round(d['amount'] * d['advancePct'] / 100 / 100) * 100)})" if d["available"] else None,
        "quoteValidForDays": d["validDays"],
        "discount": "offered_just_now" if (d["discounted"] and not req.discounted) else ("given_earlier_no_more_available" if req.discounted else "none"),
        "whatIsIncluded": INCLUDES.get(v.category), "coupleNames": c.names, "guests": c.guests, "daysOfCelebration": c.days,
        "weddingStyles": c.styles, "menuPreference": "vegetarian only" if c.diet == "veg" else None,
    }
    convo = "\n".join(f"{'Couple' if m.frm == 'me' else 'You'}: {m.text}" for m in req.history[-6:])
    try:
        text = chat_text(
            f"You are the owner of {v.name}, a small {NOUN.get(v.category, 'wedding')} business in {v.city}, replying on WhatsApp to a couple planning an Indian wedding. "
            "Write ONE short reply (at most 55 words) in warm, natural Indian English, answering what the couple's last message asks. "
            "Use ONLY the facts in the JSON. Copy rupee amounts exactly as written and never invent other prices, dates or promises. "
            "If available is false, apologise briefly and offer to recommend someone. If discount is offered_just_now, say you can do this special rate for them (do not say you already gave one). If discount is given_earlier_no_more_available and the couple asks for more, politely say this is the final rate. "
            "Do not use hashtags or markdown. No greeting more than 'Hi <first name>'.",
            f"Facts: {facts}\n\nConversation so far:\n{convo}",
        )
    except Exception:
        return None
    text = (text or "").strip().strip('"')
    if not text or len(text) > 600:
        return None
    if d["available"] and intent in ("enquiry", "quote", "negotiate") and inr(d["amount"]) not in text:
        return None  # a quote reply must carry the exact number
    return text


@router.post("/vendor-reply")
def vendor_reply(req: ReplyIn):
    last = next((m.text for m in reversed(req.history) if m.frm == "me"), "")
    intent = intent_of(last)
    d = decide(req, intent)
    text = None
    if not req.fast:
        try:
            text = _pool.submit(phrase, req, intent, d).result(timeout=LLM_BUDGET_SECONDS)
        except (FutureTimeout, Exception):
            text = None
    text = text or template(req, intent, d)
    gives_quote = d["available"] and intent in ("enquiry", "quote", "negotiate")
    return {
        "text": text, "intent": intent, "available": d["available"],
        "quote": {"amount": d["amount"], "advancePct": d["advancePct"], "validDays": d["validDays"], "discounted": d["discounted"]} if gives_quote else None,
        "declined": not d["available"],
    }
