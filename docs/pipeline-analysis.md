# Clip — Pipeline & Generation Architecture Analysis

> Generated: March 2026  
> Codebase: Next.js 14 frontend + FastAPI Python worker + Supabase backend

---

## What Is This App?

Clip (internally "Cremiro") is a **YouTube → Content** pipeline. A user pastes a YouTube URL, picks content types and quantities, hits Generate, and the system produces one or more of:

| Job Type | What it does |
|---|---|
| `viral_clip` | Downloads video, transcribes, detects faces, smart-crops to platform aspect ratio, burns word-timed subtitles, exports MP4 |
| `social_text` | Downloads + transcribes, splits transcript into 270-char thread-sized chunks |
| `blog_post` | Downloads + transcribes, structures transcript into chapter-based sections |
| `ai_image` | Placeholder — not yet implemented |

---

## Full Pipeline — End-to-End

```
User (Browser)
│
│  1. Pastes YouTube URL, selects content types + platforms + style + quantities
│  2. Clicks "Generate Content"
│
▼
GeneratePanel.handleGenerate()          [app/dashboard/GeneratePanel.tsx]
│
│  POST /api/generate  { youtubeUrl, items[] }
│
▼
Next.js API Route                       [app/api/generate/route.ts]
│
│  ① IP rate limit check (10 req/min)
│  ② Auth: supabase.auth.getUser()
│  ③ Input validation: validateGenerateRequest() [lib/validation.ts]
│  ④ Concurrency check: count requests WHERE status IN (pending, processing) — max 3
│  ⑤ Build jobItemsPayload[] (expands quantity × platform combinations)
│  ⑥ Generate idempotency key
│  ⑦ admin.rpc("create_request_and_deduct")
│       → atomically creates `requests` row + N `job_items` rows
│       → deducts totalCredits from user's credits_balance
│       → returns { request_id, job_item_ids[], balance_after }
│  ⑧ Sign dispatch payload with HMAC-SHA256 (timestamp + nonce + body)
│  ⑨ POST to WORKER_URL/process  (10s timeout)
│       → on failure: loop all job_item_ids, call update_job_item_status("failed")
│          which triggers auto-refund in the DB RPC
│
▼
Worker — FastAPI                        [worker/local_server.py]
│                                       [worker/modal_deploy.py  (production)]
│
│  ① Verify HMAC + timestamp replay protection (5-min window)
│  ② Parse ProcessRequest
│  ③ For each job_item:
│       asyncio.create_task(process_job_item(...))   ← fire & forget
│  ④ Return 200 "accepted" immediately
│
▼
process_job_item() — per job            [worker/local_server.py]
│
│  ① send_callback(status="processing")  → POST /api/webhooks/worker
│  ② Call pipeline function based on job_type:
│       viral_clip  → process_viral_clip()
│       social_text → process_social_text()
│       blog_post   → process_blog_post()
│  ③ send_callback(status="completed", output_data, output_refs)
│     OR send_callback(status="failed",  error_message)
│  ④ shutil.rmtree(work_dir)   ← cleanup temp files
│
▼
Core Pipeline                           [worker/core/processor.py]
│
│  process_viral_clip():
│    Stage 1 → download_video()         yt-dlp subprocess.run, 600s timeout
│    Stage 2 → transcribe_video()       faster-whisper WhisperModel (NEW per call)
│    Stage 3 → detect_faces()           MediaPipe + OpenCV, sample every 2s
│    Stage 4 → generate_ass_subtitles() pure Python, word-by-word ASS events
│    Stage 5 → render_clip()            ffprobe + ffmpeg subprocess.run, 300s timeout
│
│  process_social_text():
│    Stage 1 → download_video()
│    Stage 2 → transcribe_video()
│    → format into 270-char thread chunks
│
│  process_blog_post():
│    Stage 1 → download_video()
│    Stage 2 → transcribe_video()
│    → structure by chapters or ~5 equal sections
│
▼
Worker send_callback()                  [worker/local_server.py]
│
│  Signs JSON body (compact, separators=(',',':')) with HMAC-SHA256
│  POST to NEXT_PUBLIC_SITE_URL/api/webhooks/worker
│
▼
Next.js Webhook                         [app/api/webhooks/worker/route.ts]
│
│  ① Verify HMAC + timestamp replay protection
│  ② Validate job_item_id (UUID) + status
│  ③ admin.rpc("update_job_item_status", { job_item_id, status, output_data, output_refs, error_message })
│       → enforces valid state transitions in DB
│       → auto-refunds credits on failure
│       → updates parent request status when all items terminal
│
▼
Supabase Postgres
│
│  job_items row updated → postgres_changes event fired
│
▼
Supabase Realtime → Browser             [lib/supabase/client.ts]
│
│  Channel: job_items_{requestId}
│  Filter:  request_id=eq.{requestId}
│  Event:   UPDATE on job_items table
│
▼
GeneratePanel useEffect handler
│
│  Updates genState.jobItems[]
│  Re-renders: progress bar, per-job status badges, error messages
```

