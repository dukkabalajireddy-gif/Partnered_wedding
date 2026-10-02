"""Sample vendor database for the prototype.

All vendors are FICTIONAL. Replace this module with a real database (and real onboarding data)
later: the agent only depends on the fields documented in make().
"""

# (id, name, category, city, area, tier 1-4, rating, reliability 0-1, response_hours,
#  premium_look 0-1, distance_km, price_mult, capacity)
_ROWS = [
    # ── Hyderabad: venues ("hotels" category) ──
    ("h-v1", "Charminar Heritage Gardens", "hotels", "Hyderabad", "Old City", 3, 4.6, 0.92, 6, 0.85, 9, 1.00, 700),
    ("h-v2", "Hussain Lakeview Banquets", "hotels", "Hyderabad", "Tank Bund", 3, 4.4, 0.88, 8, 0.75, 6, 0.95, 500),
    ("h-v3", "Deccan Royale Convention", "hotels", "Hyderabad", "HITEC City", 4, 4.8, 0.95, 4, 0.95, 14, 1.05, 1200),
    ("h-v4", "Banjara Orchid Hall", "hotels", "Hyderabad", "Banjara Hills", 2, 4.3, 0.90, 5, 0.60, 4, 1.00, 350),
    ("h-v5", "Gachibowli Grand Ballroom", "hotels", "Hyderabad", "Gachibowli", 3, 4.5, 0.86, 10, 0.80, 16, 0.98, 800),
    ("h-v6", "Shamirpet Farm Lawns", "hotels", "Hyderabad", "Shamirpet", 2, 4.2, 0.80, 12, 0.65, 32, 0.92, 600),
    ("h-v7", "Nizami Palace Retreat", "hotels", "Hyderabad", "Moinabad", 4, 4.9, 0.93, 6, 1.00, 38, 1.10, 900),
    ("h-v8", "Kondapur Community Hall", "hotels", "Hyderabad", "Kondapur", 1, 4.0, 0.84, 14, 0.30, 15, 1.00, 400),
    # ── Hyderabad: catering ──
    ("h-c1", "Hyderabadi Dawat Caterers", "catering", "Hyderabad", "Mehdipatnam", 3, 4.7, 0.93, 5, 0.70, 8, 1.00, 0),
    ("h-c2", "Biryani & Beyond Events", "catering", "Hyderabad", "Kukatpally", 2, 4.5, 0.90, 4, 0.55, 12, 1.00, 0),
    ("h-c3", "Kakatiya Feast Co.", "catering", "Hyderabad", "Secunderabad", 2, 4.4, 0.87, 7, 0.50, 11, 0.95, 0),
    ("h-c4", "Royal Dum Kitchen", "catering", "Hyderabad", "Banjara Hills", 4, 4.9, 0.96, 3, 0.95, 5, 1.05, 0),
    ("h-c5", "Annapurna Wedding Foods", "catering", "Hyderabad", "Dilsukhnagar", 1, 4.1, 0.85, 10, 0.30, 13, 1.00, 0),
    ("h-c6", "Saffron Spoon Catering", "catering", "Hyderabad", "Jubilee Hills", 3, 4.6, 0.91, 6, 0.80, 6, 1.00, 0),
    ("h-c7", "Gongura Gharana", "catering", "Hyderabad", "Ameerpet", 1, 4.2, 0.82, 12, 0.35, 9, 0.95, 0),
    # ── Hyderabad: decoration ──
    ("h-d1", "Phoolwari Decorators", "decoration", "Hyderabad", "Begumpet", 2, 4.5, 0.89, 6, 0.65, 7, 1.00, 0),
    ("h-d2", "Mogra & Marigold Studio", "decoration", "Hyderabad", "Jubilee Hills", 3, 4.7, 0.92, 4, 0.88, 6, 1.00, 0),
    ("h-d3", "Aaina Event Design", "decoration", "Hyderabad", "Banjara Hills", 4, 4.9, 0.94, 5, 0.98, 5, 1.05, 0),
    ("h-d4", "Rangoli Royale Decor", "decoration", "Hyderabad", "Madhapur", 3, 4.4, 0.86, 8, 0.78, 12, 0.95, 0),
    ("h-d5", "Torana Setups", "decoration", "Hyderabad", "LB Nagar", 1, 4.0, 0.83, 10, 0.35, 14, 1.00, 0),
    ("h-d6", "Velvet Canopy Co.", "decoration", "Hyderabad", "Gachibowli", 4, 4.8, 0.91, 7, 0.96, 15, 1.00, 0),
    # ── Hyderabad: photography ──
    ("h-p1", "Lens & Lagan", "photography", "Hyderabad", "Jubilee Hills", 3, 4.7, 0.93, 4, 0.85, 6, 1.00, 0),
    ("h-p2", "Candid Dastaan", "photography", "Hyderabad", "Banjara Hills", 4, 4.9, 0.95, 5, 0.97, 5, 1.05, 0),
    ("h-p3", "Frame Mandir Studios", "photography", "Hyderabad", "Kukatpally", 2, 4.4, 0.88, 6, 0.60, 12, 1.00, 0),
    ("h-p4", "Golden Hour Stories", "photography", "Hyderabad", "Madhapur", 3, 4.6, 0.90, 5, 0.82, 11, 0.97, 0),
    ("h-p5", "ShaadiClicks Hyd", "photography", "Hyderabad", "Uppal", 1, 4.1, 0.84, 9, 0.35, 16, 1.00, 0),
    ("h-p6", "Reel Baraat Films", "photography", "Hyderabad", "Gachibowli", 4, 4.8, 0.92, 6, 0.94, 15, 1.00, 0),
    # ── Hyderabad: attire, music, transport, gifts, logistics ──
    ("h-a1", "Zari & Thread Couture", "attire", "Hyderabad", "Banjara Hills", 4, 4.8, 0.94, 6, 0.95, 5, 1.00, 0),
    ("h-a2", "Banarasi Bazaar Boutique", "attire", "Hyderabad", "Abids", 2, 4.4, 0.89, 8, 0.60, 8, 1.00, 0),
    ("h-a3", "Nawab Sherwani House", "attire", "Hyderabad", "Somajiguda", 3, 4.6, 0.91, 7, 0.82, 6, 1.00, 0),
    ("h-m1", "Dhol Tasha Collective", "music", "Hyderabad", "Secunderabad", 2, 4.5, 0.88, 5, 0.55, 11, 1.00, 0),
    ("h-m2", "Sufi Nights Live", "music", "Hyderabad", "Jubilee Hills", 3, 4.7, 0.92, 6, 0.85, 6, 1.00, 0),
    ("h-m3", "DJ Entourage Hyd", "music", "Hyderabad", "Madhapur", 2, 4.3, 0.86, 8, 0.50, 12, 0.95, 0),
    ("h-t1", "Royal Wheels Hyd", "transport", "Hyderabad", "Begumpet", 3, 4.5, 0.90, 6, 0.80, 7, 1.00, 0),
    ("h-t2", "Baraat Rides Co.", "transport", "Hyderabad", "Kukatpally", 2, 4.3, 0.87, 8, 0.50, 12, 1.00, 0),
    ("h-g1", "Hamper House Hyd", "gifts", "Hyderabad", "Banjara Hills", 2, 4.4, 0.88, 6, 0.55, 5, 1.00, 0),
    ("h-l1", "Shaadi Ops Hyd", "logistics", "Hyderabad", "Gachibowli", 2, 4.3, 0.89, 5, 0.50, 15, 1.00, 0),
    # ── Delhi (small set so a second city works) ──
    ("d-v1", "Lutyens Lawn Banquets", "hotels", "Delhi", "Chanakyapuri", 4, 4.8, 0.94, 5, 0.95, 5, 1.00, 900),
    ("d-v2", "Karol Bagh Grand Hall", "hotels", "Delhi", "Karol Bagh", 2, 4.2, 0.86, 8, 0.55, 8, 1.00, 450),
    ("d-c1", "Dilli Dawat Caterers", "catering", "Delhi", "Lajpat Nagar", 3, 4.6, 0.91, 5, 0.75, 6, 1.00, 0),
    ("d-c2", "Chandni Chowk Feast Co.", "catering", "Delhi", "Chandni Chowk", 1, 4.1, 0.85, 9, 0.30, 9, 1.00, 0),
    ("d-d1", "Genda Phool Events", "decoration", "Delhi", "Pitampura", 2, 4.5, 0.88, 6, 0.65, 10, 1.00, 0),
    ("d-d2", "Mahal Mood Design", "decoration", "Delhi", "Hauz Khas", 4, 4.9, 0.93, 4, 0.97, 7, 1.00, 0),
    ("d-p1", "Dilli Frames Studio", "photography", "Delhi", "Hauz Khas", 3, 4.7, 0.92, 4, 0.85, 7, 1.00, 0),
    ("d-p2", "Budget Baraat Clicks", "photography", "Delhi", "Rohini", 1, 4.0, 0.83, 10, 0.30, 12, 1.00, 0),
]

