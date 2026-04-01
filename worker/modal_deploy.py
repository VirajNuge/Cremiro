"""
Modal.com production deployment — Manager-Worker parallel fan-out architecture.

Pipeline stages and timing (10-min YouTube video → 5 clips):
  0–15s:  Orchestrator downloads video + extracts audio
  15–35s: Transcription (faster-whisper large-v3) + clip selection
  35s:    Fan-out — all render nodes wake simultaneously via render_node.map()
  35–50s: Each render node: face detection + classification + NVENC render
  50–55s: Upload to Supabase Storage + webhook callbacks
  ~55s total for N clips (N adds zero extra time — fully parallel)

Architecture:
  - process (web endpoint):  Receives request from Next.js, spawns orchestrator
  - orchestrator:            High-CPU/RAM, no GPU. Downloads, transcribes,
                             selects clip segments, writes source video to
                             modal.Volume, fans out render payloads via map().
  - render_node:             GPU (L4). Reads source from Volume, runs face
                             detection + NVENC render, uploads to Supabase,
                             fires per-job-item webhook callback.

Usage:
    pip install modal
    modal token new
    modal deploy worker/modal_deploy.py
    modal run worker/modal_deploy.py   # local test via Modal sandbox
"""

import hashlib
import hmac
import json
import logging
import os
import re
import subprocess
import time
import uuid
from typing import Optional

import modal

logger = logging.getLogger("cremiro.worker.modal")

# ── Modal App & Shared Volume ──────────────────────────────────────────────
app = modal.App("cremiro-worker")

# Shared volume for source videos between orchestrator and render nodes.
# Orchestrator writes, render nodes read. Named volume persists across runs.
video_volume = modal.Volume.from_name("cremiro-video-cache", create_if_missing=True)
VOLUME_MOUNT = "/video-data"

# ── Docker Image ───────────────────────────────────────────────────────────
worker_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "ffmpeg",
        "libgl1-mesa-glx",
        "libglib2.0-0",
    )
    .pip_install(
        "faster-whisper==1.1.0",
        "mediapipe==0.10.21",
        "yt-dlp==2025.1.15",
        "httpx==0.28.1",
        "Pillow==11.1.0",
        "opencv-python-headless==4.10.0.84",
        "supabase==2.10.0",
    )
)

# Mount the core processing code into /root/core inside the container
core_mount = modal.Mount.from_local_dir(
    os.path.join(os.path.dirname(__file__), "core"),
    remote_path="/root/core",
)

# Shared secrets — injected as env vars into all functions
shared_secrets = [
    modal.Secret.from_name("cremiro-webhook-secret"),
    modal.Secret.from_name("supabase-creds"),
    modal.Secret.from_name("pexels-api-key"),
]


# ── HMAC helpers ───────────────────────────────────────────────────────────

def _sign_payload(secret: str, payload: dict) -> dict[str, str]:
    """
    Build HMAC-signed headers for a callback payload.

    Signature format: HMAC-SHA256( "{timestamp}.{nonce}.{json_body}" )
    Header names match what Next.js /api/webhooks/worker expects.
    """
    timestamp = str(int(time.time()))
    nonce = str(uuid.uuid4())
    body_str = json.dumps(payload)
    sig_payload = f"{timestamp}.{nonce}.{body_str}"
    signature = hmac.new(
        secret.encode(), sig_payload.encode(), hashlib.sha256
    ).hexdigest()
    return {
        "Content-Type": "application/json",
        "x-signature": signature,
        "x-timestamp": timestamp,
        "x-nonce": nonce,
    }


async def _send_callback(
    callback_url: str,
    secret: str,
    job_item_id: str,
    status: str,
    output_data: dict | None = None,
    output_refs: list[str] | None = None,
    error_message: str | None = None,
) -> None:
    """Send a signed status callback to the Next.js webhook endpoint."""
    import httpx

    payload: dict = {"job_item_id": job_item_id, "status": status}
    if output_data:
        payload["output_data"] = output_data
    if output_refs:
        payload["output_refs"] = output_refs
    if error_message:
        payload["error_message"] = error_message

    headers = _sign_payload(secret, payload)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(callback_url, json=payload, headers=headers)
        resp.raise_for_status()


# ── Phase 3.2 — Sentence start detection ──────────────────────────────────

def _get_sentence_starts(
    transcript_dicts: list[dict],
    start_time: float,
    end_time: float,
) -> list[float]:
    """
    Return timestamps (relative to clip start) where new sentences begin.

    A sentence boundary is defined as:
    - The very first word in the clip, OR
    - A word that immediately follows a word ending with .  !  ?  ;  :

    Returns a sorted list of float timestamps (seconds from 0).
    """
    result: list[float] = []
    prev_end_punct = True  # treat clip start as a sentence boundary

    for seg in transcript_dicts:
        for w in (seg.get("words") or []):
            w_start = float(w.get("start", 0))
            w_end = float(w.get("end", 0))

            # Skip words entirely outside the clip window
            if w_end < start_time or w_start > end_time:
                continue

            text = w.get("word", "").strip()
            if not text:
                continue

            if prev_end_punct:
                result.append(round(w_start - start_time, 3))

            prev_end_punct = bool(text and text[-1] in ".!?;:")

    return result


# ── Phase 3.3 — Audio RMS speaker analysis ────────────────────────────────