---

## Data Model (inferred)

```
requests
  id             uuid PK
  user_id        uuid FK → auth.users
  status         pending | processing | completed | failed
  youtube_url    text
  total_credits  int
  input_data     jsonb
  idempotency_key text UNIQUE
  created_at     timestamptz

job_items
  id             uuid PK
  request_id     uuid FK → requests
  job_type       viral_clip | social_text | blog_post | ai_image
  status         pending | processing | completed | failed
  platform       text | null
  style          text | null
  credits_cost   int
  input_data     jsonb
  output_data    jsonb | null    ← clip metadata / transcript / blog sections
  output_refs    text[] | null   ← file paths (local dev) or storage URLs (prod)
  error_message  text | null
  created_at     timestamptz

users / profiles
  credits_balance  int   ← deducted by create_request_and_deduct RPC
```

---

## State Machine

```
job_item:  pending → processing → completed
                               ↘ failed
```
- Transitions enforced in `update_job_item_status` DB RPC
- Credits refunded automatically on transition to `failed`

---

## Credit Costs

| Job Type | Cost |
|---|---|
| `viral_clip` | 1 credit per clip × platform |
| `social_text` | 0 credits |
| `blog_post` | 5 credits |
| `ai_image` | 5 credits |

---

## Security Model

| Mechanism | Where |
|---|---|
| HMAC-SHA256 bidirectional (timestamp + nonce + body) | Next.js ↔ Worker |
| Timestamp replay window (5 min) | Both directions |
| Nonce included in signed payload | Both directions |
| `timingSafeEqual` for signature comparison | Webhook route |
| Supabase service role key — server only | `lib/supabase/admin.ts` |
| Per-IP rate limit (10 req/60s, in-memory Map) | `/api/generate` |
| Per-user concurrency cap (3 active requests) | `/api/generate` |
| Atomic credit deduction (FOR UPDATE row lock in RPC) | DB RPC |
| Input sanitization + YouTube URL regex | `lib/validation.ts` |

---

## Performance Bottlenecks (Ranked by Impact)

### 🔴 Critical

#### 1. Synchronous CPU-bound work blocking the async event loop

`process_job_item()` is an `async` function, but it calls `process_viral_clip()` — a fully **synchronous** function that blocks for 3–15 minutes. Because Python's asyncio event loop is single-threaded, all concurrent `asyncio.create_task()` calls queue up and execute serially behind whichever job grabbed the thread first.

```python
# worker/local_server.py:177 — blocks entire event loop
result = process_viral_clip(...)  # synchronous, no await
```

**Fix:** Wrap in `asyncio.to_thread()` (Python 3.9+) to run in a thread pool without blocking the loop. For true CPU parallelism (bypasses GIL for CPU-bound work), use `ProcessPoolExecutor`:

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

_executor = ProcessPoolExecutor(max_workers=4)

async def process_job_item(...):
    await send_callback(callback_url, job_item.id, "processing")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, process_viral_clip, youtube_url, platform, ...)
```

#### 2. Whisper model instantiated fresh on every job

```python
# worker/core/processor.py:231 — model loaded from disk on every call
model = WhisperModel(model_size, device=device, compute_type=compute_type)
```

Loading `large-v3` takes 5–30 seconds of wall time and hundreds of MB of RAM every single job. For 5 concurrent jobs this is catastrophic.

**Fix:** Singleton model at module level, initialized once per worker process:

```python
# In processor.py — top of module
_whisper_model: WhisperModel | None = None
_whisper_model_size: str = ""

def get_whisper_model(model_size: str, device: str, compute_type: str) -> WhisperModel:
    global _whisper_model, _whisper_model_size
    key = f"{model_size}:{device}:{compute_type}"
    if _whisper_model is None or _whisper_model_size != key:
        _whisper_model = WhisperModel(model_size, device=device, compute_type=compute_type)
        _whisper_model_size = key
    return _whisper_model

