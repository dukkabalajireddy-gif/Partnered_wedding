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
]

_KEYS = ("id", "name", "category", "city", "area", "tier", "rating", "reliability",
         "response_hours", "premium_look", "distance_km", "price_mult", "capacity")


def make(row: tuple) -> dict:
    """One vendor: tier 1-4 is the price band; premium_look 0-1 is how upscale the work looks."""
    return dict(zip(_KEYS, row))


import hashlib
import random
import re


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


# ── Cities ────────────────────────────────────────────────────────────────────
# kind: "metro", "city" or "destination" (a place couples travel to for the wedding).
# price: how expensive the city is relative to Hyderabad. areas are real neighbourhoods; the
# vendors placed in them are fictional. "flavours" are local-sounding words used to name sample vendors.
CITIES: dict[str, dict] = {
    # Metros
    "Mumbai": dict(state="Maharashtra", kind="metro", price=1.20, areas=["Andheri", "Bandra", "Juhu", "Powai", "Worli", "Navi Mumbai", "Thane"],
                   flavours=["Konkan", "Sahyadri", "Gulmohar", "Mahim", "Mayfair", "Bombay Rose", "Seven Isles", "Aarey"]),
    "Delhi": dict(state="Delhi NCR", kind="metro", price=1.15, areas=["Chanakyapuri", "Hauz Khas", "Karol Bagh", "Lajpat Nagar", "Dwarka", "Rohini", "Vasant Kunj", "Gurugram"],
                  flavours=["Dilli", "Lutyens", "Qila", "Yamuna", "Chandni", "Rajpath", "Mehrauli", "Kohinoor"]),
    "Bengaluru": dict(state="Karnataka", kind="metro", price=1.05, areas=["Indiranagar", "Koramangala", "Whitefield", "Jayanagar", "Yelahanka", "Hebbal", "Malleshwaram"],
                      flavours=["Kempe", "Lalbagh", "Mysore", "Garden City", "Nandi", "Cubbon", "Hoysala", "Vijaya"]),
    "Hyderabad": dict(state="Telangana", kind="metro", price=1.00, generate=False, areas=[], flavours=[]),
    "Chennai": dict(state="Tamil Nadu", kind="metro", price=1.00, areas=["Adyar", "T. Nagar", "Anna Nagar", "Mylapore", "ECR", "Velachery", "Nungambakkam"],
                    flavours=["Marina", "Kanchi", "Chola", "Madras", "Kapali", "Pallava", "Cauvery", "Mylai"]),
    "Kolkata": dict(state="West Bengal", kind="metro", price=0.95, areas=["Salt Lake", "Park Street", "Ballygunge", "New Town", "Alipore", "Behala", "Howrah"],
                    flavours=["Hooghly", "Sonar Bangla", "Alipore", "Ganga", "Rabindra", "Palash", "Shiuli", "Nabanna"]),
    "Pune": dict(state="Maharashtra", kind="metro", price=1.00, areas=["Koregaon Park", "Baner", "Kothrud", "Hinjewadi", "Aundh", "Viman Nagar", "Camp"],
                 flavours=["Peshwa", "Bhima", "Shaniwar", "Deccan", "Mulshi", "Parvati", "Sinhagad", "Mutha"]),
    "Ahmedabad": dict(state="Gujarat", kind="metro", price=0.95, areas=["Satellite", "Navrangpura", "Bodakdev", "SG Highway", "Vastrapur", "Prahlad Nagar"],
                      flavours=["Sabarmati", "Kankaria", "Navrang", "Amdavad", "Sarkhej", "Heritage", "Gujarat", "Rann"]),
    # Other major cities
    "Jaipur": dict(state="Rajasthan", kind="city", price=1.00, areas=["C-Scheme", "Malviya Nagar", "Vaishali Nagar", "Amer Road", "Mansarovar", "Jhotwara"],
                   flavours=["Gulabi", "Amber", "Rajputana", "Hawa", "Pink City", "Jal Mahal", "Nahargarh", "Sawai"]),
    "Lucknow": dict(state="Uttar Pradesh", kind="city", price=0.90, areas=["Gomti Nagar", "Hazratganj", "Aliganj", "Indira Nagar", "Alambagh", "Mahanagar"],
                    flavours=["Nawabi", "Awadh", "Gomti", "Tehzeeb", "Chowk", "Kaiser", "Bara", "Rumi"]),
    "Chandigarh": dict(state="Chandigarh", kind="city", price=0.95, areas=["Sector 17", "Sector 35", "Zirakpur", "Mohali", "Panchkula", "Sector 8"],
                       flavours=["Sukhna", "Shivalik", "Phulkari", "Capitol", "Baisakhi", "Rock Garden", "Lohri", "Patiala"]),
    "Kochi": dict(state="Kerala", kind="city", price=0.95, areas=["Edappally", "Marine Drive", "Fort Kochi", "Kakkanad", "Panampilly Nagar", "Thevara"],
                  flavours=["Malabar", "Periyar", "Kayal", "Spice Coast", "Chandanam", "Onam", "Vembanad", "Kasavu"]),
    "Indore": dict(state="Madhya Pradesh", kind="city", price=0.90, areas=["Vijay Nagar", "Palasia", "Bhawarkuan", "Saket", "Rau", "Sudama Nagar"],
                   flavours=["Malwa", "Rajwada", "Holkar", "Narmada", "Sarafa", "Chappan", "Ahilya", "Khajrana"]),
    "Surat": dict(state="Gujarat", kind="city", price=0.90, areas=["Adajan", "Vesu", "Athwa", "Piplod", "Varachha", "Citylight"],
                  flavours=["Tapi", "Suryapur", "Diamond", "Zari", "Dumas", "Sunehri", "Rander", "Mithai"]),
    # Destination wedding cities
    "Udaipur": dict(state="Rajasthan", kind="destination", price=1.30, areas=["Fatehsagar", "Lake Pichola", "Haridas Ji Ki Magri", "Badi", "Sajjangarh", "Ambamata"],
                    flavours=["Pichola", "Mewar", "Fateh", "Sajjan", "Jagmandir", "Rana", "Lakecity", "Zenana"]),
    "Goa": dict(state="Goa", kind="destination", price=1.25, areas=["Candolim", "Calangute", "Vagator", "Benaulim", "Panjim", "Palolem", "Varca"],
                flavours=["Konkani", "Feni", "Casa", "Sunset", "Mandovi", "Zuari", "Latin", "Palm"]),
    "Jodhpur": dict(state="Rajasthan", kind="destination", price=1.20, areas=["Ratanada", "Paota", "Mandore", "Umaid", "Shastri Nagar", "Sardarpura"],
                    flavours=["Marwar", "Mehrangarh", "Blue City", "Umaid", "Sun City", "Rathore", "Jaswant", "Ghoomar"]),
    "Jaisalmer": dict(state="Rajasthan", kind="destination", price=1.25, areas=["Gadisar", "Sam Dunes", "Khuhri", "Amar Sagar", "Sonar Fort", "Lodhruva"],
                      flavours=["Thar", "Golden", "Dune", "Sam", "Patwa", "Haveli", "Sandstone", "Camel"]),
    "Rishikesh": dict(state="Uttarakhand", kind="destination", price=1.05, areas=["Tapovan", "Laxman Jhula", "Shivpuri", "Muni Ki Reti", "Ram Jhula", "Kaudiyala"],
                      flavours=["Bhagirathi", "Neelkanth", "Tapovan", "Himalaya", "Rudra", "Gangotri", "Veda", "Prayag"]),
    "Mussoorie": dict(state="Uttarakhand", kind="destination", price=1.15, areas=["Library Chowk", "Landour", "Camel's Back Road", "Barlowganj", "Kempty Road", "Jharipani"],
                      flavours=["Doon", "Landour", "Pine", "Himalayan", "Queen of Hills", "Mist", "Kempty", "Cedar"]),
    "Alleppey": dict(state="Kerala", kind="destination", price=1.10, areas=["Punnamada", "Pathiramanal", "Marari", "Kainakary", "Thathampally", "Vembanad"],
                     flavours=["Kuttanad", "Houseboat", "Marari", "Venice", "Kettuvallam", "Paddy", "Backwater", "Coir"]),
}

