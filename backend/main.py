# =============================================================================
# Article Agent — FastAPI Backend
# =============================================================================
# How to run (from the backend/ directory):
#
#   python -m venv venv
#   source venv/bin/activate            # Windows: venv\Scripts\activate
#   pip install -r requirements.txt
#   uvicorn main:app --reload --port 8000
#
# Then open http://localhost:8000/docs for the interactive API docs.
# =============================================================================

import os
import uuid

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, HttpUrl

# Load environment variables from a local .env file (if present).
load_dotenv()

# The n8n webhook URL that incoming /process requests are forwarded to.
# When unset, /process still accepts requests but does not forward them.
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL")

# Timeout (in seconds) for the outbound request to the n8n webhook.
WEBHOOK_TIMEOUT_SECONDS = 60.0

app = FastAPI(title="Article Agent Backend", version="1.0.0")

# -----------------------------------------------------------------------------
# CORS — allow the local frontend dev servers to call this API.
# "*" is acceptable for development; tighten this list for production.
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Request / response models (Pydantic v2 syntax)
# -----------------------------------------------------------------------------
class ProcessRequest(BaseModel):
    """Body for POST /process."""

    # EmailStr validates the address format (requires the `email-validator` pkg,
    # installed via pydantic[email]).
    email: EmailStr

    # HttpUrl ensures the value is a valid http/https URL. It is declared as a
    # str-compatible URL type; we serialize it back to a plain string before
    # forwarding to n8n.
    article_url: HttpUrl


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.get("/health")
async def health():
    """Simple liveness probe."""
    return {"status": "ok"}


@app.post("/process")
async def process(payload: ProcessRequest):
    """
    Accept an article-processing request, assign it a session id, and forward
    it to the configured n8n webhook.

    Behavior:
      - Always generates a unique session_id.
      - If N8N_WEBHOOK_URL is set, forwards the payload and returns the
        webhook's HTTP status code.
      - If N8N_WEBHOOK_URL is unset, returns the session_id with a
        'queued_no_webhook' status and a warning instead of forwarding.
      - On any httpx transport/HTTP error, responds with HTTP 502 (never
        crashes the server).
    """
    session_id = str(uuid.uuid4())

    # Build the payload forwarded to n8n. article_url is cast to str so the
    # JSON body contains a plain URL string rather than a Pydantic URL object.
    forward_payload = {
        "email": payload.email,
        "article_url": str(payload.article_url),
        "session_id": session_id,
    }

    # No webhook configured — accept the request but don't forward it.
    if not N8N_WEBHOOK_URL:
        return {
            "session_id": session_id,
            "status": "queued_no_webhook",
            "warning": "N8N_WEBHOOK_URL is not set; request was not forwarded.",
        }

    # Forward to n8n. Any network/HTTP error is converted into a clean 502.
    try:
        async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT_SECONDS) as client:
            response = await client.post(N8N_WEBHOOK_URL, json=forward_payload)
    except httpx.HTTPError as exc:
        # Covers timeouts, connection errors, etc. — return a clear 502.
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach n8n webhook: {exc}",
        )

    return {
        "session_id": session_id,
        "status": "submitted",
        "n8n_status": response.status_code,
    }