def _analyze_speaker_segments(
    video_path: str,
    start_time: float,
    end_time: float,
    window: float = 0.5,
    dominance_ratio: float = 2.0,
) -> list[tuple[float, float, int]]:
    """
    Analyse stereo audio to determine dominant speaker per time window.

    Assumes:
      Left channel  (channel 0) → face track 0
      Right channel (channel 1) → face track 1

    Strategy:
      1. Run ffmpeg with the ``astats`` filter on the clipped segment,
         outputting per-channel RMS_level every ``window`` seconds.
      2. Parse the output and compare L vs R RMS per window.
      3. If one channel is ``dominance_ratio``× louder, mark that speaker.
         Otherwise mark as balanced (speaker_id = -1).

    Returns:
      List of (t_start, t_end, speaker_id) tuples relative to clip start.
      Returns [] on any failure (caller falls back to split_screen).
    """
    duration = end_time - start_time
    try:
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", video_path,
            "-filter_complex",
            f"[0:a]astats=metadata=1:reset=1:length={window}[out]",
            "-map", "[out]",
            "-f", "null", "-",
        ]
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60
        )
        stderr = result.stderr
    except Exception as exc:
        logger.warning(f"_analyze_speaker_segments: ffmpeg failed: {exc}")
        return []

    # astats outputs lines like:
    #   [Parsed_astats_0 @ ...] Channel: 1
    #   [Parsed_astats_0 @ ...] RMS level dB: -18.23
    # We accumulate per-channel RMS per window frame.

    segments: list[tuple[float, float, int]] = []
    window_idx = 0

    # Group lines by window: each window block has Channel: 1 + Channel: 2
    rms_by_window: list[dict[int, float]] = []
    current: dict[int, float] = {}
    current_channel: Optional[int] = None

    for line in stderr.splitlines():
        ch_match = re.search(r"Channel:\s*(\d+)", line)
        if ch_match:
            current_channel = int(ch_match.group(1))
            continue

        rms_match = re.search(r"RMS level dB:\s*([-\d.]+|[-]?inf)", line)
        if rms_match and current_channel is not None:
            val_str = rms_match.group(1)
            try:
                rms_val = float(val_str) if val_str not in ("-inf", "inf") else -120.0
            except ValueError:
                rms_val = -120.0
            current[current_channel] = rms_val

            # When we have both channels, record the window
            if len(current) == 2:
                rms_by_window.append(dict(current))
                current = {}
                current_channel = None

    # Convert RMS dB windows to (t_start, t_end, speaker_id) segments
    for i, window_rms in enumerate(rms_by_window):
        t_start = round(i * window, 3)
        t_end = round(min((i + 1) * window, duration), 3)

        rms0 = window_rms.get(1, -120.0)  # ffmpeg channels are 1-indexed
        rms1 = window_rms.get(2, -120.0)

        # Convert dB to linear power ratio
        power0 = 10 ** (rms0 / 10)
        power1 = 10 ** (rms1 / 10)

        if power0 == 0 and power1 == 0:
            speaker_id = -1
        elif power1 == 0 or (power0 > 0 and power0 / max(power1, 1e-12) >= dominance_ratio):
            speaker_id = 0
        elif power0 == 0 or (power1 > 0 and power1 / max(power0, 1e-12) >= dominance_ratio):
            speaker_id = 1
        else:
            speaker_id = -1

        segments.append((t_start, t_end, speaker_id))

    logger.debug(
        f"_analyze_speaker_segments: {len(segments)} windows, "
        f"{sum(1 for s in segments if s[2] != -1)} dominant"
    )
    return segments


# ── Phase 3.4 — Visual keyword extraction & B-Roll fetch ──────────────────

def _extract_visual_keywords(
    transcript_dicts: list[dict],
    start_time: float,
    end_time: float,
    max_keywords: int = 3,
) -> list[dict]:
    """
    Extract visually evocative keywords from the transcript for a clip window.

    Strategy: collect all content words (≥5 chars, not stop words), rank by
    frequency, and space them evenly across the clip so B-Roll segments don't
    overlap.

    Returns:
      List of {keyword, start, end} dicts (start/end relative to clip start).
      At most ``max_keywords`` items.  Each segment is 2 seconds wide (or
      shorter if clip is short).
    """
    _STOP = {
        "about", "above", "after", "again", "also", "always", "another",
        "because", "before", "being", "between", "could", "doing", "during",
        "going", "great", "having", "here", "into", "just", "know", "like",
        "little", "look", "make", "many", "more", "most", "much", "never",
        "often", "other", "people", "really", "right", "should", "since",
        "some", "still", "such", "than", "that", "their", "there", "these",
        "they", "thing", "think", "those", "through", "time", "very",
        "want", "well", "what", "when", "where", "which", "while", "will",
        "with", "would", "your",
    }

    word_freq: dict[str, int] = {}
    for seg in transcript_dicts:
        for w in (seg.get("words") or []):
            w_start = float(w.get("start", 0))
            w_end = float(w.get("end", 0))
            if w_end < start_time or w_start > end_time:
                continue
            text = re.sub(r"[^a-zA-Z]", "", w.get("word", "")).lower()
            if len(text) >= 5 and text not in _STOP:
                word_freq[text] = word_freq.get(text, 0) + 1

    if not word_freq:
        return []

    ranked = sorted(word_freq, key=lambda k: -word_freq[k])
    keywords = ranked[:max_keywords]

    clip_duration = end_time - start_time
    segment_duration = min(2.0, clip_duration / max(len(keywords), 1))
    # Space segments evenly, starting at 20% into the clip
    gap = clip_duration / (len(keywords) + 1)

    result = []
    for i, kw in enumerate(keywords):
        seg_start = round(gap * (i + 1) - segment_duration / 2, 3)
        seg_start = max(0.0, min(seg_start, clip_duration - segment_duration))
        seg_end = round(seg_start + segment_duration, 3)
        result.append({"keyword": kw, "start": seg_start, "end": seg_end})

    return result


