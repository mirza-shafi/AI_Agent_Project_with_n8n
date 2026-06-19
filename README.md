# AI Article Agent

A mini AI workflow system. A user submits an **email** and an **article URL** through a
React UI. A FastAPI backend forwards the request to an **n8n** workflow, which scrapes the
article, uses **Google Gemini** to summarize it and extract key insights, logs everything
to **Google Sheets**, and **emails** the result back to the user.

```
┌──────────────┐   POST /process    ┌──────────────┐   webhook    ┌────────────────────────┐
│   React UI   │ ─────────────────► │   FastAPI    │ ───────────► │   n8n workflow         │
│ email + URL  │  { email, url }    │   backend    │ { email,url, │                        │
│              │ ◄───────────────── │ + session_id │   session_id}│  Scrape (HTTP)         │
└──────────────┘  { session_id }    └──────────────┘              │  → Gemini summary      │
                                                                   │  → Gemini insights     │
                                                                   │  → Google Sheets       │
                                                                   │  → Gmail               │
                                                                   └────────────────────────┘
```

## Tech stack

- **Frontend:** React + Vite (modern, responsive UI)
- **Backend:** FastAPI (Python) — generates a session id and forwards to n8n
- **Automation:** n8n (self-hosted)
- **AI:** Google Gemini API (`gemma-4-31b-it`)
- **Storage / delivery:** Google Sheets + Gmail

## Repository layout

```
.
├── backend/            FastAPI app
│   ├── main.py             /process + /health, forwards to n8n
│   ├── requirements.txt
│   └── .env.example        N8N_WEBHOOK_URL
└── frontend/           React + Vite UI
    ├── src/App.jsx         email + URL form
    ├── src/App.css
    └── .env.example        VITE_API_URL
```

> The n8n workflow and setup notes are kept outside this repository.

## Getting started

You need a running n8n instance with the workflow imported and **active**, then start the
backend and frontend locally.

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# set N8N_WEBHOOK_URL to your n8n production webhook URL
uvicorn main:app --reload --port 8000
```

Health check: open http://localhost:8000/health → `{"status":"ok"}`.

### 2. Frontend (React)

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm run dev
# open http://localhost:5173
```

## How it works

1. The **frontend** collects an `email` + `article_url` and POSTs them to the backend.
2. The **backend** generates a UUID `session_id`, forwards
   `{ email, article_url, session_id }` to the n8n webhook, and returns the `session_id`.
3. **n8n** scrapes the page, runs two Gemini calls (summary + insights), appends a row to
   Google Sheets, and emails the user their summary and key insights.

## API (backend)

| Method | Path       | Body                          | Returns |
|--------|------------|-------------------------------|---------|
| GET    | `/health`  | –                             | `{ "status": "ok" }` |
| POST   | `/process` | `{ "email", "article_url" }`  | `{ "session_id", "status", "n8n_status" }` |

## Notes

- The backend uses permissive CORS for local development — restrict origins before deploying.
- Never commit real `.env` files or API keys; only `.env.example` files are tracked.
- Secrets (Gemini key, Google/Gmail credentials) live in the n8n credential store, not in code.
