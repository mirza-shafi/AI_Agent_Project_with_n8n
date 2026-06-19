# AI Article Agent (React + FastAPI + n8n + Gemini)

A mini AI workflow system. A user submits an **email** and an **article URL**.
The system scrapes the article, uses **Google Gemini** to summarize it and extract
key insights, saves everything to **Google Sheets**, and **emails** the result back.

```
React (frontend)  ──POST /process──►  FastAPI (backend)  ──webhook──►  n8n workflow
  email + URL                          + session_id                     │
                                                                        ├─ Scrape article (HTTP)
                                                                        ├─ Gemini: summary
                                                                        ├─ Gemini: insights
                                                                        ├─ Append to Google Sheets
                                                                        └─ Send email (Gmail)
```

## Repository layout

```
AI_Agent_Project_with_n8n/
├── backend/            FastAPI app (generates session_id, forwards to n8n)
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/           React + Vite UI (email + URL form)
│   ├── src/App.jsx
│   └── .env.example
├── n8n/
│   ├── workflow.json       Import this into n8n
│   └── docker-compose.yml  Run n8n locally
└── docs/
    ├── N8N_GUIDE.md          ★ Step-by-step n8n guide (start here if new to n8n)
    └── CREDENTIALS_GUIDE.md  ★ How to get every API key / credential
```

## Quick start (run order)

> Recommended order: **1) n8n** → **2) backend** → **3) frontend**.
> You need n8n running first so the backend has a webhook URL to point to.

### 1. Start n8n and import the workflow
Full beginner walkthrough: **[docs/N8N_GUIDE.md](docs/N8N_GUIDE.md)**.
All API keys / credentials: **[docs/CREDENTIALS_GUIDE.md](docs/CREDENTIALS_GUIDE.md)**.

Short version (self-hosted via Docker):
```bash
cd n8n
docker compose up -d
# open http://localhost:5678  (user: admin / pass: changeme)
```
Then import `n8n/workflow.json`, attach credentials (Gemini, Google Sheets, Gmail),
and **Activate** the workflow. Copy the **Production webhook URL** from the Webhook node.

### 2. Start the backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env -> set N8N_WEBHOOK_URL to the Production webhook URL from n8n
uvicorn main:app --reload --port 8000
```
Check: open http://localhost:8000/health → `{"status":"ok"}`.

### 3. Start the frontend
```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm run dev
# open http://localhost:5173
```

## How the data flows

1. **Frontend** collects `email` + `article_url`, POSTs to the backend `/process`.
2. **Backend** generates a `session_id` (UUID), forwards `{ email, article_url, session_id }`
   to the n8n **Production webhook** URL, and returns the `session_id` to the UI.
3. **n8n** scrapes the article, runs two Gemini calls (summary + insights),
   appends a row to Google Sheets, and emails the user.

## Endpoints (backend)

| Method | Path       | Body                              | Returns |
|--------|------------|-----------------------------------|---------|
| GET    | `/health`  | –                                 | `{ "status": "ok" }` |
| POST   | `/process` | `{ "email", "article_url" }`      | `{ "session_id", "status", "n8n_status" }` |

## Security notes
- The backend uses permissive CORS for local dev — restrict origins before deploying.
- The n8n Docker setup uses basic auth `admin/changeme` — change it in `docker-compose.yml`.
- Never commit real `.env` files or API keys. Only `.env.example` files are tracked.
- The n8n webhook is unauthenticated by default. For anything beyond local testing,
  add a header-auth credential to the Webhook node and send it from the backend.

## Google Sheet columns
Create a sheet with these header columns in **row 1** (exact names):
```
Session ID | Article URL | Summary | Insights | Email | Timestamp
```
