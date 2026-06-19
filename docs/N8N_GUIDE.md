# n8n Step-by-Step Guide (for complete beginners)

This guide assumes you have **never used n8n**. It explains what n8n is, how to run it,
how to import the ready-made workflow, where every node lives, what each node does, and
how to connect the credentials. Take it slowly — every click is spelled out.

---

## 0. What is n8n?

n8n (pronounced "n-eight-n") is a visual **automation tool**. You build a *workflow* by
dragging **nodes** onto a canvas and connecting them with lines. Data flows left → right
from one node to the next. Each node does one job: receive a request, call an API, run
some code, send an email, etc.

In this project, n8n is the "brain": it receives the request from our backend, scrapes the
article, calls Gemini twice (summary + insights), writes a row to Google Sheets, and emails
the user.

---

## 1. Open your n8n instance

Your n8n is already deployed at **https://n8n.mirzashafi.com** — there's nothing to install.

1. Open **https://n8n.mirzashafi.com** in your browser.
2. Log in with your n8n account (the owner/admin login you set when you deployed it).

You should now see the n8n editor: a mostly-empty canvas with a big **"+"** or
**"Add first step"** in the middle, and a left sidebar with **Overview / Workflows / Credentials**.

> Keep this editor protected with a strong login — the instance is reachable from the
> public internet.

---

## 2. The fastest path: IMPORT the ready-made workflow

This repo already contains the finished workflow at **`n8n/workflow.json`**. Importing it
means you do **not** have to build the 9 nodes by hand.