# category, id code, how many sample vendors per city, name templates ({F} is a local flavour word)
_CATS = [
    ("hotels", "v", 6, ["{F} Heritage Gardens", "{F} Grand Banquets", "{F} Palace Retreat", "{F} Lakeview Lawns", "{F} Royale Convention", "{F} Orchid Hall"]),
    ("catering", "c", 6, ["{F} Dawat Caterers", "{F} Feast Co.", "{F} Royal Kitchen", "{F} Wedding Foods", "{F} Spice Table", "{F} Rasoi Events"]),
    ("decoration", "d", 5, ["{F} Floral Studio", "{F} Mandap Designs", "{F} Event Design", "{F} Decorators", "{F} Canopy Co."]),
    ("photography", "p", 5, ["{F} Frames", "{F} Candid Stories", "{F} Wedding Films", "{F} Lens Studio", "{F} Click Studios"]),
    ("attire", "a", 3, ["{F} Couture", "{F} Bridal House", "{F} Sherwani Studio"]),
    ("music", "m", 3, ["{F} Live Entourage", "{F} DJ Collective", "{F} Dhol Troupe"]),
    ("transport", "t", 3, ["{F} Wheels", "{F} Baraat Rides", "{F} Fleet Co."]),
    ("gifts", "g", 2, ["{F} Hamper House", "{F} Shagun Gifts"]),
    ("logistics", "l", 2, ["{F} Shaadi Ops", "{F} Event Crew"]),
]


