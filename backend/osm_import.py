"""One-off importer: real wedding-related places from OpenStreetMap, saved to data/osm_vendors.json.

Run it manually (it is NOT called when the app runs):
    .venv\\Scripts\\python.exe osm_import.py            # all cities
    .venv\\Scripts\\python.exe osm_import.py Hyderabad  # just one

Data (c) OpenStreetMap contributors, licensed under the ODbL (https://www.openstreetmap.org/copyright).
The app must show that attribution wherever this data appears. OSM has no ratings or prices, so the
app treats these listings as "real but unrated".
"""
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# south, west, north, east
CITY_BBOX = {
    "Mumbai": (18.89, 72.77, 19.30, 73.05), "Delhi": (28.40, 76.84, 28.88, 77.35),
    "Bengaluru": (12.83, 77.45, 13.14, 77.78), "Hyderabad": (17.28, 78.28, 17.60, 78.65),
    "Chennai": (12.90, 80.10, 13.20, 80.33), "Kolkata": (22.45, 88.25, 22.70, 88.45),
    "Pune": (18.42, 73.75, 18.65, 73.99), "Ahmedabad": (22.95, 72.45, 23.15, 72.70),
    "Jaipur": (26.78, 75.70, 27.02, 75.92), "Lucknow": (26.75, 80.85, 26.95, 81.05),
    "Chandigarh": (30.62, 76.65, 30.82, 76.88), "Kochi": (9.90, 76.20, 10.10, 76.40),
    "Indore": (22.62, 75.77, 22.82, 75.95), "Surat": (21.10, 72.72, 21.25, 72.92),
    "Udaipur": (24.52, 73.62, 24.65, 73.78), "Goa": (15.00, 73.65, 15.70, 74.05),
    "Jodhpur": (26.20, 72.95, 26.35, 73.10), "Jaisalmer": (26.86, 70.85, 26.96, 70.98),
    "Rishikesh": (30.05, 78.25, 30.15, 78.35), "Mussoorie": (30.43, 78.03, 30.48, 78.11),
    "Alleppey": (9.45, 76.30, 9.56, 76.39),
}
ENDPOINTS = ["https://overpass-api.de/api/interpreter"]
USER_AGENT = "PartneredMVP/0.1 (wedding planner prototype)"

# How many listings to keep per category per city (the richest ones first)
CAPS = {"hotels": 30, "catering": 15, "photography": 20, "decoration": 15, "attire": 15, "gifts": 8,
        "music": 10, "transport": 12, "logistics": 8}
RICH_TAGS = ["phone", "contact:phone", "website", "contact:website", "email", "contact:email", "opening_hours",
             "stars", "addr:street", "addr:suburb", "addr:full", "wikidata", "wikipedia", "brand", "operator", "capacity", "rooms"]


def query(bbox):
    b = ",".join(str(x) for x in bbox)
    return f"""[out:json][timeout:60];
(
  nwr["amenity"="events_venue"]({b});
  nwr["shop"="wedding"]({b});
  nwr["craft"="caterer"]({b});
  nwr["shop"="catering"]({b});
  nwr["craft"="photographer"]({b});
  nwr["shop"="photo"]["name"]({b});
  nwr["shop"="florist"]({b});
  nwr["tourism"~"^(hotel|resort)$"]["name"]({b});
  nwr["shop"="gift"]["name"]({b});
  nwr["shop"="party"]["name"]({b});
  nwr["amenity"="car_rental"]["name"]({b});
  nwr["office"~"^(courier|logistics)$"]["name"]({b});
  nwr["shop"~"^(musical_instrument|music)$"]["name"]({b});
  nwr["shop"~"^(clothes|boutique|tailor|fabric)$"]["name"~"bridal|lehenga|sherwani|saree|sari|ethnic|couture|wedding",i]({b});
  nwr["shop"]["name"~"decorat|mandap|tent house|caterer|catering|event|planner",i]({b});
  nwr["office"]["name"~"event|planner|decorat|wedding|catering",i]({b});
  nwr["craft"]["name"~"decorat|caterer|catering|dj|sound|dhol",i]({b});
);
out center tags;"""


def fetch(bbox):
    data = urllib.parse.urlencode({"data": query(bbox)}).encode()
    last = None
    for attempt in range(4):
        url = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)["elements"]
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            last = e
            print(f"      attempt {attempt + 1} on {url.split('/')[2]} failed: {type(e).__name__} {str(e)[:60]}", flush=True)
            time.sleep(30 * (attempt + 1))
    raise RuntimeError(f"Overpass failed: {last}")


def tiles(bbox, max_deg=0.5):
    """Split a big city box into smaller tiles so each Overpass query stays light."""
    s, w, n, e = bbox
    rows, cols = max(1, math.ceil((n - s) / max_deg)), max(1, math.ceil((e - w) / max_deg))
    for r in range(rows):
        for c in range(cols):
            yield (round(s + (n - s) * r / rows, 4), round(w + (e - w) * c / cols, 4),
                   round(s + (n - s) * (r + 1) / rows, 4), round(w + (e - w) * (c + 1) / cols, 4))


def fetch_city(bbox):
    elements = []
    for tile in tiles(bbox):
        elements += fetch(tile)
        time.sleep(4)
    return elements


