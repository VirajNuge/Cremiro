# Clip — Generate Pipeline & Output Studio: Full Architecture Analysis

> Last updated: April 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Request Lifecycle (API Layer)](#2-request-lifecycle-api-layer)
3. [Worker Pipeline — Stage-by-Stage](#3-worker-pipeline--stage-by-stage)
   - [Stage 1: Download](#stage-1-download)
   - [Stage 2: Transcribe](#stage-2-transcribe)
   - [Stage 3: Clip Selection](#stage-3-clip-selection)
   - [Stage 4: Face Detection & Tracking](#stage-4-face-detection--tracking)
   - [Stage 5: Scene Detection & Classification](#stage-5-scene-detection--classification)
   - [Stage 6: Render (FFmpeg Filter Graphs)](#stage-6-render-ffmpeg-filter-graphs)
   - [Stage 7: Subtitle Burn-in](#stage-7-subtitle-burn-in)
4. [Text Output Pipelines](#4-text-output-pipelines)
5. [Data Models](#5-data-models)
6. [Security & Credit System](#6-security--credit-system)
7. [Frontend — Generate Panel](#7-frontend--generate-panel)
8. [Frontend — Output Studio](#8-frontend--output-studio)
9. [Design Philosophy & Ideas Behind the Output](#9-design-philosophy--ideas-behind-the-output)
10. [Phase Roadmap & Known Limitations](#10-phase-roadmap--known-limitations)

---

## 1. System Overview

Clip is a YouTube-to-content pipeline. A user submits a YouTube URL and selects which content formats they want. The system:

1. Validates the request and atomically deducts credits.
2. Dispatches a signed job to a Python worker over HTTP.
3. The worker downloads the video, transcribes it, identifies the best moments, performs face detection and scene analysis, then renders platform-specific clips with dynamic cropping and karaoke subtitles.
4. Job status is streamed back to the frontend in real time via Supabase Realtime.
5. Completed outputs surface inside the Output Studio — a three-tab workspace for clips, social campaigns, and editorial blog publishing.

```
User → Next.js API Route (/api/generate)
          │
          ├─ Rate check (10 req/min) + Concurrency check (max 3 active)
          ├─ Validation (lib/validation.ts)
          ├─ Atomic Supabase RPC: deduct credits + create request + create job items
          ├─ HMAC-signed dispatch → Python Worker (local_server.py)
          │
          └─ Worker Process
               ├─ Stage 1: yt-dlp download (video + heatmap metadata)
               ├─ Stage 2: faster-whisper transcription (word timestamps)
               ├─ Stage 3: Heatmap scoring → clip selection → transcript boundary snap
               ├─ Stage 4: MediaPipe multi-face tracking (IoU identity assignment)
               ├─ Stage 5: PySceneDetect scene cuts → heuristic classifier
               ├─ Stage 6: FFmpeg filter graph (4 templates) + dynamic crop
               └─ Stage 7: ASS karaoke subtitle burn-in
```

---

## 2. Request Lifecycle (API Layer)

**File:** `app/api/generate/route.ts`

### 2.1 Rate Limiting

- In-memory `Map<string, { count; windowStart }>` keyed by client IP.
- Limit: **10 requests per 60-second window** per IP.
- Stale eviction at 10,000 entries to prevent unbounded memory growth.
- No Redis or persistent store — resets on server restart (acceptable for current scale).

### 2.2 Authentication & User Context

- Requires an active Supabase session (`getUser()`).
- Both session check and profile fetch run in parallel for efficiency.

### 2.3 Input Validation (`lib/validation.ts`)

The validation layer is pure TypeScript — server-only, no runtime exceptions:

| Check | Rule |
|---|---|
| YouTube URL | Regex accepts `youtube.com/watch?v=`, `/shorts/`, `/embed/`, `youtu.be/`. Extracts 11-char video ID. |
| Job types | Enum: `viral_clip`, `social_text`, `blog_post`, `ai_image` |
| Platforms | Enum: `tiktok`, `reels`, `shorts`, `linkedin`, `twitter` |
| Subtitle styles | Enum: `minimalist`, `fast_talker`, `cinematic` |
| Quantity | `viral_clip`: max 20; `social_text`: max 1; `blog_post`: max 5; `ai_image`: max 5 |
| Items per request | Max 10 items |

**Credit cost formula:**
- `viral_clip`: `1 × quantity × platforms.length` (one job item per platform per clip rank)
- `social_text`: `0`
- `blog_post`: `5 × quantity`
- `ai_image`: `5 × quantity`

### 2.4 Concurrency Guard

Before deducting credits, the API checks how many active requests the user has in the last 30 minutes. If ≥ 3, it rejects with HTTP 429. The 30-minute window prevents permanently-stuck rows from blocking the user forever.

### 2.5 Atomic Credit Deduction (Supabase RPC)

```sql
-- pseudo-code for create_request_and_deduct RPC
BEGIN
  SELECT credits FROM profiles WHERE id = user_id FOR UPDATE;
  IF credits < total_cost THEN RAISE 'insufficient_credits'; END IF;
  UPDATE profiles SET credits = credits - total_cost WHERE id = user_id;
  INSERT INTO requests (...) RETURNING id;
  INSERT INTO job_items (...) FOR EACH item;
  RETURN request_id;
END
```

The `FOR UPDATE` row lock prevents double-charge on concurrent requests. An idempotency key derived from `(userId, videoId, timestamp)` prevents double-charges on client retries.

### 2.6 Job Item Expansion

- For `viral_clip`: one `job_item` row per `(clip_rank, platform)` combination.
- For text types: one `job_item` row per quantity unit.

### 2.7 Worker Dispatch

The worker is dispatched via a signed HTTP POST:

```
HMAC-SHA256 signature = sha256(timestamp + "." + nonce + "." + body)
Header: X-Worker-Signature: sha256=<hex>
Timeout: 10 seconds on the fetch
```

If the dispatch fails (worker down, timeout), the API immediately marks all job items as `failed` and triggers a DB-level credit refund RPC — users are never charged for a failed dispatch.

---

## 3. Worker Pipeline — Stage-by-Stage

**File:** `worker/core/pipeline.py`

The pipeline has three entry points:
- `process_viral_clips_batch(url, clips_config, output_dir)` — preferred multi-clip path (download once, render N)
- `process_viral_clip(url, ...)` — single clip wrapper (calls batch internally)
- `process_social_text(url, ...)` — text-only, skips all video stages
- `process_blog_post(url, ...)` — text-only

**Render cache key:** `(clip_rank, target_w, target_h, template)` — if two platforms share the same resolution and template, the clip is rendered once and reused.

---

### Stage 1: Download

**File:** `worker/core/downloader.py`

```python
yt-dlp --format "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best"
        --print-json          # returns heatmap data + metadata as JSON
        --match-filter "duration<=3600"
        --concurrent-fragments 4
        --timeout 600s
```

**Key behaviors:**
- Output template: `source.%(ext)s` → normalized to `source.mp4` after download.
- Heatmap data comes from yt-dlp's `--print-json` output, which includes the YouTube "most replayed" heatmap as `[{start_time, value}, ...]`.
- Cookies support: prefers `YTDLP_COOKIES_FILE` env var, falls back to `YTDLP_COOKIES_BROWSER`, falls back to anonymous.
- Error sanitization: internal paths stripped before returning user-facing errors. Three distinct user errors: invalid URL, unavailable/private video, duration exceeded.
- 1-hour max video duration enforced at yt-dlp level.

---

### Stage 2: Transcribe

**File:** `worker/core/transcriber.py`

Uses **faster-whisper** (CTranslate2 backend):

| Parameter | Value | Reason |
|---|---|---|
| Model | `large-v3` | Best accuracy for word timestamps |
| `word_timestamps=True` | Required | Subtitle alignment + clip boundary snapping |
| `vad_filter=True` | Skips silence | Faster, cleaner transcript |
| `beam_size=1` | Greedy decode | ~2× faster than beam=5, acceptable quality |
| `min_silence_duration_ms=500` | VAD config | Natural sentence splits |
| `cpu_threads=8` | Parallelism | Better throughput on CPU-only workers |
| `device="auto"` | CUDA/CPU auto | Picks GPU if available |

Output: `list[TranscriptSegment]` with word-level timing. Each segment contains the full sentence text, start/end timestamps, and a `list[WordSegment]` with per-word start/end.

The transcript is the central data structure — consumed by stages 3 (boundary snapping), 5 (keyword classification), 7 (subtitle generation), and the text pipelines.

---

### Stage 3: Clip Selection

**File:** `worker/core/clip_selector.py`

**Algorithm:**

1. **Heatmap path** (when `--print-json` returns heatmap data):
   - Build `(time, value)` points from the heatmap.
   - Slide windows of `max_clip_duration` across the video at half-heatmap-marker step size (≥1s).
   - Score each window by mean heatmap intensity within the window.
   - Sort descending. Pick top N non-overlapping windows (greedy).
   - Snap each window to transcript sentence boundaries (±5s tolerance).

2. **Fallback path** (no heatmap):
   - Distribute clips evenly: `spacing = max(clip_duration, video_duration / num_clips)`.
   - Same transcript boundary snapping applied.

**Transcript boundary snapping:**
- For each raw window start, find the nearest `segment.start` within ±5s.
- For each raw window end, find the nearest `segment.end` within ±5s.
- Enforce `min_duration=15s`, `max_duration=60s`, clamp to video bounds.
- Safety: if snapped duration is too short, extend end or pull back start.

The clip selection ensures clips always start and end mid-sentence — crucial for subtitle alignment and natural viewing experience.

---

### Stage 4: Face Detection & Tracking

**Files:** `worker/core/faces/detector.py`, `worker/core/faces/tracker.py`

**Phase 1 detector** (single face):
- MediaPipe `FaceDetection(model_selection=1)` — full-range model for varied distances.
- Samples frames at `sample_interval=4s`, max 150 samples.
- Picks the **largest** detected face per frame (most prominent speaker).
- Returns `list[FacePosition]` with normalized `(center_x, center_y, width, height)`.
- Linear interpolation between sampled positions for smooth crop following.

**Phase 2 tracker** (multi-face, IoU identity assignment):
- Samples frames at `sample_interval=0.5s` (2 FPS effective), max 300 samples.
- Detects **all** faces per frame, sorts by area descending.
- **Greedy IoU matching**: for each detection, find the active track with highest IoU (threshold 0.3). Match → update track. No match → create new track.
- Lost buffer: a track is deactivated after 10 consecutive missed samples (~5s).
- Returns `list[FaceTrack]`, sorted by `avg_size` descending (track_id 1 = largest face = primary speaker).
- Planned upgrade to YOLO6n + ByteTrack noted in docstring.

**Why IoU tracking works here:** podcast/talking-head faces don't move drastically between 0.5s samples. IoU-based matching is sufficient without a full re-ID model.

---

### Stage 5: Scene Detection & Classification

**Files:** `worker/core/scenes.py`, `worker/core/classify.py`

**Scene detection** (PySceneDetect):
- `ContentDetector(threshold=27.0, min_scene_len=15)` — not too sensitive to minor lighting changes.
- Runs only on the selected clip segment (not full video) for performance.
- ~2–3× realtime on CPU for 1080p.
- Used to compute `cuts_per_minute` — the primary signal for classifier rules 3 and 4.

**Video classifier** (heuristic decision tree, no ML):

```
Face count + cut rate + spatial arrangement + keywords → niche → template

Rule 1: faces≥2 + cuts<5/min + faces_are_split       → podcast         → split_screen (conf 0.85)
Rule 2: faces≥2 + cuts<10/min                         → interview       → split_screen (conf 0.70)
Rule 3: faces=1 + cuts>8/min + tutorial_keywords      → tutorial        → pip          (conf 0.75)
Rule 4: faces=0 + (tutorial_keywords OR cuts>10/min)  → presentation    → full_frame   (conf 0.60)
Rule 5: faces=1 + cuts<8/min                          → talking_head    → single_face  (conf 0.80)
Fallback:                                             → other           → single_face  (conf 0.50)
```

**faces_are_split** condition: face 1 avg_x < 0.4 AND face 2 avg_x > 0.6, or vice versa. Differentiates a true podcast layout from two faces that happen to appear together in the same region.

**Keyword signals:** title + first 500 chars of description + first 500 chars of transcript, all lowercased. Tutorial keywords: `tutorial, how to, step by step, walkthrough, demo, screen, code, ...` (15 terms). Podcast keywords: `podcast, episode, interview, conversation, guest, ...` (11 terms).

Rule 3 deliberately requires **both** high cuts AND tutorial keywords — prevents a plain talking-head video from being misclassified as tutorial just because its title contains "walkthrough".

---

### Stage 6: Render (FFmpeg Filter Graphs)

**Files:** `worker/core/render/filtergraph.py`, `worker/core/render/renderer.py`

#### 4 Templates

**`single_face`** (default):
- Aspect ratio crop following the primary face.
- Static crop (average face position) if <2 face samples; dynamic expression crop if ≥2.
- `scale=target_w:target_h:flags=lanczos`

**`split_screen`** (podcast/interview):
- Splits video into two streams: `[0:v]split=2[s1][s2]`
- Each stream independently cropped to follow its respective face track.
- Both scaled to `target_w × (target_h/2)` → vstacked with `vstack=inputs=2`.
- Subtitle position override: `target_h × 0.96` (near bottom of full frame).
- Falls back to `single_face` if < 2 face tracks available.

**`pip`** (tutorial):
- Main content: center crop to 9:16, no face following.
- Face cam overlay: square crop around average face position, scaled to 280×280.
- Overlaid at bottom-right: `overlay=W-w-20:H-h-180` (180px margin for subtitle clearance).
- Subtitle position override: `target_h × 0.885`.
- Falls back to `single_face` if no face tracks.

**`full_frame`** (presentation/screen recording):
- No face following. Scales to fit target width, then pads vertically with black OR crops center height.
- Strategy depends on source vs target aspect ratio:
  - Source wider (16:9 → 9:16): scale to target_w, then pad black top/bottom.
  - Source taller: scale to target_h, center crop sides.

#### Dynamic Crop (Expression-Based)

For `single_face` and `split_screen` with 2+ face positions, a smooth-following crop is built as an FFmpeg `t`-expression:

1. Sample interpolated face positions at 0.1s intervals.
2. Apply 5-frame moving average smoothing to prevent jitter.
3. Convert to pixel coordinates, clamp to frame bounds.
4. Downsample: keep only keyframes where `|Δx| > 5px OR |Δy| > 5px`.
5. Cap at 50 keyframes for expression length.
6. Build nested `if(lt(t,T), lerp, rest)` expression chains for both X and Y axes.
7. Escape commas in expressions so FFmpeg doesn't treat them as filter separators.

#### Renderer

```python
# Probe dimensions → build filter chain → run FFmpeg
ffmpeg -ss {start} -i {source} -t {duration}
       -filter_complex "{chain}" -map "[v]"   # if complex (contains ";")
       -vf "{chain}"                           # if simple (no ";")
       -c:v libx264 -preset fast -crf 23
       -c:a aac -b:a 128k
       -movflags +faststart
       -y {output_path}
```

`+faststart` moves the MP4 metadata box to the start for streaming-friendly files. 5-minute subprocess timeout per clip.

---

### Stage 7: Subtitle Burn-in

**File:** `worker/core/subtitles/ass_builder.py`

Uses the **Advanced SubStation Alpha (ASS) format** with a two-layer karaoke approach (Oracle-recommended).

#### Phrase Chunking

Words are grouped into 2–4 word display phrases. A new phrase starts when:
- Max 4 words reached.
- Gap between consecutive words > 0.8 seconds (natural pause).
- Previous word ends with sentence-ending punctuation (`.!?;:`).

#### Two-Layer Karaoke

```
Layer 0 (base):     Full phrase in semi-transparent white (\c&H80FFFFFF&)
                    Shown for entire phrase duration.

Layer 1 (highlight): For each word's duration — render the FULL phrase,
                    but make all non-active words fully transparent (\alpha&HFF&),
                    and make the active word brand orange (#fd6333 in ASS hex).
```

This means the active word animates into orange while staying spatially anchored within the visible phrase — creating a teleprompter/karaoke effect that increases retention. The phrase stays visible throughout; only the highlighted word changes.

#### Style Presets

| Preset | Font | Color | Position | Bold |
|---|---|---|---|---|
| `minimalist` | Arial | White | Bottom | No |
| `fast_talker` | Impact | Yellow | Center | Yes |
| `cinematic` | Georgia | White | Bottom | No |

#### Position Overrides

`split_screen` and `pip` templates pass a `position_override` pixel value to the subtitle builder. This generates an `\an2\pos(cx, y)` tag instead of using the style's `MarginV`, ensuring subtitles clear the layout elements (PiP overlay, split divider).

---

## 4. Text Output Pipelines

**File:** `worker/core/pipeline.py`

### Social Text (`process_social_text`)

1. Download video (same `download_video`).
2. Transcribe (same `transcribe_video`).
3. Merge transcript segments into full text.
4. Chunk into thread posts: split on sentence boundaries, max 270 characters per chunk (Twitter-safe with margin).
5. Return `ProcessingResult` with `output_data = {"thread": [post1, post2, ...]}`

### Blog Post (`process_blog_post`)

1. Download + transcribe (same as above).
2. Organize transcript into chapters/sections by clustering on pause patterns and sentence structure.
3. Return structured `output_data` with sections, each having a heading and paragraph body.

Both text pipelines are intentionally lightweight — no LLM calls in Phase 1. The text is derived directly from the transcript.

---

## 5. Data Models

**File:** `worker/core/models.py`

### Platform Resolutions

| Platform | Width | Height | Ratio |
|---|---|---|---|
| TikTok | 1080 | 1920 | 9:16 |
| Reels | 1080 | 1920 | 9:16 |
| Shorts | 1080 | 1920 | 9:16 |
| LinkedIn | 1080 | 1350 | 4:5 |
| Twitter | 1920 | 1080 | 16:9 |

### Core Dataclasses

| Class | Fields |
|---|---|
| `WordSegment` | `word, start, end` |
| `TranscriptSegment` | `text, start, end, words: list[WordSegment]` |
| `FacePosition` | `timestamp, center_x, center_y, width, height` (all normalized 0-1) |
| `FaceTrack` | `track_id, positions: list[FacePosition], avg_size` |
| `SceneSegment` | `start, end, duration` |
| `ClipSegment` | `start_time, end_time, rank, score` |
| `VideoClassification` | `niche, template, confidence, face_count, scene_cut_rate, reasoning` |
| `Phrase` | `words, start, end, text` |
| `FilterResult` | `filter_chain: str, subtitle_y_override: Optional[int]` |
| `ClipResult` | `output_path, platform, template, rank, score` |
| `ProcessingResult` | `clips: list[ClipResult], output_data: dict` |

### Subtitle Style Constants

`BRAND_ORANGE_ASS = "&H00333FFD&"` — ASS format reverses BGR, so `#fd6333` becomes `&H00333FFD&`.

`STYLE_CONFIGS` dict maps preset names to `{font_name, font_size, primary_color, outline_color, outline_width, bold, position}`.

---

## 6. Security & Credit System

### Credit Guards (Multi-Layer)

1. **Client-side:** Credit cost preview before submission (UI only).
2. **API validation:** `validateGenerateRequest()` recomputes expected cost from submitted items — client cannot send a lower cost.
3. **Atomic RPC:** Supabase RPC checks `credits >= cost` under `FOR UPDATE` row lock before deducting.
4. **Idempotency key:** Prevents double-charge if the client retries a request.
5. **Auto-refund:** Worker dispatch failure → immediate job item status update → DB refund trigger.
6. **Concurrency cap:** Max 3 active requests per user prevents credit exhaustion via parallel abuse.

### Worker Authentication (HMAC)

```
secret = WORKER_WEBHOOK_SECRET (env var)
message = f"{timestamp}.{nonce}.{json_body}"
signature = HMAC-SHA256(secret, message)
header = "X-Worker-Signature: sha256=<hex>"
```

The worker verifies this signature before processing any job. Prevents unauthenticated job injection.

### Input Sanitization

- All string inputs pass through `sanitizeString()` (trim + collapse whitespace) before validation.
- YouTube URL regex is strict — 11-char video ID extracted and validated.
- User-facing error messages from the downloader never expose internal file paths.

### Reserved Username Protection

40+ reserved usernames blocked at registration (admin, api, auth, dashboard, blog, etc.) to prevent route impersonation and phishing.

---

## 7. Frontend — Generate Panel

**File:** `app/dashboard/GeneratePanel.tsx`

### UI State Machine

```
"input" → handleGenerate() → "loading" (5-stage progress) → "output"
                                         ↓
                                  [Supabase Realtime subscription]
                                  postgres_changes on job_items
                                  filtered by request_id
```

### Input Screen

- YouTube URL field with real-time format validation.
- Content type toggles: Viral Clip (1 cr), Social Text (free), Visual Post (5 cr), SEO Blog (5 cr).
- Platform multi-select (TikTok, Reels, Shorts, X, LinkedIn) — only shown for Viral Clip.
- Subtitle style picker (Minimalist, Fast Talker, Cinematic).
- Quantity steppers with per-type maxima.
- Live credit cost breakdown panel (shows per-type subtotals + total).
- Generate button disabled if user has insufficient credits or no content type selected.

### Loading Screen

5 animated stages at 1.8s each:

1. "Fetching video metadata"
2. "Extracting transcript"
3. "Identifying viral moments"
4. "Rendering clips"
5. "Writing captions & blog"

The stage advancement is client-side timer-based — cosmetic only. Actual progress comes from the Realtime subscription.

### Output Screen

- Real-time job item list, updated via Supabase `postgres_changes` subscription.
- Progress bar: `done / total × 100%` animated via Framer Motion.
- Per-job status indicators: pending (circle outline), processing (spinner), completed (green check), failed (red X).
- Completed `viral_clip` items: inline `<video>` player + download button.
- Completed `social_text` / `blog_post` items: `TextOutputPanel` with copy and download buttons.
- "New Generation" button appears when all jobs reach terminal status.

### Realtime Architecture

```typescript
supabase.channel('job-items-{requestId}')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'job_items',
    filter: `request_id=eq.${requestId}`,
  }, (payload) => {
    // Update job item state from payload.new
  })
  .subscribe()
```

---

## 8. Frontend — Output Studio

**File:** `app/dashboard/OutputStudio.tsx`

The Output Studio is a three-tab post-production workspace. Currently driven by `MOCK_*` data — not yet wired to real job outputs, but the architecture is designed for it.

### Tab 1: Clips & Variations

Each "cluster" represents one clip rank (e.g., Clip #1). Each cluster contains:
- **Master slot**: 16:9 landscape version (180×101px thumbnail).
- **Variation trio**: 9:16 vertical versions per platform (TikTok, Reels, Shorts), rendered as portrait thumbnails.
- **Virality score gauge**: SVG arc gauge displaying `score = Hook Strength × 0.7 + Trending Topic × 0.3`. Tooltip explains formula. Animated via Framer Motion `strokeDashoffset`.
- **Caption drawer**: Per-platform captions with character counter (Twitter/Shorts: 500; others: 2200). Expandable via animated drawer.
- **Subtitle style switcher**: Yellow Box / White Outline / Bold Minimal toggle per cluster.
- **Schedule badge**: Per-item time picker. AI-suggested posting times shown as defaults.
- **Bulk actions**: Schedule All, Zip All, Delete per cluster.
- **Failed item handling**: Shows "Credits Refunded" overlay with a Retry button.

### Tab 2: Social Campaigns

Platform icon rail (Twitter/X, Instagram, Pinterest, LinkedIn, Facebook) with ready-item badges.

Per-campaign, per-platform content rendered in a platform-native preview:
- **Twitter**: Threaded posts with 280-char counter, "Copy Thread" button.
- **Instagram**: Stacked slide deck preview + caption + hashtags + "Safe zones verified" badge.
- **LinkedIn**: Simulated LinkedIn post card with avatar, headline, content, and featured image area.
- **Facebook**: Post card with Like/Comment/Share actions.
- **Pinterest**: Editable Pin Title and Alt Text fields for SEO.

Schedule conflict detection: if two items on the same platform are scheduled at the same time slot, a "Conflict detected" badge appears in red.

### Tab 3: Editorial Suite (Blog)

A **Notion-like block editor** with:

**Left sidebar:**
- Template selector: SEO Optimized, Storytelling, Bullet Point Summary, Tech Deep Dive.
- Auto-generated Table of Contents from H1/H2/H3 blocks with smooth-scroll links.
- "Generate New · 5 credits" regeneration button.

**Center canvas (block editor):**
- Block types: `h1`, `h2`, `h3`, `paragraph`, `youtube`, `image`, `blockquote`, `pullquote`, `callout`.
- Drag-to-reorder via Framer Motion `Reorder.Group`.
- **Slash command menu** (`/`): pressing `/` in a block opens a floating menu anchored to cursor position. Selecting a command converts the block to that type.
- **Inline formatting toolbar**: appears on text selection (Bold `**`, Italic `*`, Link `[text](url)`).
- **Drop cap** support on paragraph blocks.
- **Anchor/jump links** on heading blocks (`#slug`).
- Version switcher (v1/v2) — each version maintains independent block state in `versionBlocks` map.
- Post Settings slide-out panel (spring animation): Canonical URL, OG Title/Description/Image, live preview on Twitter/X and LinkedIn card formats.

**Right sidebar:**
- **SEO Score** (0–100): computed from Flesch-Kincaid readability, keyword density, heading structure, sentence length.
- **GEO Citability Score** (A–F grade): factual density, citation format, entity presence — each out of 25 points, visualized as animated horizontal bars.
- **Content Metrics**: Reading Level (Flesch-Kincaid grade), Word Count, Info Density (lexical density).
- **Factual Grounding**: list of claims verified/unverified against the transcript.
- **Keyword Density**: bar chart per keyword with density %.
- **Meta Description**: character counter (160 max).
- **Top Keywords**: pill cloud.
- **Version History**: manual snapshot system, max 10 snapshots, with restore confirmation.

**Blog publishing footer:**
- Platform selector for publishing: WordPress, Medium, Ghost, Dev.to.
- Scheduled time display (AI-suggested if not set).
- "Set Time" / "Change Time" popover.

---

## 9. Design Philosophy & Ideas Behind the Output

### 9.1 Content-First, Not Tool-First

The Output Studio is designed around the final content artifacts — clips, captions, blog post — not around raw processing controls. Users see their clips immediately in a ready-to-publish context, not inside a generic video player.

### 9.2 Karaoke Subtitles as Retention Engine

The two-layer ASS approach isn't just cosmetic. The design decision:
> "This produces a 'karaoke' effect where the viewer sees a phrase with the current word highlighted, which increases retention by ~41%."

The phrase-level chunking (2–4 words) is sized for mobile viewing — large enough to read in a glance, small enough to follow the speaker.

### 9.3 Smart Crop as the Core Value Proposition

Dynamic face-following crop is the technical core that justifies the service. The expression-based crop in FFmpeg (with moving-average smoothing and keyframe downsampling) ensures:
- No jitter from noisy face detection samples.
- Smooth camera-like motion without requiring a video editing step.
- Works entirely in a single FFmpeg pass — no intermediate renders.

### 9.4 Heatmap as Ground Truth for Virality

Rather than predicting virality with an ML model, Clip uses YouTube's own "most replayed" heatmap — the aggregated behavior of millions of real viewers — as the engagement signal. This is a deliberate choice: the heatmap is a proven ground truth, not a proxy.

### 9.5 Platform-Native Content, Not One-Size-Fits-All

Every output is rendered or formatted specifically for its target platform:
- Clips: different resolutions per platform (9:16 for vertical, 16:9 for Twitter).
- Captions: different character limits per platform (Twitter: 280 chars, others: 2200).
- Social campaigns: different visual formats (Twitter thread, LinkedIn post card, Instagram carousel, Pinterest pin).
- Blog: separate templates for SEO-optimized, Storytelling, and Technical writing patterns.

### 9.6 GEO Citability: Forward-Looking Signal

The GEO (Generative Engine Optimization) score is a forward-looking addition to the standard SEO score. As AI-powered search engines increasingly cite sources, factual density and structured citations matter more. The system flags claims against the transcript for grounding.

### 9.7 The "Batch Once, Render Many" Optimization

The pipeline downloads and transcribes once per video, regardless of how many clips and platforms are requested. The render cache keyed by `(clip_rank, target_w, target_h, template)` further deduplicates work when multiple platforms share a resolution. This is the core efficiency argument for the credit model — the marginal cost per additional platform render is low.

### 9.8 Offline-First Block Editor

The block editor is entirely client-side state. Edits are not auto-saved to a server — the user controls when to snapshot. This avoids complex conflict resolution and keeps the editing experience fast and responsive.

---

## 10. Phase Roadmap & Known Limitations

### Current Phase (Phase 1 / Phase 2 transition)

| Feature | Status |
|---|---|
| Single-face crop | ✅ Implemented |
| Multi-face tracking (IoU) | ✅ Implemented (Phase 2) |
| split_screen template | ✅ Implemented (Phase 2) |
| pip template | ✅ Implemented (Phase 2) |
| full_frame template | ✅ Implemented (Phase 2) |
| Karaoke subtitles | ✅ Implemented |
| Heatmap clip selection | ✅ Implemented |
| Social text pipeline | ✅ Implemented |
| Blog post pipeline | ✅ Implemented (basic chunking) |
| Output Studio → mock data | ⚠️ Mock only, not wired to real jobs |
| YOLO6n + ByteTrack upgrade | ❌ Planned (Phase 3) |
| ai_image generation | ❌ Not yet implemented |
| LLM-enhanced text outputs | ❌ Not yet implemented |
| Publishing integrations | ❌ Not yet implemented (WordPress, Medium etc.) |
| Real-time schedule publishing | ❌ Not yet implemented |

### Known Limitations

1. **Output Studio uses mock data.** The three tabs do not yet render real job output data from the database. The architecture is in place (realtime subscription in GeneratePanel shows real data inline), but the Output Studio needs to be wired to the `job_items.output_refs` and `job_items.output_data` fields.

2. **Rate limiting is in-memory.** The per-IP rate limiter resets on server restart and is not shared across multiple Next.js instances. At scale, this should move to Redis.

3. **AI image generation (`ai_image`) is unimplemented.** The job type exists in the validation schema and credit system but has no worker handler.

4. **Blog post structuring is basic.** The current implementation chunks on pauses, not semantic meaning. LLM-enhanced structuring is planned.

5. **No face re-identification across shots.** The IoU tracker loses a face if it disappears for >5 seconds (10 samples × 0.5s). ByteTrack would handle re-entry.

6. **Worker timeout is hard at 5 minutes per clip.** For very long clips (60s) on slow CPU workers, this may be tight.

7. **Dynamic crop expression length.** The cap at 50 keyframes may produce visible steps in long clips with frequent face movement. Increasing to 100+ would improve smoothness at the cost of FFmpeg expression parse time.