_KEYS = ("id", "name", "category", "city", "area", "tier", "rating", "reliability",
         "response_hours", "premium_look", "distance_km", "price_mult", "capacity")


def make(row: tuple) -> dict:
    """One vendor: tier 1-4 is the price band; premium_look 0-1 is how upscale the work looks."""
    return dict(zip(_KEYS, row))


VENDORS: list[dict] = [make(r) for r in _ROWS]

# Price bands. Catering is per plate, per day of celebration; everything else is a flat fee for a 3-day event.
PER_PLATE = [450, 750, 1200, 2000]
FLAT_3DAY = {
    "hotels":      [120_000, 250_000, 450_000, 900_000],
    "decoration":  [150_000, 300_000, 600_000, 1_200_000],
    "photography": [100_000, 180_000, 320_000, 600_000],
    "attire":      [80_000, 150_000, 350_000, 800_000],
    "music":       [50_000, 100_000, 220_000, 400_000],
    "transport":   [40_000, 80_000, 160_000, 300_000],
    "gifts":       [40_000, 80_000, 150_000, 300_000],
    "logistics":   [50_000, 90_000, 150_000, 250_000],
}


def estimate_cost(v: dict, guests: int, days: int) -> int:
    """Rough cost of this vendor for the couple's event (the agent's estimate, not a real quote)."""
    t = v["tier"] - 1
    days = max(1, days)
    if v["category"] == "catering":
        cost = PER_PLATE[t] * guests * days
    else:
        cost = FLAT_3DAY[v["category"]][t] * min(1.3, max(0.4, days / 3))
    return int(round(cost * v["price_mult"] / 5000) * 5000)


def vendors_in_city(city: str) -> list[dict]:
    c = (city or "").strip().lower()
    return [v for v in VENDORS if v["city"].lower() == c]
