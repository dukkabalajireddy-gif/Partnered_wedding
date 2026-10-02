"""Vendor marketplace endpoints: the list of cities and the vendors in each."""
from fastapi import APIRouter, HTTPException

from vendor_db import cities_summary, vendor_profile, vendors_in_city

router = APIRouter()


@router.get("/cities")
def cities():
    return {"cities": cities_summary()}


@router.get("/vendors")
def vendors(city: str, guests: int = 200, days: int = 3):
    """Vendors in a city. Real listings (OpenStreetMap) come first, most complete first; then sample vendors by Partner score."""
    rows = vendors_in_city(city)
    if not rows:
        raise HTTPException(404, f"No vendors listed for {city} yet.")
    guests, days = max(1, guests), max(1, days)
    profiles = [vendor_profile(v, guests, days) for v in rows]

    def order(p: dict):
        if p["source"] == "osm":
            return (0, -(bool(p["phone"]) + bool(p["website"])), p["name"].lower())
        return (1, -p["partnerScore"], p["name"].lower())

    profiles.sort(key=order)
    return {
        "city": rows[0]["city"], "count": len(profiles), "realCount": sum(1 for p in profiles if p["source"] == "osm"),
        "attribution": "Real listings © OpenStreetMap contributors (ODbL)", "vendors": profiles,
    }
