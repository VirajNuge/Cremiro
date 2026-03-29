# Cremiro Worker — Local Dev Setup Guide

Complete step-by-step guide to run the Python worker locally on Windows.

---

## Prerequisites

- Windows 10/11 (64-bit)
- Node.js + npm (already working — you have Next.js running)
- Git (already working)

---

## Part 1 — Install Python 3.12

MediaPipe only supports Python 3.9–3.12. Python 3.14 (which you currently have) will not work.
You do **not** need to uninstall Python 3.14 — both versions coexist fine.

### Step 1.1 — Download Python 3.12

Go to: **https://www.python.org/downloads/release/python-31211/**

Scroll to the bottom of the page → click **"Windows installer (64-bit)"**

### Step 1.2 — Install Python 3.12

Run the installer.

> **Important:** On the first screen, do **not** check "Add python.exe to PATH" — leave it unchecked to avoid conflicting with Python 3.14.

Click through the rest of the installer with defaults → **Install Now**.

### Step 1.3 — Verify both versions coexist

Open PowerShell and run:

```powershell
py -3.12 --version
py -3.14 --version
```

Expected output:
```
Python 3.12.x
Python 3.14.2
```

If both print a version number, you're good.

---

## Part 2 — Set Up the Worker Virtual Environment

A virtual environment isolates the worker's Python packages from everything else.
All steps below run in the `worker/` folder.

### Step 2.1 — Open PowerShell in the worker folder

```powershell
cd "E:\Mirum Labs\Clip\worker"
```

### Step 2.2 — Create a virtual environment using Python 3.12

```powershell
py -3.12 -m venv .venv
```

This creates a `.venv` folder inside `worker/`.

### Step 2.3 — Activate the virtual environment

```powershell
.venv\Scripts\activate
```

Your prompt will change to show `(.venv)` at the start:
```
(.venv) PS E:\Mirum Labs\Clip\worker>
```

> You must activate the venv every time you open a new terminal to run the worker.

### Step 2.4 — Upgrade pip (inside the venv)

```powershell
python -m pip install --upgrade pip
```

> Use `python` (not `py -3.12`) after activating — the venv's `python` is already 3.12.

### Step 2.5 — Install all worker dependencies

```powershell
pip install -r requirements.txt
```

This installs FastAPI, uvicorn, yt-dlp, faster-whisper, mediapipe, Pillow, and httpx.

> First install takes 2–5 minutes depending on your internet speed.

Expected final output:
```
Successfully installed fastapi-0.115.6 uvicorn-... yt-dlp-... faster-whisper-... mediapipe-... Pillow-... httpx-...
```

---

## Part 3 — Configure the Worker

### Step 3.1 — Generate a webhook secret

The worker and Next.js share a secret to verify requests between them.
Run this in PowerShell to generate one:

```powershell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Copy the output. It will look like:
```
K7h2mXpQr9sLnBvT1cWjYeAuDf4oIgZ8N6VxOtPkRs0=
```

### Step 3.2 — Create `worker/.env`

Create a new file at `E:\Mirum Labs\Clip\worker\.env` with this content:

```env
WORKER_WEBHOOK_SECRET=paste-your-generated-secret-here
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
```

> `base` is the fastest Whisper model — good for local dev. Accuracy is lower than `large-v3` (used in production on Modal).

### Step 3.3 — Update `E:\Mirum Labs\Clip\.env.local`

Add/update these two lines (leave everything else untouched):

```env
WORKER_URL=http://localhost:8000
WORKER_WEBHOOK_SECRET=paste-the-same-secret-here
```

> Both files must have the **exact same** `WORKER_WEBHOOK_SECRET` value.

---

## Part 4 — Run the Worker

### Step 4.1 — Start the worker

In your terminal (with `.venv` activated and inside the `worker/` folder):

```powershell
python local_server.py
```

Expected output:
```
INFO  Cremiro Worker started
INFO  Whisper model: base, device: cpu
INFO  Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### Step 4.2 — Verify it's running

Open a **second** PowerShell window and run:

```powershell
curl http://localhost:8000/health
```

Expected response:
```json
{"status":"ok","service":"cremiro-worker"}
```

---

## Part 5 — Expose via Ngrok (for webhook callbacks)

