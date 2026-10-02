import json
import os
import re

from openai import OpenAI


def llm_ready() -> bool:
    return bool(os.getenv("LLM_API_KEY") and os.getenv("LLM_BASE_URL") and os.getenv("LLM_MODEL"))


def get_client() -> OpenAI:
    # Grok (xAI), Groq and Gemini all offer OpenAI-compatible APIs, so one client works for any
    # of them: change LLM_BASE_URL / LLM_MODEL / LLM_API_KEY in .env.
    return OpenAI(api_key=os.getenv("LLM_API_KEY"), base_url=os.getenv("LLM_BASE_URL"), timeout=25)


def chat_text(system: str, user: str, max_tokens: int = 2000) -> str:
    resp = get_client().chat.completions.create(
        model=os.getenv("LLM_MODEL", ""),
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=max_tokens,
        temperature=0.3,
    )
    return (resp.choices[0].message.content or "").strip()


def chat_json(system: str, user: str) -> dict | None:
    """Ask for a JSON object and parse it leniently. Returns None if nothing usable came back."""
    text = chat_text(system + " Reply with a single JSON object and nothing else.", user)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(re.sub(r",\s*([}\]])", r"\1", text[start : end + 1]))
    except json.JSONDecodeError:
        return None
