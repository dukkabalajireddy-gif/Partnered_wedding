import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from agent import router as agent_router  # noqa: E402  (after load_dotenv so env vars are set)
from llm import get_client  # noqa: E402
from marketplace import router as marketplace_router  # noqa: E402
from tracking import router as tracking_router  # noqa: E402
from payments import router as payments_router  # noqa: E402
from vendor_reply import router as vendor_reply_router  # noqa: E402

app = FastAPI(title="Partner backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:8443")],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",  # local development
    allow_methods=["*"],
    allow_headers=["*"],
)

# The agent answers both with and without the "/api" prefix (see health/chat below).
for _router in (agent_router, marketplace_router, tracking_router, vendor_reply_router, payments_router):
    app.include_router(_router)
    app.include_router(_router, prefix="/api")

MODEL = os.getenv("LLM_MODEL", "")

SYSTEM_PROMPT = (
    "You are Partner, a helpful Indian wedding planning assistant. "
    "Use the available tools when you need data. Amounts are in INR. "
    "Never claim a payment or booking is done; propose it and ask the user to confirm. "
    "Only mention vendors, prices or availability that were returned by a tool in this conversation. "
    "Never invent vendors or figures: if a tool returns nothing useful, say so plainly."
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


# Routes answer both with and without the "/api" prefix, so they work locally
# (http://localhost:8000/chat) and behind Vercel's /api rewrite.
@app.get("/health")
@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/chat")
@app.post("/api/chat")
def chat(req: ChatRequest):
    if not os.getenv("LLM_API_KEY") or not os.getenv("LLM_BASE_URL") or not MODEL:
        raise HTTPException(500, "Set LLM_API_KEY, LLM_BASE_URL and LLM_MODEL in backend/.env")

    client = get_client()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *req.messages]

    # Agent loop: let the model call tools until it gives a final answer (max 5 rounds).
    for _ in range(5):
        try:
            resp = client.chat.completions.create(model=MODEL, messages=messages, tools=TOOLS)
        except Exception as e:
            # Surface the provider's error (bad key, wrong model, no tool support...)
            raise HTTPException(502, f"LLM call failed: {type(e).__name__}: {e}")
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