def _generate(city: str, meta: dict) -> list[dict]:
    """Deterministic sample vendors for a city (the same city always produces the same vendors)."""
    out, used = [], set()
    for cat, code, n, templates in _CATS:
        for i in range(n):
            rng = random.Random(f"{city}|{cat}|{i}")
            tier = rng.choices([1, 2, 3, 4], weights=[22, 36, 28, 14])[0]
            flavour = meta["flavours"][(i + rng.randint(0, 3)) % len(meta["flavours"])]
            area = meta["areas"][(i + rng.randint(0, 2)) % len(meta["areas"])]
            name = templates[i % len(templates)].format(F=flavour)
            if name in used:
                name = f"{name} ({area})"
            used.add(name)
            out.append(make((
                f"{slug(city)}-{code}{i + 1}", name, cat, city, area, tier,
                round(min(4.9, 3.9 + 0.08 * tier + rng.uniform(0, 0.55)), 1),            # rating
                round(min(0.97, 0.78 + 0.01 * tier + rng.uniform(0, 0.17)), 2),          # reliability
                max(2, int(rng.uniform(3, 16) - tier)),                                  # response hours
                round(min(1.0, max(0.2, [0.3, 0.55, 0.8, 0.95][tier - 1] + rng.uniform(-0.1, 0.1))), 2),  # premium look
                rng.randint(2, 30 if meta["kind"] == "destination" else 24),             # distance km
                round(meta["price"] * rng.uniform(0.93, 1.07), 2),                       # price multiplier
                rng.choice([[250, 300], [350, 450], [500, 700], [800, 1200]][tier - 1]) if cat == "hotels" else 0,  # capacity
            )))
    return out


VENDORS: list[dict] = [make(r) for r in _ROWS] + [
    v for city, meta in CITIES.items() if meta.get("generate", True) for v in _generate(city, meta)
]
_BY_CITY: dict[str, list[dict]] = {}
for _v in VENDORS:
    _BY_CITY.setdefault(_v["city"].lower(), []).append(_v)

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
    return list(_BY_CITY.get((city or "").strip().lower(), []))


def cities_summary() -> list[dict]:
    return [
        {"name": name, "state": meta["state"], "kind": meta["kind"], "vendorCount": len(_BY_CITY.get(name.lower(), []))}
        for name, meta in CITIES.items()
    ]


# ── What the marketplace shows for a vendor ───────────────────────────────────