def transcribe_video(...) -> list[TranscriptSegment]:
    model = get_whisper_model(model_size, device, compute_type)
    # ... rest unchanged
```

### 🟠 High

#### 3. Blocking subprocess.run for yt-dlp and ffmpeg

Both `download_video()` (600s timeout) and `render_clip()` (300s timeout) use `subprocess.run()` which fully blocks the calling thread. Combined with issue #1, this means one job can monopolize the worker for nearly 15 minutes.

```python
# processor.py:170 — blocks for up to 10 minutes
result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

# processor.py:599 — blocks for up to 5 minutes  
result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
```

**Fix:** Replace with `asyncio.subprocess` so the event loop stays free while IO waits:

```python
async def download_video_async(youtube_url, output_dir, max_duration=3600):
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
    ...
```

#### 4. Multiple jobs per request re-download the same video

When a user requests 3 clips (tiktok + reels + shorts) from one video, the current pipeline downloads the video **3 separate times** — once per job item. Each `process_job_item` creates its own `work_dir` and calls `download_video()` independently.

```python
# local_server.py:170 — each job item gets its own work_dir
work_dir = tempfile.mkdtemp(prefix=f"cremiro_{job_item.id[:8]}_")
```

**Fix:** Group job items by `youtube_url` at the request level. Download once, transcribe once, then fan-out to per-clip rendering:

```python
async def process_request_grouped(payload: ProcessRequest):
    # Single shared work_dir per request
    work_dir = tempfile.mkdtemp(prefix=f"cremiro_{payload.request_id[:8]}_")
    
    # Download + transcribe once
    video_path, video_info = await download_video_async(payload.youtube_url, work_dir)
    transcript = await asyncio.to_thread(transcribe_video, video_path, ...)
    face_positions = await asyncio.to_thread(detect_faces, video_path)
    
    # Fan out renders in parallel
    render_tasks = [
        asyncio.to_thread(render_clip, video_path, ..., item)
        for item in payload.job_items
        if item.job_type == "viral_clip"
    ]
    results = await asyncio.gather(*render_tasks, return_exceptions=True)
```

This alone could cut processing time by **50–70%** for multi-clip requests.

#### 5. No artifact upload — output_refs are local filesystem paths

```python
# local_server.py:196 — sending raw filesystem paths to the client
output_refs = [clip.output_path for clip in result.clips]
# e.g. ["C:/Users/.../cremiro_abc123_/clip_0_tiktok.mp4"]
```

These paths are meaningless to the browser and get deleted by `shutil.rmtree()` at the end of the job. The UI receives `output_refs` but has nothing to show.

**Fix:** Upload to Supabase Storage before sending the completed callback:

```python
from supabase import create_client

async def upload_clip(clip_path: str, job_item_id: str) -> str:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    object_path = f"clips/{job_item_id}/{os.path.basename(clip_path)}"
    with open(clip_path, "rb") as f:
        supabase.storage.from_("outputs").upload(object_path, f)
    return supabase.storage.from_("outputs").get_public_url(object_path)
```

### 🟡 Medium

#### 6. Synchronous dispatch — worker must be up at request time

`/api/generate` synchronously POSTs to `WORKER_URL/process` and fails the entire request if the worker is unreachable (10s timeout). There's no retry logic.

```typescript
// route.ts:292
const workerResponse = await fetch(`${workerUrl}/process`, {
  signal: AbortSignal.timeout(10_000), // worker must respond in 10s or all jobs fail
});
```

**Fix (medium term):** Decouple dispatch. Write job rows to DB, return 200 immediately, and have a background scheduler (or the worker polling) pick up new jobs. This makes the generate endpoint resilient to transient worker downtime.

**Fix (quick):** Add retry-with-backoff for the dispatch fetch (3 attempts, exponential backoff) before marking jobs failed.

#### 7. In-memory rate limiter resets on server restart

```typescript
// route.ts:29 — lost on every cold start / serverless scale-out
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
```

In a serverless (Vercel) environment, each function instance has its own Map, so limits are per-instance not per-IP globally. Use Redis or Supabase for durable rate limiting.

#### 8. No granular progress within a job

The worker sends `processing` at start and `completed` at the end. Users see a spinner for 3–15 minutes with no indication of which stage is running.

The `status_callback` parameter already exists in `process_viral_clip()` but the local server passes `None`:

```python
# local_server.py:183 — status_callback never wired up
result = process_viral_clip(
    ...
    # status_callback=None   ← not passed
)
```

**Fix:** Wire the callback through `process_job_item` and send intermediate statuses:

```python
async def process_job_item(job_item, youtube_url, callback_url):
    async def stage_callback(stage: str):
        await send_callback(callback_url, job_item.id, "processing",
                           output_data={"stage": stage})

    result = await asyncio.to_thread(
        process_viral_clip,
        ...,
        status_callback=lambda s: asyncio.run_coroutine_threadsafe(
            stage_callback(s), asyncio.get_event_loop()
        )
    )