async def _fetch_broll_clip(
    keyword: str,
    duration: float,
    api_key: str,
    work_dir: str,
    segment_index: int,
) -> Optional[dict]:
    """
    Fetch the best-matching Pexels HD video clip for ``keyword``.

    Downloads the clip to ``work_dir`` and returns:
      {"url": str, "local_path": str, "duration": float}
    or None on failure.

    Rate limits (free tier): 200 req/hr, 20 000 req/month.
    """
    import httpx

    search_url = "https://api.pexels.com/v1/videos/search"
    params = {"query": keyword, "per_page": 10, "orientation": "portrait"}
    headers = {"Authorization": api_key}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(search_url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning(f"_fetch_broll_clip: Pexels search failed for '{keyword}': {exc}")
        return None

    videos = data.get("videos", [])
    if not videos:
        logger.debug(f"_fetch_broll_clip: no results for '{keyword}'")
        return None

    # Pick the HD file whose duration is closest to requested duration
    best_url: Optional[str] = None
    best_video_duration: float = 0.0
    best_diff = float("inf")

    for video in videos:
        video_duration = float(video.get("duration", 0))
        if video_duration < duration:
            continue  # too short
        diff = abs(video_duration - duration)
        if diff >= best_diff:
            continue
        # Prefer HD quality
        hd_files = [
            f for f in video.get("video_files", [])
            if f.get("quality") == "hd"
        ]
        if not hd_files:
            hd_files = video.get("video_files", [])
        if not hd_files:
            continue
        # Pick highest resolution among HD files
        hd_files.sort(key=lambda f: f.get("width", 0) * f.get("height", 0), reverse=True)
        best_url = hd_files[0].get("link")
        best_video_duration = video_duration
        best_diff = diff

    if not best_url:
        logger.debug(f"_fetch_broll_clip: no suitable HD file for '{keyword}'")
        return None

    # Download clip
    local_path = os.path.join(work_dir, f"broll_{segment_index}.mp4")
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("GET", best_url) as resp:
                resp.raise_for_status()
                with open(local_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(65536):
                        f.write(chunk)
    except Exception as exc:
        logger.warning(f"_fetch_broll_clip: download failed for '{keyword}': {exc}")
        return None

    logger.debug(f"_fetch_broll_clip: downloaded '{keyword}' → {local_path}")
    return {"url": best_url, "local_path": local_path, "duration": best_video_duration}


# ── Render Node (GPU) ──────────────────────────────────────────────────────

@app.function(
    image=worker_image,
    mounts=[core_mount],
    secrets=shared_secrets,
    gpu="L4",
    cpu=2,
    memory=8192,
    timeout=3600,
    retries=0,
    volumes={VOLUME_MOUNT: video_volume},
)
async def render_node(payload: dict) -> dict:
    """
    GPU render worker — one invocation per clip job item.

    Reads:
      payload["source_video_path"]  — path inside the shared volume
      payload["job_item_id"]        — UUID of this job item
      payload["platform"]           — tiktok / reels / shorts / linkedin / twitter
      payload["style"]              — minimalist / fast_talker / cinematic
      payload["clip_rank"]          — 0-based index of the selected segment
      payload["start_time"]         — float seconds
      payload["end_time"]           — float seconds
      payload["transcript"]         — list of TranscriptSegment dicts
      payload["video_info"]         — dict from yt-dlp (title, duration, etc.)
      payload["callback_url"]       — Next.js webhook URL
      payload["request_id"]         — parent request UUID (for logging)

    NVENC encoding replaces libx264 for ~5× faster render on L4.
    """
    import sys
    import tempfile

    sys.path.insert(0, "/root")

    from core.classify import classify_video
    from core.faces.detector import detect_faces
    from core.faces.tracker import detect_face_tracks
    from core.models import (
        PLATFORM_RESOLUTIONS,
        FaceTrack,
        TranscriptSegment,
        VideoClassification,
    )
    from core.render.filtergraph import build_filter_chain
    from core.scenes import detect_scene_boundaries
    from core.subtitles.ass_builder import generate_ass_subtitles

    job_item_id = payload["job_item_id"]
    source_video_path = payload["source_video_path"]
    platform = payload["platform"]
    style = payload["style"]
    clip_rank = payload["clip_rank"]
    start_time = float(payload["start_time"])
    end_time = float(payload["end_time"])
    raw_transcript = payload["transcript"]
    video_info = payload["video_info"]
    callback_url = payload["callback_url"]
    request_id = payload.get("request_id", "unknown")
    secret = os.environ.get("WORKER_WEBHOOK_SECRET", "")

    # Phase 3.2 / 3.3 / 3.4 — enrichment data from orchestrator
    punch_in_timestamps: list[float] = payload.get("punch_in_timestamps") or []
    speaker_segments: list[tuple[float, float, int]] = [
        tuple(s) for s in (payload.get("speaker_segments") or [])  # type: ignore[misc]
    ]
    broll_segments: list[dict] = payload.get("broll_segments") or []

    logger.info(
        f"[{request_id}] render_node: job={job_item_id} "
        f"platform={platform} style={style} clip_rank={clip_rank} "
        f"t={start_time:.1f}–{end_time:.1f}s"
    )

    # Reconstruct TranscriptSegment objects from serialised dicts
    transcript = [TranscriptSegment(**seg) for seg in raw_transcript]

    try:
        await _send_callback(callback_url, secret, job_item_id, "processing")

        target_w, target_h = PLATFORM_RESOLUTIONS.get(platform, (1080, 1920))
        resolution = (target_w, target_h)

        # ── Face tracking ──────────────────────────────────────────────
        try:
            face_tracks = detect_face_tracks(
                source_video_path, start_time=start_time, end_time=end_time
            )
        except Exception as exc:
            logger.warning(f"[{request_id}] Face tracking failed, falling back: {exc}")
            face_tracks = []

        if face_tracks:
            face_positions = face_tracks[0].positions
        else:
            face_positions = detect_faces(
                source_video_path, start_time=start_time, end_time=end_time
            )

        # ── Scene detection + classification ──────────────────────────
        try:
            scenes = detect_scene_boundaries(
                source_video_path, start_time=start_time, end_time=end_time
            )
        except Exception as exc:
            logger.warning(f"[{request_id}] Scene detection failed: {exc}")
            scenes = []

        classification = classify_video(
            face_tracks=face_tracks,
            scenes=scenes,
            clip_duration=end_time - start_time,
            transcript=transcript,
            video_info=video_info,
        )
        template = classification.template
        logger.info(
            f"[{request_id}] clip_rank={clip_rank} template={template} "
            f"({classification.reasoning})"
        )

        # ── Render ─────────────────────────────────────────────────────
        with tempfile.TemporaryDirectory(prefix="cremiro_render_") as work_dir:
            from core.render.filtergraph import build_filter_chain
            import json as _json
            import subprocess

            subtitle_path = os.path.join(
                work_dir, f"clip_{clip_rank}_{target_w}x{target_h}_{template}.ass"
            )
            _get_subtitle_y = lambda tmpl, h: {"split_screen": int(h * 0.96), "pip": int(h * 0.885)}.get(tmpl)
            subtitle_y_override = _get_subtitle_y(template, target_h)

            generate_ass_subtitles(
                transcript, subtitle_path,
                start_time, end_time,
                style_name=style,
                resolution=resolution,
                position_override=subtitle_y_override,
            )

            # Probe source dimensions
            probe_cmd = [
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "json",
                source_video_path,
            ]
            probe = subprocess.run(probe_cmd, capture_output=True, text=True)
            probe_data = _json.loads(probe.stdout)
            src_w = probe_data["streams"][0]["width"]
            src_h = probe_data["streams"][0]["height"]

            filter_result = build_filter_chain(
                template=template,
                face_positions=face_positions,
                face_tracks=face_tracks,
                start_time=start_time,
                end_time=end_time,
                src_w=src_w,
                src_h=src_h,
                target_w=target_w,
                target_h=target_h,
                subtitle_path=subtitle_path,
                punch_in_timestamps=punch_in_timestamps or None,
                speaker_segments=speaker_segments or None,
                broll_segments=broll_segments or None,
            )

            duration = end_time - start_time
            output_path = os.path.join(
                work_dir, f"clip_{clip_rank}_{target_w}x{target_h}_{template}.mp4"
            )

            uses_complex = ";" in filter_result.filter_chain
            broll_inputs = filter_result.broll_input_paths  # [] if no B-Roll

            # NVENC hardware-accelerated encoding (replaces libx264)
            nvenc_flags = [
                "-hwaccel", "cuda",
                "-hwaccel_device", "0",
                "-hwaccel_output_format", "cuda",
                "-c:v", "h264_nvenc",
                "-preset", "p5",
                "-cq", "23",
                "-b:v", "0",
                "-rc", "vbr",
            ]

            # Build extra -i flags for B-Roll clips (must come before filters)
            broll_i_args: list[str] = []
            for bp in broll_inputs:
                broll_i_args.extend(["-i", bp])

            if uses_complex or broll_inputs:
                cmd = [
                    "ffmpeg", "-y",
                    "-ss", str(start_time),
                    "-t", str(duration),
                    "-i", source_video_path,
                    *broll_i_args,
                    "-filter_complex", filter_result.filter_chain,
                    "-map", "[v]",
                    "-map", "0:a?",
                    *nvenc_flags,
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-movflags", "+faststart",
                    output_path,
                ]
            else:
                cmd = [
                    "ffmpeg", "-y",
                    "-ss", str(start_time),
                    "-t", str(duration),
                    "-i", source_video_path,
                    "-vf", filter_result.filter_chain,
                    *nvenc_flags,
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-movflags", "+faststart",
                    output_path,
                ]

            logger.info(
                f"[{request_id}] NVENC render: {start_time:.1f}–{end_time:.1f}s "
                f"({platform}, template={template})"
            )
            render_result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300
            )
            if render_result.returncode != 0:
                raise RuntimeError(
                    f"FFmpeg NVENC error: {render_result.stderr[-500:]}"
                )

            # ── Upload to Supabase Storage ─────────────────────────────
            output_refs = await _upload_clip(
                output_path, job_item_id, platform, style
            )

        # Flatten word-level timing for the clip's time window.
        # Frontend reads output_data.words to drive the canvas subtitle engine.
        clip_words = []
        for seg in raw_transcript:
            for w in (seg.get("words") or []):
                w_start = w.get("start", 0)
                w_end = w.get("end", 0)
                # Keep words that overlap with the clip range
                if w_end >= start_time and w_start <= end_time:
                    clip_words.append({
                        "text": w.get("word", "").strip(),
                        "start": round(w_start - start_time, 3),
                        "end": round(w_end - start_time, 3),
                    })

        output_data = {
            "clips": [{
                "duration": duration,
                "platform": platform,
                "width": target_w,
                "height": target_h,
                "style": style,
                "template": template,
            }],
            "words": clip_words,
        }

        await _send_callback(
            callback_url, secret, job_item_id,
            "completed",
            output_data=output_data,
            output_refs=output_refs,
        )
        return {"status": "completed", "job_item_id": job_item_id}

    except Exception as exc:
        logger.error(f"[{request_id}] render_node {job_item_id} failed: {exc}")
        try:
            await _send_callback(
                callback_url, secret, job_item_id,
                "failed", error_message=str(exc)
            )
        except Exception:
            pass
        return {"status": "failed", "job_item_id": job_item_id, "error": str(exc)}


async def _upload_clip(
    local_path: str,
    job_item_id: str,
    platform: str,
    style: str,
) -> list[str]:
    """
    Upload rendered clip to Supabase Storage.

    Returns list of public URLs, or [] if credentials are not configured.
    """
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not supabase_key:
        logger.warning("Supabase credentials missing — skipping upload")
        return []

    try:
        from supabase import create_client

        bucket = "clips"
        storage_path = f"{job_item_id}/{platform}_{style}.mp4"

        client = create_client(supabase_url, supabase_key)
        with open(local_path, "rb") as f:
            client.storage.from_(bucket).upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "video/mp4", "upsert": "true"},
            )

        public_url = client.storage.from_(bucket).get_public_url(storage_path)
        return [public_url]

    except Exception as exc:
        logger.error(f"Upload failed for {job_item_id}: {exc}")
        return []


