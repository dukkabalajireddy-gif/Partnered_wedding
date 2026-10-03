"""Shipment tracking through Delhivery's Track API.

Demo waybills: DEMO1 to DEMO5 stand still at one of the five steps. DEMO<10-digit unix time> (made by the app when a
parcel is added without a waybill) is a whole journey that moves forward by itself, one scan every 20 seconds, so a
parcel visibly travels while someone watches.

The token lives only in backend/.env (DELHIVERY_TOKEN), never in the browser. Set DELHIVERY_ENV=production to use the
live service; the default is Delhivery's staging environment. Waybills that start with DEMO (DEMO1 to DEMO5) return a
made-up journey, so the screens can be shown before any real shipment or token exists.
"""
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

router = APIRouter()

URLS = {
    "staging": "https://staging-express.delhivery.com/api/v1/packages/json/",
    "production": "https://track.delhivery.com/api/v1/packages/json/",
}
STEPS = ["Ordered", "Picked up", "In transit", "Out for delivery", "Delivered"]  # same five steps as the app
WAYBILL = re.compile(r"^[A-Za-z0-9_-]{4,40}$")
CACHE_SECONDS = 60  # Delhivery allows 750 requests per 5 minutes per IP; this keeps repeat refreshes cheap
_cache: dict[str, tuple[float, dict]] = {}


def _env() -> str:
    return "production" if os.getenv("DELHIVERY_ENV", "staging").lower() == "production" else "staging"


def step_for(status: str, status_type: str) -> int:
    """Map Delhivery's wording onto our five steps."""
    s, t = (status or "").strip().lower(), (status_type or "").strip().upper()
    if t == "DL" or s == "delivered":
        return 4
    if "out for delivery" in s or "dispatched" in s:
        return 3
    if "transit" in s or "reached" in s or "arrived" in s or "hub" in s:
        return 2
    if "picked" in s or t == "PU":
        return 1
    return 0


def parse_shipment(ship: dict) -> dict:
    """One shipment from Delhivery's reply, in the shape the app uses. Every field is optional on their side."""
    st = ship.get("Status") or {}
    status, status_type = st.get("Status") or "", st.get("StatusType") or ""
    scans = []
    for item in ship.get("Scans") or []:
        d = item.get("ScanDetail", item) if isinstance(item, dict) else {}
        scans.append({
            "time": d.get("ScanDateTime") or d.get("StatusDateTime") or "",
            "status": d.get("Scan") or d.get("Status") or "",
            "location": d.get("ScannedLocation") or "",
            "note": d.get("Instructions") or "",
        })
    scans.sort(key=lambda x: x["time"], reverse=True)  # newest first
    returning = status_type.upper() == "RT" or "rto" in status.lower() or "return" in status.lower()
    return {
        "found": True, "awb": ship.get("AWB") or "", "status": status, "step": step_for(status, status_type),
        "returning": returning, "location": st.get("StatusLocation") or "", "updatedAt": st.get("StatusDateTime") or "",
        "note": st.get("Instructions") or "", "expectedDelivery": (ship.get("ExpectedDeliveryDate") or "")[:10],
        "origin": ship.get("Origin") or "", "destination": ship.get("Destination") or "", "scans": scans,
    }


