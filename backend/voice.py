"""Voice through Gnani: speak a message instead of typing it (speech to text), and listen to a reply (text to speech).

English (en-IN) and Hindi (hi-IN) only for now. The key lives only in backend/.env as GNANI_API_KEY and is sent in Gnani's
X-API-Key-ID header from here; the browser never sees it. Without a key, /voice/config says so and the app hides the
voice buttons' live behaviour.
"""
import json
import os
import re
import uuid
import urllib.error
import urllib.request

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from llm import chat_text, llm_ready

router = APIRouter()

BASE = "https://api.vachana.ai"
LANGS = {"en-IN": "Kaveri", "hi-IN": "Nalini"}  # language -> the voice we use for it
MAX_AUDIO_BYTES = 4 * 1024 * 1024               # also stays under serverless request limits
MAX_SPEAK_CHARS = 700
UA = "PartneredMVP/0.1 (wedding planner prototype)"  # Gnani sits behind Cloudflare, which blocks the bare Python user-agent (error 1010)


def configured() -> bool:
    return bool(os.getenv("GNANI_API_KEY", "").strip())


def _key() -> str:
    return os.getenv("GNANI_API_KEY", "").strip()


def _explain(code: int) -> str:
    return {
        401: "Gnani did not accept the key in backend/.env. Generate an API key at app.gnani.ai/voice and update GNANI_API_KEY.",
        400: "Gnani could not use that request.", 403: "Gnani did not accept the key, or the account is out of credits.",
        429: "Too many voice requests. Try again in a moment.", 500: "Gnani had a problem. Try again.", 503: "Gnani is busy. Try again shortly.",
    }.get(code, f"Gnani returned an error ({code}).")


@router.get("/voice/config")
def voice_config():
    return {"configured": configured(), "languages": list(LANGS)}


@router.post("/voice/transcribe")
async def transcribe(request: Request, language: str = "en-IN"):
    """Body: the recorded audio itself (WAV). Returns {"transcript": "..."}."""
    if language not in LANGS:
        raise HTTPException(422, "Choose English or Hindi.")
    if not configured():
        raise HTTPException(503, "Voice is not connected on this server yet.")
    audio = await request.body()
    if not audio or len(audio) < 1000:
        raise HTTPException(422, "No audio was received.")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "That recording is too long. Keep it under about 45 seconds.")

    boundary = uuid.uuid4().hex
    parts = []
    for name, value in (("language_code", language), ("format", "transcribe")):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="audio_file"; filename="speech.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + audio + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(f"{BASE}/stt/v3", data=b"".join(parts), method="POST",
                                 headers={"X-API-Key-ID": _key(), "User-Agent": UA, "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        raise HTTPException(502, _explain(e.code))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        raise HTTPException(502, "Could not reach Gnani. Try again shortly.")
    return {"transcript": str(data.get("transcript", "")).strip()}


class SpeakIn(BaseModel):
    text: str
    language: str = "en-IN"


def _speakable(text: str) -> str:
    """Say amounts the way a person would: ₹1,10,000 becomes '1,10,000 rupees'."""
    text = re.sub(r"₹\s?([\d,]+(?:\.\d+)?)", r"\1 rupees", text)
    text = re.sub(r"[*_`#]+", "", text)
    return re.sub(r"\s+", " ", text).strip()[:MAX_SPEAK_CHARS]


def _to_hindi(text: str) -> str:
    """English replies are translated to spoken Hindi first, so the Hindi voice reads real Hindi. Falls back to the original."""
    if re.search(r"[\u0900-\u097F]", text) or not llm_ready():
        return text
    try:
        out = chat_text(
            "Translate the message into simple, natural spoken Hindi written in Devanagari. Keep rupee amounts and numbers as digits "
            "(for example 1,10,000), keep people's and business names unchanged, and reply with only the translation.", text)
    except Exception:
        return text
    out = (out or "").strip().strip('"')
    return out if out and re.search(r"[\u0900-\u097F]", out) else text


@router.post("/voice/speak")
def speak(req: SpeakIn):
    """Returns the spoken audio (MP3) for a piece of text."""
    if req.language not in LANGS:
        raise HTTPException(422, "Choose English or Hindi.")
    if not configured():
        raise HTTPException(503, "Voice is not connected on this server yet.")
    text = _speakable(_to_hindi(req.text) if req.language == "hi-IN" else req.text)
    if not text:
        raise HTTPException(422, "Nothing to read out.")
    body = {
        "text": text, "model": "timbre-v2.5", "voice": LANGS[req.language], "language": req.language, "speed": 1.0,
        "audio_config": {"container": "mp3"},  # Gnani's default MP3 settings; a custom 24 kHz rate made longer sentences fail
    }
    http = urllib.request.Request(f"{BASE}/api/v1/tts/inference", data=json.dumps(body).encode(), method="POST",
                                  headers={"X-API-Key-ID": _key(), "User-Agent": UA, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(http, timeout=40) as r:
            audio = r.read()
            kind = r.headers.get("Content-Type", "audio/mpeg")
    except urllib.error.HTTPError as e:
        raise HTTPException(502, _explain(e.code))
    except (urllib.error.URLError, TimeoutError, OSError):
        raise HTTPException(502, "Could not reach Gnani. Try again shortly.")
    return Response(content=audio, media_type=kind.split(";")[0] or "audio/mpeg")