_IMAGES = {
    "catering": ["photo-1555244162-803834f70033", "photo-1414235077428-338989a2e8c0", "photo-1565299624946-b28f40a0ae38", "photo-1567620905732-2d1ec7ab7445"],
    "attire": ["photo-1519225421980-715cb0215aed", "photo-1515886657613-9f3515b0c78f", "photo-1610030469983-98e550d6193c"],
    "decoration": ["photo-1507003211169-0a1dd7228f2d", "photo-1464366400600-7168b8af9bc3"],
    "photography": ["photo-1537633552985-df8429e8048b", "photo-1606216794074-735e91aa2c92", "photo-1492691527719-9d1e07e534b4"],
    "hotels": ["photo-1566073771259-6a8506099945", "photo-1520250497591-112f2f40a3f4", "photo-1531804055935-76f44d7c3621"],
    "transport": ["photo-1449965408869-eaa3f722e40d", "photo-1558618666-fcd25c85cd64"],
    "music": ["photo-1493225457124-a3eb161ffa5f", "photo-1429962714451-bb934ecdc4ec"],
    "gifts": ["photo-1549465220-1a8b9238cd48", "photo-1513201099705-a9746e1e201f"],
    "logistics": ["photo-1553413077-190dd305871c"],
}
_BLURB = {
    "catering": "Full-service wedding catering: multi-cuisine menus, live counters, tasting sessions and trained service staff for every function.",
    "attire": "Bridal and groom couture, custom fittings and alterations, with trousseau planning for every ritual.",
    "decoration": "Mandap, stage and venue styling with fresh florals, lighting and themed installations for each function.",
    "photography": "Candid and traditional photography with cinematic films, drone coverage and same-week previews.",
    "hotels": "Wedding venue and guest-room blocks with banquet halls, lawns and a dedicated events team.",
    "transport": "Baraat vehicles, guest airport transfers and a coordinated fleet schedule across all days.",
    "music": "Live performances, DJs and sangeet choreography with sound and stage production included.",
    "gifts": "Curated return gifts, shagun hampers and trousseau packing with bulk-order pricing.",
    "logistics": "On-ground coordination: vendor timelines, deliveries and day-of management so you can enjoy the celebrations.",
}


def partner_score(v: dict) -> int:
    """One 0-100 number summarising a vendor: rating 40%, reliability 30%, response time 15%, premium look 15%."""
    return round(100 * (0.40 * (v["rating"] - 3.5) / 1.5 + 0.30 * v["reliability"]
                        + 0.15 * (1 - min(v["response_hours"], 24) / 24) + 0.15 * v["premium_look"]))


def vendor_profile(v: dict, guests: int, days: int) -> dict:
    h = int(hashlib.md5(v["id"].encode()).hexdigest(), 16)
    images = _IMAGES[v["category"]]
    if v["tier"] == 1:
        tag = "Budget Friendly"
    elif v["rating"] >= 4.8:
        tag = "Top Rated"
    elif v["premium_look"] >= 0.9:
        tag = "Premium"
    elif v["response_hours"] <= 4:
        tag = "Quick Replies"
    elif CITIES.get(v["city"], {}).get("kind") == "destination" and v["category"] == "hotels":
        tag = "Destination Venue"
    else:
        tag = "Popular"
    return {
        "id": v["id"], "name": v["name"], "category": v["category"], "city": v["city"], "area": v["area"],
        "tier": v["tier"], "priceBand": "₹" * v["tier"],
        "rating": v["rating"], "reliability": round(v["reliability"] * 100), "responseHours": v["response_hours"],
        "premiumLook": round(v["premium_look"] * 100), "distanceKm": v["distance_km"],
        "capacity": v["capacity"] or None, "partnerScore": partner_score(v),
        "estCost": estimate_cost(v, guests, days), "tag": tag,
        "image": images[h % len(images)],
        "description": f"{_BLURB[v['category']]} Based in {v['area']}, {v['city']}.",
        # Placeholder contact details: obviously fake until real vendor onboarding exists.
        "phone": f"+91 90000 {h % 100000:05d}", "email": f"hello@{slug(v['name'])[:24]}.example",
        "hours": "Mon – Sat, 10 am – 7 pm",
    }