# ── Orchestrator (high-CPU, no GPU) ───────────────────────────────────────

@app.function(
    image=worker_image,
    mounts=[core_mount],
    secrets=shared_secrets,
    cpu=4,
    memory=16384,
    timeout=600,
    retries=0,
    volumes={VOLUME_MOUNT: video_volume},
)
async def orchestrator(request: dict) -> dict:
    """
    Orchestrator: download once, transcribe once, then fan out render jobs.

    Stages:
      1. Download source video via yt-dlp → write to shared modal.Volume
      2. Transcribe with faster-whisper large-v3 on CPU
      3. Select clip segments from heatmap + transcript
      4. Build one render payload per job_item
      5. render_node.map(payloads) — all render nodes start simultaneously
      6. Collect results; aggregate failures

    Non-viral-clip job types (social_text, blog_post) still run inline here
    since they don't benefit from GPU fan-out.
    """
    import sys
    import tempfile

    sys.path.insert(0, "/root")

    from core.downloader import download_video
    from core.clip_selector import select_clip_segments
    from core.models import TranscriptSegment
    from core.transcriber import transcribe_video

    request_id = request.get("request_id", "unknown")
    job_items = request.get("job_items", [])
    youtube_url = request.get("youtube_url", "")
    callback_url = request.get("callback_url", "")
    secret = os.environ.get("WORKER_WEBHOOK_SECRET", "")

    logger.info(
        f"[{request_id}] orchestrator start: {len(job_items)} items "
        f"url={youtube_url}"
    )

    # ── Separate viral_clip items from other job types ─────────────────
    viral_items = [ji for ji in job_items if ji.get("job_type") == "viral_clip"]
    other_items = [ji for ji in job_items if ji.get("job_type") != "viral_clip"]

    results = []

    # ── Non-clip jobs: inline processing ──────────────────────────────
    for ji in other_items:
        results.append(
            await _process_non_clip_job(ji, youtube_url, callback_url, secret, request_id)
        )

    if not viral_items:
        return {"request_id": request_id, "results": results}

    # ── Stage 1: Download (once for all viral clips) ───────────────────
    logger.info(f"[{request_id}] Stage 1: downloading {youtube_url}")

    with tempfile.TemporaryDirectory(prefix="cremiro_orch_") as work_dir:
        video_path, video_info = download_video(youtube_url, work_dir)
        video_duration = video_info.get("duration", 0)
        heatmap = video_info.get("heatmap")

        # Copy source video to shared volume so render nodes can read it
        volume_video_path = os.path.join(VOLUME_MOUNT, f"{request_id}_source.mp4")
        import shutil
        shutil.copy2(video_path, volume_video_path)
        video_volume.commit()  # Flush writes so render nodes see the file
        logger.info(f"[{request_id}] Source video written to volume: {volume_video_path}")

        # ── Stage 2: Transcribe (once) ──────────────────────────────────
        logger.info(f"[{request_id}] Stage 2: transcribing")
        transcript = transcribe_video(
            video_path,
            model_size="large-v3",
            device="cpu",
            compute_type="int8",
        )

        # ── Stage 3: Clip selection ─────────────────────────────────────
        logger.info(f"[{request_id}] Stage 3: selecting clip segments")
        max_rank = max(
            ji.get("input_data", {}).get("clip_index", 0) for ji in viral_items
        )
        clip_segments = select_clip_segments(
            heatmap=heatmap,
            transcript=transcript,
            video_duration=video_duration,
            num_clips=max_rank + 1,
        )

        # Serialise transcript for passing to render nodes (dataclass → dict)
        transcript_dicts = [
            {
                "text": seg.text,
                "start": seg.start,
                "end": seg.end,
                "words": [
                    {"word": w.word, "start": w.start, "end": w.end}
                    for w in (seg.words or [])
                ],
            }
            for seg in transcript
        ]

        # ── Stage 4: Build render payloads ─────────────────────────────
        render_payloads = []
        for ji in viral_items:
            clip_rank = ji.get("input_data", {}).get("clip_index", 0)
            if clip_rank < len(clip_segments):
                segment = clip_segments[clip_rank]
            else:
                segment = clip_segments[clip_rank % len(clip_segments)]

            seg_start = segment.start_time
            seg_end = segment.end_time

            # ── Phase 3.2: punch-in timestamps ────────────────────────
            punch_in_timestamps = _get_sentence_starts(
                transcript_dicts, seg_start, seg_end
            )

            # ── Phase 3.3: speaker segments (stereo RMS analysis) ─────
            try:
                speaker_segments = _analyze_speaker_segments(
                    video_path, seg_start, seg_end
                )
            except Exception as exc:
                logger.warning(
                    f"[{request_id}] Speaker analysis failed for clip {clip_rank}: {exc}"
                )
                speaker_segments = []

            # ── Phase 3.4: B-Roll keyword extraction + Pexels fetch ───
            broll_segments: list[dict] = []
            pexels_key = os.environ.get("PEXELS_API_KEY", "")
            if pexels_key:
                keyword_segments = _extract_visual_keywords(
                    transcript_dicts, seg_start, seg_end
                )
                for idx, kw_seg in enumerate(keyword_segments):
                    fetched = await _fetch_broll_clip(
                        keyword=kw_seg["keyword"],
                        duration=kw_seg["end"] - kw_seg["start"],
                        api_key=pexels_key,
                        work_dir=work_dir,
                        segment_index=idx,
                    )
                    if fetched:
                        # Copy B-Roll clip to shared volume so render nodes
                        # can access it (render nodes run on different containers)
                        broll_volume_path = os.path.join(
                            VOLUME_MOUNT,
                            f"{request_id}_broll_{clip_rank}_{idx}.mp4",
                        )
                        import shutil as _shutil
                        _shutil.copy2(fetched["local_path"], broll_volume_path)
                        broll_segments.append({
                            "keyword": kw_seg["keyword"],
                            "start": kw_seg["start"],
                            "end": kw_seg["end"],
                            "url": fetched["url"],
                            "local_path": broll_volume_path,  # volume path, readable by render nodes
                        })
                if broll_segments:
                    video_volume.commit()  # flush B-Roll writes to volume
            else:
                logger.debug(f"[{request_id}] PEXELS_API_KEY not set — skipping B-Roll")

            render_payloads.append({
                "job_item_id": ji["id"],
                "source_video_path": volume_video_path,
                "platform": ji.get("platform", "tiktok"),
                "style": ji.get("style", "minimalist"),
                "clip_rank": clip_rank,
                "start_time": seg_start,
                "end_time": seg_end,
                "transcript": transcript_dicts,
                "video_info": video_info,
                "callback_url": callback_url,
                "request_id": request_id,
                # Phase 3.2 / 3.3 / 3.4 enrichment
                "punch_in_timestamps": punch_in_timestamps,
                "speaker_segments": [list(s) for s in speaker_segments],
                "broll_segments": broll_segments,
            })

        logger.info(
            f"[{request_id}] Stage 5: fanning out {len(render_payloads)} render nodes"
        )

        # ── Stage 5: Parallel fan-out ──────────────────────────────────
        render_results = list(
            render_node.map(render_payloads, return_exceptions=True)
        )

    # Clean up source video and B-Roll clips from volume after all renders complete
    try:
        os.remove(volume_video_path)
        # Remove any B-Roll clips written to the volume for this request
        for fname in os.listdir(VOLUME_MOUNT):
            if fname.startswith(f"{request_id}_broll_"):
                try:
                    os.remove(os.path.join(VOLUME_MOUNT, fname))
                except Exception:
                    pass
        video_volume.commit()
    except Exception:
        pass

    # Aggregate results
    for r in render_results:
        if isinstance(r, Exception):
            results.append({"status": "failed", "error": str(r)})
        else:
            results.append(r)

    failed = [r for r in render_results if isinstance(r, Exception) or r.get("status") == "failed"]
    logger.info(
        f"[{request_id}] orchestrator done: "
        f"{len(render_results) - len(failed)}/{len(render_results)} succeeded"
    )

    return {
        "request_id": request_id,
        "results": results,
        "failed_count": len(failed),
    }


