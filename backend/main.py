import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Partner backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:8443")],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Grok's API is OpenAI-compatible, so we use the openai package with xAI's URL.
MODEL = os.getenv("GROK_MODEL", "")


def get_client() -> OpenAI:
    return OpenAI(api_key=os.getenv("XAI_API_KEY"), base_url="https://api.x.ai/v1")

SYSTEM_PROMPT = (
    "You are Partner, a helpful Indian wedding planning assistant. "
    "Use the available tools when you need data. Amounts are in INR. "
    "Never claim a payment or booking is done; propose it and ask the user to confirm."
)


# ---- Tools the agent can call (replace the stubs with real logic later) ----

def search_vendors(category: str, city: str, max_budget: int) -> list[dict]:
    # TODO: query your real vendor data / database
    return [
        {"name": "Sample Vendor", "category": category, "city": city, "price": max_budget // 2}
    ]


TOOL_FUNCTIONS = {"search_vendors": search_vendors}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_vendors",
            "description": "Find wedding vendors by category, city and maximum budget in INR.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "e.g. catering, photography, decoration"},
                    "city": {"type": "string"},
                    "max_budget": {"type": "integer"},
                },
                "required": ["category", "city", "max_budget"],
            },
        },
    }
]


# ---- API ----

class ChatRequest(BaseModel):
    messages: list[dict]  # [{"role": "user", "content": "..."}]


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/chat")
def chat(req: ChatRequest):
    if not os.getenv("XAI_API_KEY") or not MODEL:
        raise HTTPException(500, "Set XAI_API_KEY and GROK_MODEL in backend/.env")

    client = get_client()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *req.messages]

    # Agent loop: let the model call tools until it gives a final answer (max 5 rounds).
    for _ in range(5):
        resp = client.chat.completions.create(model=MODEL, messages=messages, tools=TOOLS)
        msg = resp.choices[0].message
        if not msg.tool_calls:
            return {"reply": msg.content}

        messages.append(msg.model_dump(exclude_none=True))
        for call in msg.tool_calls:
            fn = TOOL_FUNCTIONS[call.function.name]
            result = fn(**json.loads(call.function.arguments))
            messages.append(
                {"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)}
            )

    return {"reply": "Sorry, I couldn't finish that. Please try again."}