The Next.js app runs on `localhost:3000`. When it sends a job to the worker, the worker needs to call back to Next.js with status updates. For this to work, the worker needs a public HTTPS URL.

> **Why ngrok?** The worker sends HTTP requests back to Next.js (`callback_url`). Without ngrok, `localhost:3000` is not reachable from a different process in the same way the HMAC callback needs.
> In practice — if Next.js and the worker are on the same machine, `http://localhost:3000` works fine. Ngrok is only strictly required when the worker runs on a different machine or in the cloud.

### Step 5.1 — Install ngrok

**Option A — winget (if available):**
```powershell
winget install ngrok.ngrok
```

**Option B — Manual:**
1. Go to **https://ngrok.com/download**
2. Download **"Windows (64-bit)"** ZIP
3. Extract `ngrok.exe` to `C:\Tools\` (or anywhere on your PATH)

### Step 5.2 — Create a free ngrok account

Go to **https://dashboard.ngrok.com/signup** → sign up for free.

After signing up, go to **https://dashboard.ngrok.com/get-started/your-authtoken** and copy your authtoken.

### Step 5.3 — Authenticate ngrok (one-time setup)

```powershell
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

### Step 5.4 — Start ngrok tunnel

Open a **new** terminal (keep the worker running separately):

```powershell
ngrok http 8000
```

You will see output like:
```
Forwarding  https://a1b2-c3d4-e5f6.ngrok-free.app -> http://localhost:8000
```

**Copy the `https://...ngrok-free.app` URL.**

### Step 5.5 — Update `WORKER_URL` in `.env.local`

```env
WORKER_URL=https://a1b2-c3d4-e5f6.ngrok-free.app
```

> The `NEXT_PUBLIC_SITE_URL` stays as `http://localhost:3000` — do not change it.

### Step 5.6 — Restart Next.js

After editing `.env.local`, Next.js must be restarted to pick up the new `WORKER_URL`:

```powershell
# Stop the running Next.js (Ctrl+C), then:
npm run dev
```

---

## Part 6 — Running Everything Together

You need **3 terminals** open simultaneously:

| Terminal | Folder | Command |
|----------|--------|---------|
| **1 — Worker** | `E:\Mirum Labs\Clip\worker` | `.venv\Scripts\activate` then `python local_server.py` |
| **2 — Ngrok** | anywhere | `ngrok http 8000` |
| **3 — Next.js** | `E:\Mirum Labs\Clip` | `npm run dev` |

Once all three are running, open `http://localhost:3000` → log in → go to Dashboard → submit a YouTube URL.

---

## Troubleshooting

### `mediapipe` install fails
Make sure you are using Python 3.12 inside the venv:
```powershell
python --version   # must say Python 3.12.x
```
If it says 3.14, your venv was created with the wrong Python. Delete `.venv` and redo Step 2.2.

### Worker starts but crashes with `ModuleNotFoundError`
The venv is not activated. Run:
```powershell
.venv\Scripts\activate
```

### `WORKER_WEBHOOK_SECRET not set` warning in worker logs
The `worker/.env` file is missing or in the wrong folder. It must be at `E:\Mirum Labs\Clip\worker\.env` (not the project root).

### Next.js returns 502 on generate
The worker is not running or `WORKER_URL` in `.env.local` is wrong. Check:
1. Worker is running (`curl http://localhost:8000/health` returns ok)
2. If using ngrok, `WORKER_URL` has the current ngrok URL (it changes every restart)
3. Next.js was restarted after editing `.env.local`

### Ngrok URL changes every restart
Free ngrok URLs are random per session. Every time you restart ngrok:
1. Copy the new URL
2. Update `WORKER_URL` in `.env.local`
3. Restart Next.js (`Ctrl+C` → `npm run dev`)

To get a permanent URL, upgrade to ngrok paid (or use `ngrok http 8000 --domain=your-static-domain.ngrok-free.app` which free accounts get one of).

---

## Notes

- **Whisper model sizes** (trade-off: speed vs accuracy):
  - `tiny` — fastest, lowest accuracy
  - `base` — good for dev (recommended locally)
  - `small` / `medium` / `large-v3` — production quality (used on Modal.com)
- **First job will be slow** — faster-whisper downloads the Whisper model weights (~150MB for `base`) on first use.
- **`.venv` is gitignored** — never commit it. Dependencies are tracked via `requirements.txt`.