async def _process_non_clip_job(
    job_item: dict,
    youtube_url: str,
    callback_url: str,
    secret: str,
    request_id: str,
) -> dict:
    """Handle social_text, blog_post, ai_image inline (no GPU needed)."""
    import sys
    sys.path.insert(0, "/root")

    from core.pipeline import process_blog_post, process_social_text

    job_item_id = job_item["id"]
    job_type = job_item.get("job_type", "")

    try:
        await _send_callback(callback_url, secret, job_item_id, "processing")

        if job_type == "social_text":
            result = process_social_text(
                youtube_url=youtube_url,
                whisper_device="cpu",
                whisper_compute_type="int8",
            )
            if "error" in result:
                await _send_callback(callback_url, secret, job_item_id, "failed", error_message=result["error"])
                return {"status": "failed", "job_item_id": job_item_id}
            await _send_callback(callback_url, secret, job_item_id, "completed", output_data=result)
            return {"status": "completed", "job_item_id": job_item_id}

        elif job_type == "blog_post":
            result = process_blog_post(
                youtube_url=youtube_url,
                whisper_device="cpu",
                whisper_compute_type="int8",
            )
            if "error" in result:
                await _send_callback(callback_url, secret, job_item_id, "failed", error_message=result["error"])
                return {"status": "failed", "job_item_id": job_item_id}
            await _send_callback(callback_url, secret, job_item_id, "completed", output_data=result)
            return {"status": "completed", "job_item_id": job_item_id}

        elif job_type == "ai_image":
            await _send_callback(callback_url, secret, job_item_id, "failed", error_message="AI Image generation not yet available.")
            return {"status": "failed", "job_item_id": job_item_id}

        else:
            msg = f"Unknown job type: {job_type}"
            await _send_callback(callback_url, secret, job_item_id, "failed", error_message=msg)
            return {"status": "failed", "job_item_id": job_item_id}

    except Exception as exc:
        logger.error(f"[{request_id}] Non-clip job {job_item_id} failed: {exc}")
        try:
            await _send_callback(callback_url, secret, job_item_id, "failed", error_message=str(exc))
        except Exception:
            pass
        return {"status": "failed", "job_item_id": job_item_id, "error": str(exc)}


