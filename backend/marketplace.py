"""Vendor marketplace endpoints: the list of cities and the vendors in each."""
from fastapi import APIRouter, HTTPException

from vendor_db import cities_summary, vendor_profile, vendors_in_city

router = APIRouter()


@router.get("/cities")
def cities():
    return {"cities": cities_summary()}


@router.get("/vendors")
def vendors(city: str, guests: int = 200, days: int = 3):
    """Vendors in a city. Highest Partner score first."""
    rows = vendors_in_city(city)
    if not rows:
        raise HTTPException(404, f"No vendors listed for {city} yet.")
    guests, days = max(1, guests), max(1, days)
    profiles = [vendor_profile(v, guests, days) for v in rows]

    profiles.sort(key=lambda p: (-(p["partnerScore"] or 0), p["name"].lower()))
    return {
        "city": rows[0]["city"], "count": len(profiles), "realCount": sum(1 for p in profiles if p["source"] == "osm"),
        "attribution": "Listings © OpenStreetMap contributors (ODbL)", "vendors": profiles,
    }