1. In the n8n editor, look at the **top-right corner**. Click the **three-dot menu (⋮)**
   (on some versions it's labelled **"..."** next to the *Save* button).
2. Click **Import from File...** (some versions: **Import workflow → From file**).
3. Select the file `n8n/workflow.json` from this project.
4. The canvas now shows **9 connected nodes**:
   `Webhook → Scrape Article → Clean Text → Gemini Summary → Gemini Insights → Assemble → Append to Google Sheets → Send Email → Respond to Webhook`.
5. Some nodes will show a small **red triangle / "credentials missing"** warning. That's
   expected — you'll fix it in **Section 4**.

> If you imported the workflow, you can **skip Section 3** (building from scratch) and jump
> straight to **Section 4 (credentials)**. Section 3 is only if you want to understand or
> rebuild each node manually.

---

## 3. (Optional) Build the workflow from scratch, node by node

Only do this if you want to learn how it's built or the import failed. Otherwise skip to Section 4.

### How to add a node (general)
- Click the **"+"** button in the **top-right** of the canvas (or the small **"+"** that
  appears on the right edge of an existing node when you hover it).
- A **search panel** slides in from the right. **Type the node name** in the search box.
- Click the node in the results to add it. It drops onto the canvas, already connected to
  the node you came from.
- Click a node to open its **settings panel** on the right. Fill in the fields described below.
- To connect two nodes manually, drag from the small **circle on the right edge** of one
  node to the **left edge** of the next.

### Node 1 — Webhook (the trigger)
- Add node → search **"Webhook"** → choose **Webhook**.
- Settings:
  - **HTTP Method:** `POST`
  - **Path:** `article-agent`
  - **Respond:** `Using 'Respond to Webhook' node`
- This node gives you two URLs (Test and Production) — you'll use them in Section 5.

### Node 2 — Scrape Article (HTTP Request)
- Add node → search **"HTTP Request"** → choose **HTTP Request**.
- Settings:
  - **Method:** `GET`
  - **URL:** click the field, switch to **expression** mode (the small `=`/`fx` toggle) and enter:
    `{{ $json.body.article_url }}`
  - Open **Options → Response → Response Format** → set to **Text** (so we get raw HTML as a string).
  - Optionally set **Options → Timeout** to `30000`.

### Node 3 — Clean Text (Code)
- Add node → search **"Code"** → choose **Code** (JavaScript).
- Paste this into the code box:
  ```javascript
  const wh = $('Webhook').first().json.body;
  let html = $input.first().json.data || '';
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.slice(0, 12000);
  return [{ json: {
    email: wh.email, article_url: wh.article_url,
    session_id: wh.session_id, articleText: text
  }}];
  ```
- This strips HTML tags and keeps the first 12,000 characters of plain text.

### Node 4 — Gemini Summary (HTTP Request)
- Add node → **HTTP Request**.
- Settings:
  - **Method:** `POST`
  - **URL:** `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent`
  - **Authentication:** `Generic Credential Type` → **Header Auth** (you create this credential in Section 4).
  - **Send Body:** ON → **Body Content Type:** `JSON` → **Specify Body:** `Using JSON` →
    set the JSON field to **expression** mode and paste:
    ```
    {{ { "contents": [ { "parts": [ { "text": "Summarize the following article in 3 to 5 clear sentences. Return only the summary, no preamble.\n\nARTICLE:\n" + $json.articleText } ] } ] } }}
    ```

### Node 5 — Gemini Insights (HTTP Request)
- Same as Node 4, but the JSON body expression is:
  ```
  {{ { "contents": [ { "parts": [ { "text": "Extract 3 to 5 key insights from the following article. Return them as a numbered list. Be concise.\n\nARTICLE:\n" + $('Clean Text').first().json.articleText } ] } ] } }}
  ```
- (We reference `$('Clean Text')` so the model still sees the article text, not the summary.)

### Node 6 — Assemble (Edit Fields / Set)
- Add node → search **"Edit Fields"** (older versions: **"Set"**) → choose it.
- Set **Mode** to *Manual Mapping* and add these string fields (each value in expression mode):
  | Field name   | Value (expression) |
  |--------------|--------------------|
  | session_id   | `{{ $('Clean Text').first().json.session_id }}` |
  | email        | `{{ $('Clean Text').first().json.email }}` |
  | article_url  | `{{ $('Clean Text').first().json.article_url }}` |
  | summary      | `{{ $('Gemini Summary').first().json.candidates[0].content.parts.filter(p => !p.thought).map(p => p.text).join('\n').trim() }}` |
  | insights     | `{{ $json.candidates[0].content.parts.filter(p => !p.thought).map(p => p.text).join('\n').trim() }}` |

  > Note: `gemma-4-31b-it` is a **thinking** model — its response includes an extra
  > `parts[]` entry marked `"thought": true` (its reasoning). The `.filter(p => !p.thought)`
  > above drops the reasoning and keeps only the real answer. (This also works fine for
  > non-thinking models, which simply have one part.)
  | timestamp    | `{{ $now.toISO() }}` |

### Node 7 — Append to Google Sheets
- Add node → search **"Google Sheets"** → choose **Google Sheets**.
- **Resource:** `Sheet Within Document`, **Operation:** `Append Row`.
- **Credential:** Google Sheets account (Section 4).
- **Document:** pick your spreadsheet from the dropdown. **Sheet:** pick the tab (e.g. `Sheet1`).
- **Mapping Column Mode:** `Map Each Column Manually`, and map:
  - `Session ID` → `{{ $('Assemble').item.json.session_id }}`
  - `Article URL` → `{{ $('Assemble').item.json.article_url }}`
  - `Summary` → `{{ $('Assemble').item.json.summary }}`
  - `Insights` → `{{ $('Assemble').item.json.insights }}`
  - `Email` → `{{ $('Assemble').item.json.email }}`
  - `Timestamp` → `{{ $('Assemble').item.json.timestamp }}`

### Node 8 — Send Email (Gmail)
- Add node → search **"Gmail"** → choose **Gmail**.
- **Resource:** `Message`, **Operation:** `Send`.
- **Credential:** Gmail account (Section 4).
- **To:** `{{ $('Assemble').item.json.email }}`
- **Subject:** `Your Article Summary & Insights`
- **Email Type:** `Text`
- **Message:**
  ```
  ===== SUMMARY =====
  {{ $('Assemble').item.json.summary }}

  ===== KEY INSIGHTS =====
  {{ $('Assemble').item.json.insights }}
  ```

### Node 9 — Respond to Webhook
- Add node → search **"Respond to Webhook"** → choose it.
- **Respond With:** `JSON`, **Response Body:** `{{ { "status": "done" } }}`.

Connect them in order: 1→2→3→4→5→6→7→8→9. **Save** (top-right).

---

## 4. Attach credentials to the nodes

Each external service needs a **credential**. You create each one **once**, then select it
in the matching node. How to get each key/value is in **[CREDENTIALS_GUIDE.md](CREDENTIALS_GUIDE.md)** —
keep that open in another tab.

### Where the Credentials screen is
- In the **left sidebar** of n8n, click **Credentials**. This lists all saved credentials.
- Click **"Add credential"** (top-right) to create a new one. You can also create a
  credential directly from inside a node's **Credential** dropdown → **"+ Create New Credential"**.

### 4a. Gemini API (used by both Gemini nodes)
1. Credentials → **Add credential** → search **"Header Auth"** → select **Header Auth**.
2. Fill in:
   - **Name (of the credential):** `Gemini API` (any label)
   - **Header Name:** `x-goog-api-key`
   - **Header Value:** *paste your Google AI Studio API key* (see CREDENTIALS_GUIDE).
3. **Save**.
4. Open the **Gemini Summary** node → **Authentication** = *Generic Credential Type* →
   *Header Auth* → in the **Credential** dropdown pick **Gemini API**.
5. Do the same for the **Gemini Insights** node (same credential).

### 4b. Google Sheets
1. Open the **Append to Google Sheets** node → **Credential** dropdown →
   **+ Create New Credential** → it will be **Google Sheets OAuth2 API**.
2. Follow CREDENTIALS_GUIDE to get the **Client ID** and **Client Secret**, paste them in,
   then click **"Sign in with Google"** and allow access.
3. Back in the node, pick your **Document** (spreadsheet) and **Sheet** (tab) from the dropdowns.

### 4c. Gmail
1. Open the **Send Email** node → **Credential** dropdown → **+ Create New Credential** →
   **Gmail OAuth2**.
2. Follow CREDENTIALS_GUIDE (same Google Cloud project as Sheets is fine — just enable the
   Gmail API too). Paste Client ID/Secret, **Sign in with Google**, allow access.

> When all credentials are attached, the red warning triangles on the nodes disappear.

---

## 5. Activate the workflow and get the webhook URL

1. Click any node, then click the **Webhook** node to open it.
2. You'll see two URLs:
   - **Test URL** — works only while you press **"Listen for test event"** (good for one-off tests).
   - **Production URL** — works whenever the workflow is **Active**. For your deployment:
     `https://n8n.mirzashafi.com/webhook/article-agent`
3. **Copy the Production URL.**
4. Toggle the workflow **Active** using the **switch in the top-right** of the editor.
5. Put that Production URL into the backend: `backend/.env` →
   `N8N_WEBHOOK_URL=<paste production URL>`.

---

## 6. Test it end-to-end

**Quick test from a terminal** (replace the URL if on Cloud):
```bash
curl -X POST https://n8n.mirzashafi.com/webhook/article-agent \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","article_url":"https://en.wikipedia.org/wiki/Artificial_intelligence","session_id":"test-123"}'
```
Then check:
- n8n: left sidebar → **Executions** shows a new run (all nodes green = success).
- Your **Google Sheet** has a new row.
- Your **email inbox** has the summary + insights.

**Full-stack test:** start the backend and frontend (see main README), open
http://localhost:5173, enter your email + an article URL, and submit.

---

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Webhook returns 404 | Workflow is not **Active**, or you used the Test URL without clicking "Listen". |
| Gemini node 400/403 | Wrong header name (must be `x-goog-api-key`) or invalid/expired API key. |
| Gemini node 404 model | Model name not found for your key — list available models (see below) and put a valid one in the URL, e.g. `gemma-3-27b-it` or `gemini-2.0-flash`. |
| Sheets node error | The header row names must match exactly: `Session ID, Article URL, Summary, Insights, Email, Timestamp`. Re-select Document/Sheet. |
| Gmail "insufficient scope" | Re-create the Gmail credential and make sure the Gmail API is enabled in Google Cloud. |
| Empty summary | The page blocked scraping. Try a simpler article URL (e.g. a Wikipedia page). |
| Code node disabled | Your n8n instance must allow the Code node. If it's blocked, set the env var `NODE_FUNCTION_ALLOW_BUILTIN=*` on the server and restart n8n. |

---

Next: open **[CREDENTIALS_GUIDE.md](CREDENTIALS_GUIDE.md)** to get each API key/credential.