def fetch_live(waybills: list[str]) -> dict[str, dict]:
    """Ask Delhivery about up to 50 waybills in one request."""
    token = os.getenv("DELHIVERY_TOKEN", "").strip()
    url = f"{URLS[_env()]}?{urllib.parse.urlencode({'waybill': ','.join(waybills), 'ref_ids': ''}, safe=',')}"
    req = urllib.request.Request(url, headers={"Authorization": f"Token {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        reason = {401: "Delhivery did not accept the token.", 403: "Delhivery did not accept the token.", 429: "Too many tracking requests. Try again in a few minutes."}.get(e.code, f"Delhivery returned an error ({e.code}).")
        return {w: {"found": False, "error": reason} for w in waybills}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return {w: {"found": False, "error": "Could not reach Delhivery. Try again shortly."} for w in waybills}

    out = {w: {"found": False, "error": "Delhivery has no shipment with this waybill number."} for w in waybills}
    for entry in data.get("ShipmentData") or []:
        ship = entry.get("Shipment") if isinstance(entry, dict) else None
        if ship and ship.get("AWB") in out:
            out[ship["AWB"]] = parse_shipment(ship)
    return out


# One scan per entry: (Delhivery status, what the scan says, place, our step, hours since the previous scan)
JOURNEY = [
    ("Manifested", "Shipment information received", "{o} Facility", 0, 0),
    ("Picked Up", "Shipment picked up from sender", "{o} Facility", 1, 3),
    ("In Transit", "Shipment received at origin centre", "{o} Origin Centre", 2, 2),
    ("In Transit", "Shipment dispatched from origin hub", "{o} Hub", 2, 4),
    ("In Transit", "Shipment reached destination hub", "{d} Hub", 2, 11),
    ("In Transit", "Shipment arrived at delivery centre", "{d} Delivery Centre", 2, 6),
    ("Dispatched", "Out for delivery", "{d} Delivery Centre", 3, 4),
    ("Delivered", "Delivered to consignee", "{d}", 4, 3),
]
SECONDS_PER_SCAN = 20


def clean_place(s: str, fallback: str) -> str:
    s = re.sub(r"[^A-Za-z \-]", "", s or "").strip()[:40]
    return s or fallback


def journey_shipment(waybill: str, origin: str, dest: str) -> dict:
    """A parcel that moves by itself. The scan times look like a real multi-day journey, ending just now."""
    created = int(re.search(r"(\d{9,10})$", waybill).group(1))
    done = max(1, min(len(JOURNEY), 1 + int((time.time() - created) // SECONDS_PER_SCAN)))
    now = datetime.now()
    scans, t = [], now - timedelta(minutes=2)
    for i in range(done - 1, -1, -1):  # walk back from the newest scan
        status, note, place, _, gap = JOURNEY[i]
        scans.append({"time": t.strftime("%Y-%m-%dT%H:%M:%S"), "status": status, "location": place.format(o=origin, d=dest), "note": note})
        t -= timedelta(hours=gap, minutes=7 * (i % 3))
    last = JOURNEY[done - 1]
    remaining = sum(j[4] for j in JOURNEY[done:])
    return {
        "found": True, "awb": waybill, "status": last[0], "step": last[3], "returning": False,
        "location": scans[0]["location"], "updatedAt": scans[0]["time"], "note": last[1],
        "expectedDelivery": (now + timedelta(hours=remaining)).strftime("%Y-%m-%d"),
        "origin": origin, "destination": dest, "scans": scans,
    }


def demo_shipment(waybill: str) -> dict:
    """DEMO1..DEMO5 stand for the five steps (DEMO0 behaves like DEMO1). Anything else starting with DEMO is in transit."""
    m = re.search(r"(\d)$", waybill)
    step = min(4, max(0, int(m.group(1)) - 1)) if m else 2
    now = datetime.now()
    plan = [("Manifested", "Shipment created", "Hyderabad"), ("Picked up", "Picked up from sender", "Hyderabad"),
            ("In Transit", "Arrived at sorting hub", "Hyderabad Hub"), ("Dispatched", "Out for delivery", "Local delivery centre"),
            ("Delivered", "Delivered to recipient", "Delivery address")]
    scans = [{"time": (now - timedelta(hours=6 * (step - i) + 1)).strftime("%Y-%m-%dT%H:%M:%S"), "status": plan[i][0], "location": plan[i][2], "note": plan[i][1]}
             for i in range(step + 1)]
    scans.reverse()
    return {
        "found": True, "awb": waybill, "status": plan[step][0], "step": step, "returning": False, "location": plan[step][2],
        "updatedAt": scans[0]["time"], "note": plan[step][1],
        "expectedDelivery": (now + timedelta(days=max(0, 4 - step))).strftime("%Y-%m-%d"),
        "origin": "Hyderabad", "destination": "Your delivery address", "scans": scans,
    }


@router.get("/tracking")
def tracking(waybill: str, routes: str = ""):
    """Status and scan history for one or more waybills (comma-separated, up to 50)."""
    ids = list(dict.fromkeys(w.strip() for w in waybill.split(",") if w.strip()))
    if not ids:
        raise HTTPException(422, "Give at least one waybill number.")
    if len(ids) > 50:
        raise HTTPException(422, "Track at most 50 waybills at a time.")
    if not all(WAYBILL.match(w) for w in ids):
        raise HTTPException(422, "Waybill numbers may only contain letters, digits, dashes and underscores.")

    try:  # {"WAYBILL": ["Origin city", "Destination city"]}: only used to dress up demo journeys
        route_map = json.loads(routes) if routes and len(routes) < 4000 else {}
    except json.JSONDecodeError:
        route_map = {}
    live_ready = bool(os.getenv("DELHIVERY_TOKEN", "").strip())
    results: dict[str, dict] = {}
    to_fetch = []
    for w in ids:
        if w.upper().startswith("DEMO"):
            if re.fullmatch(r"DEMO\d{9,10}", w.upper()):
                o, d = (route_map.get(w) or ["Origin", "Destination"])[:2] if isinstance(route_map.get(w), list) else ["Origin", "Destination"]
                results[w] = {**journey_shipment(w.upper(), clean_place(o, "Origin"), clean_place(d, "Destination")), "awb": w, "source": "demo"}
            else:
                results[w] = {**demo_shipment(w.upper()), "awb": w, "source": "demo"}
        elif not live_ready:
            results[w] = {"found": False, "notConnected": True, "error": "Live tracking is not connected yet."}
        elif w in _cache and time.time() - _cache[w][0] < CACHE_SECONDS:  # cached answers already carry their source
            results[w] = _cache[w][1]
        else:
            to_fetch.append(w)
    if to_fetch:
        for w, res in fetch_live(to_fetch).items():
            if res.get("found"):
                res["source"] = _env()
            results[w] = res
            if res.get("found"):
                _cache[w] = (time.time(), res)
    source = "demo" if all(w.upper().startswith("DEMO") for w in ids) else (_env() if live_ready else "not_connected")
    return {"source": source, "shipments": results}