def category_of(t: dict) -> str | None:
    name = t.get("name", "").lower()
    if t.get("amenity") == "events_venue" or t.get("tourism") in ("hotel", "resort"):
        return "hotels"
    if t.get("craft") == "caterer" or t.get("shop") == "catering":
        return "catering"
    if t.get("craft") == "photographer":
        return "photography"
    if t.get("shop") == "photo" and any(w in name for w in ("studio", "photo", "film", "click", "candid", "wedding", "digital")):
        return "photography"
    if t.get("shop") == "florist":
        return "decoration"
    if t.get("shop") == "wedding":
        return "attire"
    if t.get("shop") == "gift":
        return "gifts"
    if t.get("amenity") == "car_rental":
        return "transport"
    if t.get("office") in ("courier", "logistics"):
        return "logistics"
    if t.get("shop") in ("musical_instrument", "music"):
        return "music"
    if t.get("shop") == "party":
        return "decoration"
    # Everything else was matched by a wording hint in its name
    if any(w in name for w in ("bridal", "lehenga", "sherwani", "saree", "sari", "ethnic", "couture", "boutique")):
        return "attire"
    if any(w in name for w in ("caterer", "catering")):
        return "catering"
    if any(w in name for w in ("decorat", "mandap", "tent house", "event", "planner", "wedding")):
        return "decoration"
    if any(w in name.split() or w in name for w in ("dj", "dhol", "sound", "band")):
        return "music"
    return None


def first(v: str | None) -> str | None:
    """OSM joins several values with ';'. Keep the first."""
    return v.split(";")[0].strip() if v else None


def clean_hotel(t: dict) -> bool:
    """243 hotels in a city is noise; keep rated, listed or clearly wedding-ready ones."""
    if t.get("amenity") == "events_venue":
        return True
    stars = t.get("stars", "")
    n = t.get("name", "").lower()
    return bool((stars.replace("+", "").isdigit() and int(stars.replace("+", "")) >= 3)
                or t.get("website") or t.get("contact:website")
                or any(w in n for w in ("resort", "palace", "grand", "banquet", "garden", "lawn", "convention")))


def build(city: str, elements: list[dict]) -> list[dict]:
    seen, by_cat = set(), {}
    for el in elements:
        t = el.get("tags", {})
        name = first(t.get("name"))
        cat = category_of(t)
        if not name or not cat:
            continue
        if cat == "hotels" and not clean_hotel(t):
            continue
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        key = (name.lower(), round(lat, 3), round(lon, 3))
        if key in seen:
            continue
        seen.add(key)
        rich = sum(1 for k in RICH_TAGS if t.get(k)) + (2 if t.get("amenity") == "events_venue" else 0)
        by_cat.setdefault(cat, []).append({
            "id": f"osm-{el['type'][0]}{el['id']}", "name": name, "category": cat, "city": city,
            "lat": round(lat, 5), "lon": round(lon, 5),
            "phone": first(t.get("phone") or t.get("contact:phone")),
            "website": first(t.get("website") or t.get("contact:website")),
            "email": first(t.get("email") or t.get("contact:email")),
            "hours": t.get("opening_hours"),
            "street": t.get("addr:street"), "suburb": t.get("addr:suburb") or t.get("addr:neighbourhood"),
            "stars": t.get("stars"), "wikidata": bool(t.get("wikidata") or t.get("wikipedia")),
            "brand": t.get("brand") or t.get("operator"), "capacity": t.get("capacity"), "rooms": t.get("rooms"),
            "venue": t.get("amenity") == "events_venue",
            "osmType": el["type"], "osmId": el["id"], "_rich": rich,
        })
    out = []
    for cat, rows in by_cat.items():
        rows.sort(key=lambda r: (-r["_rich"], r["name"].lower()))
        out += rows[: CAPS[cat]]
    for r in out:
        r.pop("_rich", None)
    return out


def main():
    only = sys.argv[1:]
    cities = {c: b for c, b in CITY_BBOX.items() if not only or c in only}
    path = Path(__file__).parent / "data" / "osm_vendors.json"
    path.parent.mkdir(exist_ok=True)
    existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"vendors": []}
    vendors = list(existing["vendors"])
    for i, (city, bbox) in enumerate(cities.items(), 1):
        print(f"[{i}/{len(cities)}] {city} ...", flush=True)
        try:
            rows = build(city, fetch_city(bbox))
        except RuntimeError as e:
            print(f"    SKIPPED {city}: {e}", flush=True)
            continue
        by = {}
        for r in rows:
            by[r["category"]] = by.get(r["category"], 0) + 1
        print(f"    kept {len(rows)}: {by}", flush=True)
        vendors = [v for v in vendors if v["city"] != city] + rows  # replace the city only once its refresh succeeded
        path.write_text(json.dumps({
            "source": "OpenStreetMap contributors (ODbL), https://www.openstreetmap.org/copyright",
            "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "vendors": vendors,
        }, ensure_ascii=False, indent=1), encoding="utf-8")
        time.sleep(20)  # be polite to the public Overpass servers
    print("done:", len(vendors), "listings", flush=True)


if __name__ == "__main__":
    main()
