# Credentials Guide — getting every API key & login

This workflow needs **three** credentials. This guide shows exactly where to click to get
each one, and what to paste into n8n. Pair this with **[N8N_GUIDE.md](N8N_GUIDE.md) Section 4**.

| # | Credential | Used by | What you need |
|---|------------|---------|---------------|
| 1 | **Gemini API key** | Gemini Summary + Gemini Insights nodes | one API key string |
| 2 | **Google Sheets (OAuth2)** | Append to Google Sheets node | Client ID + Client Secret + Google sign-in |
| 3 | **Gmail (OAuth2)** | Send Email node | Client ID + Client Secret + Google sign-in |

> Tip: credentials 2 and 3 can share **one** Google Cloud project. You set the project up
> once, enable two APIs (Sheets + Gmail), create one OAuth client, and reuse the same
> Client ID/Secret for both.

---

## 1. Gemini API key (Google AI Studio)

This is the easiest one — no billing required for the free tier.

1. Go to **https://aistudio.google.com/app/apikey** (sign in with your Google account).
2. Click **"Create API key"** (choose / create a Google Cloud project if asked).
3. A long key like `AIza....` appears. Click **Copy**.
4. In n8n: **Credentials → Add credential → Header Auth**, then set:
   - **Header Name:** `x-goog-api-key`
   - **Header Value:** *(paste the key)*
   - **Save** (name it `Gemini API`).
5. Select this credential in both Gemini nodes.

**Verify the key works** (optional, from a terminal):
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent" \
  -H "x-goog-api-key: YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}'
```
A JSON reply with `candidates` means the key is good.

---

## 2 & 3. Google OAuth (for Google Sheets AND Gmail)

Both Google nodes use **OAuth2**. Do these steps once.

### Step A — Create / pick a Google Cloud project
1. Go to **https://console.cloud.google.com/**.
2. Top bar → project dropdown → **New Project** → name it `n8n-article-agent` → **Create**.
3. Make sure that project is selected in the top bar.

### Step B — Enable the two APIs
1. Left menu → **APIs & Services → Library**.
2. Search **"Google Sheets API"** → open it → **Enable**.
3. Search **"Gmail API"** → open it → **Enable**.

### Step C — Configure the OAuth consent screen
1. Left menu → **APIs & Services → OAuth consent screen**.
2. **User Type:** choose **External** → **Create**.
3. Fill required fields: App name (`n8n article agent`), your support email, developer email.
   Skip optional fields → **Save and Continue** through the steps.
4. On **Test users**, click **+ Add Users** and add **your own Gmail address**
   (important — while the app is in "Testing", only listed users can sign in).
5. **Save**. You don't need to publish/verify the app for personal use.

### Step D — Create the OAuth Client ID
1. Left menu → **APIs & Services → Credentials**.
2. **+ Create Credentials → OAuth client ID**.
3. **Application type:** **Web application**.
4. Under **Authorized redirect URIs → + Add URI**, paste the redirect URL that **n8n shows you**.
   - To find it: in n8n, open the **Append to Google Sheets** node → Credential dropdown →
     **+ Create New Credential** (Google Sheets OAuth2 API). n8n displays an
     **OAuth Redirect URL** — copy it. For your deployment it will be:
     - **Your instance:** `https://n8n.mirzashafi.com/rest/oauth2-credential/callback`
     - (local Docker would be `http://localhost:5678/rest/oauth2-credential/callback`)
5. Click **Create**. A dialog shows your **Client ID** and **Client Secret** — copy both.

### Step E — Put it into n8n (Sheets)
1. In the n8n **Google Sheets OAuth2 API** credential form, paste **Client ID** and
   **Client Secret**.
2. Click **"Sign in with Google"** → pick your account → allow the permissions.
   - If you see an "unverified app" warning, click **Advanced → Go to n8n article agent (unsafe)**.
     This is safe because it's your own app.
3. The credential shows **"Account connected"**. **Save**.

### Step F — Put it into n8n (Gmail)
1. Open the **Send Email** node → Credential → **+ Create New Credential** → **Gmail OAuth2**.
2. Paste the **same Client ID and Client Secret** from Step D.
3. **Sign in with Google** → allow → **Save**.
   - (The redirect URL is the same one you already added in Step D, so no extra config.)

---

## 4. Prepare the Google Sheet (target spreadsheet)

1. Go to **https://sheets.google.com** → **Blank spreadsheet**.
2. In **row 1**, type these exact headers, one per column (A–F):
   ```
   Session ID | Article URL | Summary | Insights | Email | Timestamp
   ```
3. Give the file a name (e.g. `Article Agent Log`). The Sheets node will list it in its
   **Document** dropdown once the Google credential is connected.

---

## 5. Recap — what goes where

| In n8n node… | Credential type | From… |
|---|---|---|
| Gemini Summary / Gemini Insights | Header Auth (`x-goog-api-key`) | AI Studio API key (Section 1) |
| Append to Google Sheets | Google Sheets OAuth2 API | Google Cloud OAuth client (Sections 2–3) |
| Send Email | Gmail OAuth2 | Same Google Cloud OAuth client |

## Security reminders
- Treat the Gemini key and Client Secret like passwords — never commit them to git.
- The repo only tracks `.env.example` files; your real secrets stay in n8n's credential
  store and your local `.env`.
- If a key leaks, revoke it: AI Studio (regenerate key) or Google Cloud Console
  (delete the OAuth client).
