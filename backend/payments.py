"""Payments through Pine Labs Online payment links.

The couple presses Pay now, we create a payment link for that instalment, they pay on Pine Labs' hosted page, and the app
asks us for the link's status until Pine Labs says PROCESSED. Keys live only in backend/.env:

    PINELABS_CLIENT_ID, PINELABS_CLIENT_SECRET, PINELABS_ENV=uat (or production)
    PINELABS_BASE_URL   optional: overrides the address (needed for production until it is confirmed)

Without keys, /payments/link answers {"mode": "demo"} and the app uses its built-in test checkout instead.
"""
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

BASES = {"uat": "https://pluraluat.v2.pinepg.in"}  # the live address is not confirmed yet: set PINELABS_BASE_URL for production
REF = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
ACTIVE = {"CREATED", "CLICKED", "PAYMENT_INITIATED"}
_token = {"value": "", "expires": 0.0}
_lock = threading.Lock()


def _env() -> str:
    return "production" if os.getenv("PINELABS_ENV", "uat").strip().lower() == "production" else "uat"


def _base() -> str:
    override = os.getenv("PINELABS_BASE_URL", "").strip().rstrip("/")
    if override:
        return override
    if _env() == "production":
        raise HTTPException(503, "Set PINELABS_BASE_URL to Pine Labs' live address to take live payments.")
    return BASES["uat"]


def configured() -> bool:
    return bool(os.getenv("PINELABS_CLIENT_ID", "").strip() and os.getenv("PINELABS_CLIENT_SECRET", "").strip())


def _call(method: str, path: str, body: dict | None = None, auth: bool = True, timeout: int = 20):
    """One request to Pine Labs. Returns (status, json). Never puts a key or token into an error message."""
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {_get_token()}"
    req = urllib.request.Request(_base() + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode() or "{}"
            return r.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"message": raw[:200]}
    except (urllib.error.URLError, TimeoutError, OSError):
        raise HTTPException(502, "Could not reach Pine Labs. Try again shortly.")


def _get_token() -> str:
    with _lock:
        if _token["value"] and time.time() < _token["expires"] - 60:
            return _token["value"]
        payload = {"client_id": os.getenv("PINELABS_CLIENT_ID", "").strip(), "client_secret": os.getenv("PINELABS_CLIENT_SECRET", "").strip(), "grant_type": "client_credentials"}
        req = urllib.request.Request(_base() + "/api/auth/v1/token", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.load(r)
        except urllib.error.HTTPError as e:
            raise HTTPException(502, "Pine Labs did not accept the keys in backend/.env." if e.code in (400, 401, 403) else f"Pine Labs returned an error ({e.code}).")
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
            raise HTTPException(502, "Could not reach Pine Labs. Try again shortly.")
        _token["value"] = data.get("access_token", "")
        try:
            _token["expires"] = datetime.fromisoformat(str(data.get("expires_at", "")).replace("Z", "+00:00")).timestamp()
        except ValueError:
            _token["expires"] = time.time() + 600
        if not _token["value"]:
            raise HTTPException(502, "Pine Labs did not return an access token.")
        return _token["value"]


def _pick(d: dict, *keys):
    """The first non-empty value among several possible field names (Pine Labs wraps some replies in a data object)."""
    for src in (d, d.get("data") if isinstance(d.get("data"), dict) else {}):
        for k in keys:
            if src.get(k):
                return src[k]
    return None


def _summary(resp: dict, ref: str = "") -> dict:
    return {
        "linkId": _pick(resp, "payment_link_id", "id"),
        "url": _pick(resp, "payment_link", "payment_link_url", "short_url", "url", "link"),
        "status": str(_pick(resp, "status", "payment_link_status") or "").upper(),
        "reference": ref,
    }


class Customer(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""


class LinkIn(BaseModel):
    paymentId: str
    amount: int            # in rupees
    description: str = ""
    customer: Customer = Customer()
    tags: dict[str, str] = {}


class CancelIn(BaseModel):
    linkId: str


LINK_ID = re.compile(r"^[A-Za-z0-9_-]{5,80}$")


@router.get("/payments/config")
def payments_config():
    return {"configured": configured(), "env": _env() if configured() else None}


@router.post("/payments/link")
def create_link(req: LinkIn):
    """Create a payment link for one instalment. Pine Labs refuses a reference it has seen, so a retry gets -r1, -r2..."""
    if not REF.match(req.paymentId):
        raise HTTPException(422, "That payment id is not valid.")
    if not 1 <= req.amount <= 500_000_000:
        raise HTTPException(422, "The amount must be between ₹1 and ₹50 crore.")
    if not configured():
        return {"mode": "demo"}

    digits = re.sub(r"\D", "", req.customer.phone)
    customer = {"first_name": req.customer.name.strip()[:50] or "Customer"}  # Pine Labs insists on customer details
    if len(digits) >= 10:
        customer.update({"mobile_number": digits[-10:], "country_code": "91"})
    if req.customer.email.strip():
        customer["email_id"] = req.customer.email.strip()
    body = {
        "amount": {"value": req.amount * 100, "currency": "INR"},  # Pine Labs wants paise
        "description": (req.description or "Wedding payment")[:200],
        "expire_by": (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "customer": customer,
        "merchant_metadata": {k[:40]: v[:200] for k, v in list(req.tags.items())[:10]},
    }
    callback = os.getenv("FRONTEND_ORIGIN", "").strip()
    if callback.startswith("https://"):
        body["callback_url"] = callback

    for attempt in range(6):
        ref = req.paymentId if attempt == 0 else f"{req.paymentId}-r{attempt}"
        status, data = _call("POST", "/api/pay/v1/paymentlink", {**body, "merchant_payment_link_reference": ref})
        if status in (200, 201):
            out = _summary(data, ref)
            if not out["linkId"] or not out["url"]:
                raise HTTPException(502, "Pine Labs created the link but did not return its address.")
            return {"mode": "live", "env": _env(), **out}
        if status == 422 and str(data.get("code")) == "DUPLICATE_REQUEST":
            continue
        raise HTTPException(502, f"Pine Labs could not create the payment link: {str(data.get('message') or data.get('code') or status)[:200]}")
    raise HTTPException(409, "Too many earlier links for this instalment.")


@router.get("/payments/status")
def link_status(linkId: str):
    """The state of a payment link: CREATED, CLICKED, PAYMENT_INITIATED, PROCESSED (paid), CANCELLED or EXPIRED."""
    if not LINK_ID.match(linkId):
        raise HTTPException(422, "That link id is not valid.")
    if not configured():
        return {"mode": "demo", "status": "UNKNOWN", "paid": False}
    status, data = _call("GET", f"/api/pay/v1/paymentlink/{linkId}")
    if status == 404:
        raise HTTPException(404, "Pine Labs has no payment link with that id.")
    if status != 200:
        raise HTTPException(502, f"Pine Labs returned an error ({status}).")
    out = _summary(data)
    return {"mode": "live", "env": _env(), **out, "paid": out["status"] == "PROCESSED"}


@router.post("/payments/cancel")
def cancel_link(req: CancelIn):
    """Cancel an unpaid link, for example when the booking changes."""
    if not LINK_ID.match(req.linkId):
        raise HTTPException(422, "That link id is not valid.")
    if not configured():
        return {"mode": "demo", "status": "CANCELLED"}
    status, data = _call("PUT", f"/api/pay/v1/paymentlink/{req.linkId}/cancel")
    if status != 200:
        raise HTTPException(502, f"Pine Labs could not cancel the link: {str(data.get('message') or status)[:150]}")
    return {"mode": "live", **_summary(data)}