```

Then surface `stage` in the UI: *"Downloading… Transcribing… Rendering…"*

---

## UX Gaps

| Priority | Gap | Fix |
|---|---|---|
| 🔴 | **Completed outputs not shown** — `output_refs` arrive via realtime but are never rendered in `GeneratePanel` | Render download links / video previews when `job.status === 'completed'` |
| 🔴 | **Local file paths as output_refs** — useless to browser | Upload to Supabase Storage first (see bottleneck #5) |
| 🟠 | **No resume on reload** — `requestId` is only in component state, lost on navigation | Save `requestId` to `localStorage`, restore on mount, re-subscribe to realtime channel |
| 🟠 | **No stage feedback** — spinner for up to 15 min with no progress | Wire `status_callback` stages, display "Downloading… Transcribing… Rendering…" |
| 🟡 | **No cancel / retry** — failed jobs show error text but no action button | Add retry endpoint + "Retry failed" button |
| 🟡 | **Inputs stay editable during submission** — `submitting` only disables the button | Also disable URL input and content-type toggles during `submitting` |
| 🟡 | **Realtime subscription has no error/reconnect handling** | Add `.subscribe((status, err) => ...)` handler, show "Live updates unavailable" and fall back to polling |
| 🟢 | **No history** — no way to see past requests/outputs | Add a requests history page (query `requests` + `job_items` for the current user) |
| 🟢 | **No output preview** — video clips just get a download link | Inline `<video>` preview for clip outputs, copy button for text outputs |

---

## Quick Wins (Ordered by Effort vs. Impact)

### 1. Deduplicate download + transcription per request  
**Effort:** Medium | **Impact:** 50–70% faster for multi-clip requests  
Group all job items in a request by URL, download + transcribe once, fan-out renders.

### 2. Singleton Whisper model  
**Effort:** Low (5 lines) | **Impact:** Saves 5–30s per job after first warmup  
Move `WhisperModel(...)` to a module-level singleton. Reuse across all jobs in the same process.

### 3. Wrap CPU work in asyncio.to_thread  
**Effort:** Low (wrap each call) | **Impact:** True concurrency for multiple simultaneous jobs  
Prevents any one job from blocking the event loop.

### 4. Upload artifacts to Supabase Storage  
**Effort:** Medium | **Impact:** Unblocks the entire "show output" UX feature  
Without this, no outputs are ever visible to users.

### 5. Surface outputs in GeneratePanel  
**Effort:** Low–Medium | **Impact:** Core feature completion — users can actually get their content  
Once upload is done, render `output_refs` as download links / video previews.

### 6. Wire status_callback stages  
**Effort:** Low | **Impact:** Dramatically improves perceived performance  
Show "Downloading… Transcribing… Rendering…" stages instead of a dumb spinner.

### 7. Persist requestId to localStorage  
**Effort:** Low (10 lines) | **Impact:** No lost jobs on page refresh  
Save `requestId` on successful generate, restore on mount.

---

## Architecture Notes

- **No OpenAI/LLM integration yet** — `social_text` and `blog_post` currently just format the raw transcript. GPT-powered summarization is planned (noted in comments).
- **`ai_image` is a stub** — returns `failed` immediately.
- **Clip selection is naive** — `process_viral_clip` divides video into equal 60s segments and picks by `clip_index`. No engagement analysis, virality scoring, or highlight detection. Big opportunity.
- **Face detection samples every 2s** — for a 10-min video that's 300 frames. Adequate, but for talking-head content at 30fps you could sample every 5s and reduce CPU load further.
- **ffmpeg preset is `medium`** — `fast` would cut render time by ~40% with barely perceptible quality difference for social clips. `ultrafast` for previews/drafts.
- **Modal deploy (`modal_deploy.py`) handles production GPU concurrency** — each job runs as a separate Modal function with GPU access. The local server is for development only.
- **DB RPCs are the source of truth for credit/refund logic** — `create_request_and_deduct` and `update_job_item_status` are stored in Supabase (not in this repo). Audit those to fully understand credit mechanics.