# ── Export Clip Endpoint (burn subtitle words into rendered clip) ──────────

@app.function(
    image=worker_image,
    mounts=[core_mount],
    secrets=shared_secrets,
    gpu="L4",
    cpu=2,
    memory=8192,
    timeout=600,
    retries=0,
)
@modal.web_endpoint(method="POST")
async def export_clip(request: dict) -> dict:
    """
    POST /export-clip

    Receives an edited words JSON array from Next.js, generates a fresh .ass
    subtitle file, burns it into the rendered clip via FFmpeg NVENC, uploads
    the result to Supabase Storage, and returns a public download URL.

    Request body (HMAC-signed — same contract as /process):
        {
          "job_item_id":  str,          # used to derive storage path
          "words":        list[dict],   # [{text, start, end, emoji?, highlight?}]
          "video_url":    str,          # public URL of the clean (no-subtitle) clip
        }

    Response:
        { "download_url": str }   on success
        { "error": str }          on failure
    """
    import sys
    import tempfile
    import subprocess

    sys.path.insert(0, "/root")

    from core.models import (
        TranscriptSegment,
        WordSegment,
    )
    from core.subtitles.ass_builder import generate_ass_subtitles

    # ── Extract fields ─────────────────────────────────────────────
    job_item_id: str = request.get("job_item_id", "")
    words_raw: list[dict] = request.get("words", [])
    video_url: str = request.get("video_url", "")
    style_config: dict = request.get("style_config") or {}
    headline_overlay: dict = request.get("headline_overlay") or {}

    if not job_item_id or not words_raw or not video_url:
        return {"error": "Missing required fields: job_item_id, words, video_url"}

    # ── Reconstruct WordSegment list from edited words JSON ────────
    # Frontend words are already relative to clip start (start=0-based).
    # We build a single synthetic TranscriptSegment spanning the whole clip,
    # then call generate_ass_subtitles with start_time=0, end_time=clip_end.
    word_segments: list[WordSegment] = []
    for w in words_raw:
        text = str(w.get("text", "")).strip()
        start = float(w.get("start", 0.0))
        end = float(w.get("end", 0.0))
        if not text:
            continue
        # Append emoji to word text if present (keeps it visible in canvas and .ass)
        emoji = w.get("emoji")
        if emoji:
            text = f"{text} {emoji}"
        word_segments.append(WordSegment(word=text, start=start, end=end))

    if not word_segments:
        return {"error": "No valid words provided."}

    clip_end = max(w.end for w in word_segments)
    # Wrap in a single TranscriptSegment (ass_builder iterates segments → words)
    synthetic_transcript = [
        TranscriptSegment(
            text=" ".join(w.word for w in word_segments),
            start=0.0,
            end=clip_end,
            words=word_segments,
        )
    ]

    # Infer style from output_data stored in Supabase (default minimalist)
    style_name = "minimalist"
    resolution = (1080, 1920)
    try:
        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if supabase_url and supabase_key:
            from supabase import create_client as _create_sb
            _sb = _create_sb(supabase_url, supabase_key)
            row = (
                _sb.from_("job_items")
                .select("output_data, platform")
                .eq("id", job_item_id)
                .maybe_single()
                .execute()
            )
            if row.data:
                clips = (row.data.get("output_data") or {}).get("clips", [])
                if clips:
                    style_name = clips[0].get("style", style_name)
                    w_res = clips[0].get("width", resolution[0])
                    h_res = clips[0].get("height", resolution[1])
                    resolution = (int(w_res), int(h_res))
    except Exception as _e:
        logger.warning(f"[export_clip] Could not fetch style from DB, using default: {_e}")

    # ── Phase 4: style_config.y_position → subtitle pixel Y ───────────────
    subtitle_y_override: Optional[int] = None
    y_frac_raw = style_config.get("y_position")
    if y_frac_raw is not None:
        try:
            y_frac = float(y_frac_raw)
            if 0.0 <= y_frac <= 1.0:
                subtitle_y_override = int(round(y_frac * resolution[1]))
        except (TypeError, ValueError):
            pass

    with tempfile.TemporaryDirectory(prefix="cremiro_export_") as work_dir:
        import httpx

        # ── Download the clean clip ────────────────────────────────
        input_path = os.path.join(work_dir, "input.mp4")
        logger.info(f"[export_clip] Downloading clean clip: {video_url}")
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("GET", video_url) as resp:
                resp.raise_for_status()
                with open(input_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(65536):
                        f.write(chunk)

        # ── Generate .ass from edited words ────────────────────────
        ass_path = os.path.join(work_dir, "edited_subs.ass")
        generate_ass_subtitles(
            transcript=synthetic_transcript,
            output_path=ass_path,
            start_time=0.0,
            end_time=clip_end,
            style_name=style_name,
            resolution=resolution,
            position_override=subtitle_y_override,
        )

        # ── Phase 4: headline_overlay → append ASS Dialogue ───────────────
        from core.subtitles.ass_builder import _escape_ass, _seconds_to_ass_time
        hl_text = str(headline_overlay.get("text", "")).strip()
        if hl_text:
            hl_y_raw = headline_overlay.get("y_position")
            try:
                hl_y_frac = float(hl_y_raw) if hl_y_raw is not None else 0.08
                if not (0.0 <= hl_y_frac <= 1.0):
                    hl_y_frac = 0.08
            except (TypeError, ValueError):
                hl_y_frac = 0.08
            hl_y_px = int(round(hl_y_frac * resolution[1]))
            center_x = resolution[0] // 2
            hl_font_size = int(round(resolution[1] * 0.055))
            hl_escaped = _escape_ass(hl_text)
            hl_end_ts = _seconds_to_ass_time(clip_end)
            # \an5 = centre-centre alignment; \pos overrides margins
            hl_dialogue = (
                f"Dialogue: 2,0:00:00.00,{hl_end_ts},Default,,0,0,0,,"
                "{\\an5\\pos(" + f"{center_x},{hl_y_px}" + ")\\c&H00FFFFFF&"
                f"\\fs{hl_font_size}\\b1\\bord6}}" + hl_escaped
            )
            with open(ass_path, "a", encoding="utf-8") as _f:
                _f.write(hl_dialogue + "\n")
            logger.info(f"[export_clip] Headline overlay appended: '{hl_text[:40]}'")

        # ── FFmpeg NVENC burn-in ────────────────────────────────────
        output_path = os.path.join(work_dir, "export.mp4")
        # Escape path for FFmpeg subtitles filter (backslashes + colons)
        ass_escaped = ass_path.replace("\\", "/").replace(":", "\\:")

        cmd = [
            "ffmpeg", "-y",
            "-hwaccel", "cuda",
            "-hwaccel_device", "0",
            "-hwaccel_output_format", "cuda",
            "-i", input_path,
            "-vf", f"subtitles={ass_escaped}",
            "-c:v", "h264_nvenc",
            "-preset", "p5",
            "-cq", "23",
            "-b:v", "0",
            "-rc", "vbr",
            "-c:a", "copy",
            "-movflags", "+faststart",
            output_path,
        ]

        logger.info(f"[export_clip] Running NVENC burn-in for job_item_id={job_item_id}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise RuntimeError(
                f"FFmpeg NVENC burn-in error: {result.stderr[-500:]}"
            )

        # ── Upload exported clip to Supabase Storage ───────────────
        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not supabase_url or not supabase_key:
            raise RuntimeError("Supabase credentials not configured on worker.")

        from supabase import create_client
        bucket = "clips"
        storage_path = f"{job_item_id}/export_subtitled.mp4"

        sb_client = create_client(supabase_url, supabase_key)
        with open(output_path, "rb") as f:
            sb_client.storage.from_(bucket).upload(
                path=storage_path,
                file=f,
                file_options={"content-type": "video/mp4", "upsert": "true"},
            )

        download_url = sb_client.storage.from_(bucket).get_public_url(storage_path)
        logger.info(f"[export_clip] Upload complete: {download_url}")
        return {"download_url": download_url}


# ── Web Endpoint ────────────────────────────────────────────────────────────

@app.function(
    image=worker_image,
    secrets=shared_secrets,
    allow_concurrent_inputs=20,
)
@modal.web_endpoint(method="POST")
async def process(request: dict) -> dict:
    """
    POST /process — web endpoint that receives requests from Next.js.

    Immediately returns 202 Accepted and spawns the orchestrator asynchronously.
    The orchestrator drives all downstream callbacks.

    This URL is your WORKER_URL for production (provided by Modal after deploy).
    """
    request_id = request.get("request_id", "unknown")
    job_items = request.get("job_items", [])

    logger.info(
        f"[{request_id}] /process received: {len(job_items)} job items"
    )

    # Spawn orchestrator asynchronously — returns immediately to Next.js
    orchestrator.spawn(request)

    return {
        "status": "accepted",
        "request_id": request_id,
        "job_count": len(job_items),
    }
