"""Vendor marketplace endpoints: the list of cities and the vendors in each."""
from fastapi import APIRouter, HTTPException

from vendor_db import cities_summary, vendor_profile, vendors_in_city

router = APIRouter()


@router.get("/cities")
def cities():
    return {"cities": cities_summary()}


@router.get("/vendors")
def vendors(city: str, guests: int = 200, days: int = 3):
    """All sample vendors in a city, best Partner score first. Cost estimates use the couple's guest count and number of days."""
    rows = vendors_in_city(city)
    if not rows:
        raise HTTPException(404, f"No vendors listed for {city} yet.")
    guests, days = max(1, guests), max(1, days)
    profiles = [vendor_profile(v, guests, days) for v in rows]
    profiles.sort(key=lambda p: (-p["partnerScore"], p["name"]))
    return {"city": rows[0]["city"], "count": len(profiles), "vendors": profiles}
