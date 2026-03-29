"""
Core video processing pipeline.

Shared between local FastAPI server and Modal.com production deployment.
Pipeline stages:
  1. Download: yt-dlp extracts video + audio + heatmap metadata
  2. Transcribe: faster-whisper generates word-level timestamps
  3. Select Clips: heatmap-based engagement ranking + transcript boundary snapping
  4. Detect Faces: MediaPipe samples frames for face positions (per clip)
  5. Smart Crop: FFmpeg crops to platform aspect ratio centered on face
  6. Burn Subtitles: FFmpeg overlays word-timed ASS subtitles
  7. Upload: Results stored to configured storage (local or Supabase Storage)

For multiple clips, download and transcription happen once. Each clip is
independently face-detected, cropped, and rendered.
"""

import json
import logging
import os
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# ── Platform aspect ratios ──────────────────────────────────────────
PLATFORM_RATIOS: dict[str, tuple[int, int]] = {
    "tiktok": (9, 16),
    "reels": (9, 16),
    "shorts": (9, 16),
    "linkedin": (4, 5),
    "twitter": (16, 9),
}

# Output resolution targets (width x height)
PLATFORM_RESOLUTIONS: dict[str, tuple[int, int]] = {
    "tiktok": (1080, 1920),
    "reels": (1080, 1920),
    "shorts": (1080, 1920),
    "linkedin": (1080, 1350),
    "twitter": (1920, 1080),
}

# ── Style presets (subtitle styling) ────────────────────────────────
STYLE_CONFIGS: dict[str, dict] = {
    "minimalist": {
        "font_name": "Arial",
        "font_size": 58,
        "primary_color": "&H00FFFFFF",  # white
        "outline_color": "&H00000000",  # black
        "outline_width": 3,
        "bold": False,
        "position": "bottom",  # subtitle position
    },
    "fast_talker": {
        "font_name": "Impact",
        "font_size": 68,
        "primary_color": "&H0000FFFF",  # yellow
        "outline_color": "&H00000000",  # black
        "outline_width": 4,
        "bold": True,
        "position": "center",
    },
    "cinematic": {
        "font_name": "Georgia",
        "font_size": 52,
        "primary_color": "&H00FFFFFF",  # white
        "outline_color": "&H00000000",  # black
        "outline_width": 2,
        "bold": False,
        "position": "bottom",
    },
}


# ── Data structures ─────────────────────────────────────────────────
@dataclass
class WordSegment:
    """A single word with its timing information."""
    word: str
    start: float
    end: float


@dataclass
class TranscriptSegment:
    """A segment of transcript with word-level timing."""
    text: str
    start: float
    end: float
    words: list[WordSegment] = field(default_factory=list)


@dataclass
class FacePosition:
    """Face position at a specific timestamp."""
    timestamp: float
    center_x: float  # normalized 0-1
    center_y: float  # normalized 0-1
    width: float  # normalized face width
    height: float  # normalized face height


@dataclass
class ClipResult:
    """Result of processing a single clip."""
    output_path: str
    duration: float
    platform: str
    width: int
    height: int
    subtitle_path: Optional[str] = None


@dataclass
class ProcessingResult:
    """Result of the full processing pipeline."""
    clips: list[ClipResult] = field(default_factory=list)
    transcript: Optional[list[TranscriptSegment]] = None
    error: Optional[str] = None


@dataclass
class ClipSegment:
    """A ranked clip segment selected from the video."""
    start_time: float
    end_time: float
    rank: int  # 1 = best (most replayed), 2 = second best, etc.
    score: float  # average heatmap engagement score (0-1)


# ── Clip Selection: Heatmap + Transcript ────────────────────────────
def select_clip_segments(
    heatmap: Optional[list[dict]],
    transcript: list[TranscriptSegment],
    video_duration: float,
    num_clips: int = 1,
    min_clip_duration: float = 15.0,
    max_clip_duration: float = 60.0,
) -> list[ClipSegment]:
    """
    Select the best clip segments using YouTube's "most replayed" heatmap,
    then snap boundaries to clean transcript sentence starts/ends.

    Algorithm:
      1. If heatmap available: score each possible window by average heatmap
         intensity, pick top N non-overlapping windows
      2. If no heatmap: fall back to evenly-spaced segments
      3. Snap start/end to the nearest transcript segment boundary so clips
         begin and end at natural sentence breaks

    Args:
        heatmap: yt-dlp heatmap data [{start_time, end_time, value}, ...]
        transcript: Word-level transcript segments
        video_duration: Total video length in seconds
        num_clips: How many clips to extract (ranked by engagement)
        min_clip_duration: Minimum clip length in seconds
        max_clip_duration: Maximum clip length in seconds

    Returns:
        List of ClipSegment sorted by rank (1 = most engaging)
    """
    if heatmap and len(heatmap) > 0:
        segments = _select_from_heatmap(
            heatmap, transcript, video_duration,
            num_clips, min_clip_duration, max_clip_duration,
        )
    else:
        logger.info("No heatmap data available — falling back to even distribution")
        segments = _select_evenly_spaced(
            transcript, video_duration,
            num_clips, min_clip_duration, max_clip_duration,
        )

    return segments


def _select_from_heatmap(
    heatmap: list[dict],
    transcript: list[TranscriptSegment],
    video_duration: float,
    num_clips: int,
    min_clip_duration: float,
    max_clip_duration: float,
) -> list[ClipSegment]:
    """
    Score sliding windows across the video using heatmap intensity,
    pick the top N non-overlapping windows, then snap to transcript boundaries.
    """
    # Build a list of (time, value) points from the heatmap
    heatmap_points: list[tuple[float, float]] = []
    for entry in heatmap:
        t = entry.get("start_time", 0.0)
        v = entry.get("value", 0.0)
        if t is not None and v is not None:
            heatmap_points.append((float(t), float(v)))

    if not heatmap_points:
        return _select_evenly_spaced(
            transcript, video_duration, num_clips,
            min_clip_duration, max_clip_duration,
        )

    heatmap_points.sort(key=lambda x: x[0])

    # Score windows of max_clip_duration sliding across the video
    # Step size = half a heatmap marker duration for decent resolution
    if len(heatmap_points) >= 2:
        step = (heatmap_points[1][0] - heatmap_points[0][0]) / 2
    else:
        step = 5.0
    step = max(step, 1.0)  # at least 1s steps

    window_scores: list[tuple[float, float, float]] = []  # (start, end, avg_score)

    t = 0.0
    while t + min_clip_duration <= video_duration:
        window_end = min(t + max_clip_duration, video_duration)

        # Average heatmap value within this window
        values_in_window = [
            v for (pt, v) in heatmap_points
            if t <= pt < window_end
        ]

        if values_in_window:
            avg_score = sum(values_in_window) / len(values_in_window)
        else:
            avg_score = 0.0

        window_scores.append((t, window_end, avg_score))
        t += step

    # Sort by score descending — highest engagement first
    window_scores.sort(key=lambda x: x[2], reverse=True)

    # Pick top N non-overlapping windows
    selected: list[tuple[float, float, float]] = []
    for (ws, we, score) in window_scores:
        if len(selected) >= num_clips:
            break
        # Check overlap with already-selected segments
        overlaps = False
        for (ss, se, _) in selected:
            if ws < se and we > ss:
                overlaps = True
                break
        if not overlaps:
            selected.append((ws, we, score))

    # Snap each window to transcript sentence boundaries and build ClipSegments
    segments: list[ClipSegment] = []
    for rank, (ws, we, score) in enumerate(selected, start=1):
        snapped_start, snapped_end = _snap_to_transcript_boundaries(
            ws, we, transcript, min_clip_duration, max_clip_duration, video_duration,
        )
        segments.append(ClipSegment(
            start_time=snapped_start,
            end_time=snapped_end,
            rank=rank,
            score=score,
        ))

    logger.info(
        f"Selected {len(segments)} clip(s) from heatmap: "
        + ", ".join(f"#{s.rank} {s.start_time:.1f}-{s.end_time:.1f}s (score={s.score:.2f})" for s in segments)
    )

    return segments


def _select_evenly_spaced(
    transcript: list[TranscriptSegment],
    video_duration: float,
    num_clips: int,
    min_clip_duration: float,
    max_clip_duration: float,
) -> list[ClipSegment]:
    """
    Fallback: distribute clips evenly across the video when no heatmap is available.
    Still snaps boundaries to transcript sentences.
    """
    clip_duration = min(max_clip_duration, video_duration)
    # Space clips evenly, avoid overlap
    if num_clips == 1:
        starts = [0.0]
    else:
        spacing = max(clip_duration, video_duration / num_clips)
        starts = [i * spacing for i in range(num_clips)]
        # Clamp so we don't go past the end
        starts = [s for s in starts if s + min_clip_duration <= video_duration]

    segments: list[ClipSegment] = []
    for rank, s in enumerate(starts[:num_clips], start=1):
        e = min(s + clip_duration, video_duration)
        snapped_start, snapped_end = _snap_to_transcript_boundaries(
            s, e, transcript, min_clip_duration, max_clip_duration, video_duration,
        )
        segments.append(ClipSegment(
            start_time=snapped_start,
            end_time=snapped_end,
            rank=rank,
            score=0.0,
        ))

    logger.info(
        f"Selected {len(segments)} clip(s) (evenly spaced): "
        + ", ".join(f"#{s.rank} {s.start_time:.1f}-{s.end_time:.1f}s" for s in segments)
    )

    return segments


def _snap_to_transcript_boundaries(
    raw_start: float,
    raw_end: float,
    transcript: list[TranscriptSegment],
    min_duration: float,
    max_duration: float,
    video_duration: float,
) -> tuple[float, float]:
    """
    Snap a raw time window to the nearest transcript segment boundaries
    so the clip starts at a sentence beginning and ends at a sentence end.

    Searches within a ±5s tolerance window for the closest segment edges.
    """
    snap_tolerance = 5.0  # seconds — how far to look for a sentence boundary

    if not transcript:
        return raw_start, min(raw_end, video_duration)

    # Find the best start: nearest segment.start within tolerance BEFORE raw_start
    best_start = raw_start
    best_start_dist = snap_tolerance + 1

    for seg in transcript:
        dist = abs(seg.start - raw_start)
        if dist < best_start_dist and dist <= snap_tolerance:
            best_start = seg.start
            best_start_dist = dist

    # Find the best end: nearest segment.end within tolerance AFTER raw_end
    best_end = raw_end
    best_end_dist = snap_tolerance + 1

    for seg in transcript:
        dist = abs(seg.end - raw_end)
        if dist < best_end_dist and dist <= snap_tolerance:
            best_end = seg.end
            best_end_dist = dist

    # Enforce duration constraints
    duration = best_end - best_start
    if duration < min_duration:
        best_end = best_start + min_duration
    if duration > max_duration:
        best_end = best_start + max_duration

    # Clamp to video bounds
    best_start = max(0.0, best_start)
    best_end = min(best_end, video_duration)

    # Final safety: if somehow too short, extend end
    if best_end - best_start < min_duration:
        best_end = min(best_start + min_duration, video_duration)
        if best_end - best_start < min_duration:
            best_start = max(0.0, best_end - min_duration)

    return best_start, best_end


# ── Stage 1: Download ───────────────────────────────────────────────
def download_video(
    youtube_url: str,
    output_dir: str,
    max_duration: int = 3600,  # 1 hour max
) -> tuple[str, dict]:
    """
    Download video using yt-dlp.

    Returns:
        Tuple of (video_path, video_info_dict)
    """
    logger.info(f"Downloading video: {youtube_url}")

    output_template = os.path.join(output_dir, "source.%(ext)s")

    # Build cookies args: prefer cookies.txt file (works everywhere including
    # production), fall back to reading directly from a local browser profile.
    cookies_file = os.getenv("YTDLP_COOKIES_FILE", "")
    cookies_browser = os.getenv("YTDLP_COOKIES_BROWSER", "")
    if cookies_file and os.path.isfile(cookies_file):
        cookies_args = ["--cookies", cookies_file]
        logger.info(f"Using cookies file: {cookies_file}")
    elif cookies_browser:
        cookies_args = ["--cookies-from-browser", cookies_browser]
        logger.info(f"Using cookies from browser: {cookies_browser}")
    else:
        cookies_args = []
        logger.warning("No cookies configured — YouTube may throttle or block downloads")

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--format", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "--output", output_template,
        "--print-json",
        "--match-filter", f"duration<={max_duration}",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "--concurrent-fragments", "4",
        *cookies_args,
        youtube_url,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600,  # 10 minute timeout (cookies bypass is slower initially)
    )

    if result.returncode != 0:
        error_msg = result.stderr.strip() or "Download failed"
        logger.error(f"yt-dlp failed (exit {result.returncode}):\n{error_msg}")
        # Sanitize error — don't leak internal paths
        if "is not a valid URL" in error_msg or "Unsupported URL" in error_msg:
            raise ValueError("Invalid or unsupported YouTube URL.")
        if "Video unavailable" in error_msg or "Private video" in error_msg:
            raise ValueError("Video is unavailable or private.")
        if "duration" in error_msg.lower():
            raise ValueError(f"Video exceeds maximum duration of {max_duration // 60} minutes.")
        raise RuntimeError(f"Video download failed. Please try again.")

    # Parse video info from JSON output — filter for JSON lines only (yt-dlp
    # may mix warnings/progress lines with the final JSON object)
    json_lines = [ln for ln in result.stdout.splitlines() if ln.strip().startswith("{")]
    if not json_lines:
        raise RuntimeError("yt-dlp produced no JSON output — cannot read video metadata.")
    video_info = json.loads(json_lines[-1])

    # Find the downloaded file
    video_path = os.path.join(output_dir, f"source.mp4")
    if not os.path.exists(video_path):
        # yt-dlp might use a different extension
        for ext in ["mp4", "mkv", "webm"]:
            candidate = os.path.join(output_dir, f"source.{ext}")
            if os.path.exists(candidate):
                video_path = candidate
                break

    if not os.path.exists(video_path):
        raise RuntimeError("Downloaded video file not found.")

    logger.info(f"Downloaded: {video_path} ({video_info.get('duration', '?')}s)")
    return video_path, video_info


# ── Stage 2: Transcribe ─────────────────────────────────────────────
def transcribe_video(
    video_path: str,
    model_size: str = "large-v3",
    device: str = "auto",
    compute_type: str = "auto",
) -> list[TranscriptSegment]:
    """
    Transcribe video using faster-whisper with word-level timestamps.

    Args:
        video_path: Path to the video/audio file
        model_size: Whisper model size (tiny, base, small, medium, large-v3)
        device: Device to use (cpu, cuda, auto)
        compute_type: Compute type (int8, float16, auto)

    Returns:
        List of transcript segments with word-level timing
    """
    from faster_whisper import WhisperModel

    logger.info(f"Transcribing with model: {model_size}")

    model = WhisperModel(
        model_size,
        device=device,
        compute_type=compute_type,
        cpu_threads=8,
    )

    segments_iter, info = model.transcribe(
        video_path,
        word_timestamps=True,
        vad_filter=True,
        beam_size=1,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    logger.info(f"Detected language: {info.language} (prob: {info.language_probability:.2f})")

    transcript: list[TranscriptSegment] = []

    for segment in segments_iter:
        words = []
        if segment.words:
            for w in segment.words:
                words.append(WordSegment(
                    word=w.word.strip(),
                    start=w.start,
                    end=w.end,
                ))

        transcript.append(TranscriptSegment(
            text=segment.text.strip(),
            start=segment.start,
            end=segment.end,
            words=words,
        ))

    logger.info(f"Transcribed {len(transcript)} segments, {sum(len(s.words) for s in transcript)} words")
    return transcript


# ── Stage 3: Face Detection ─────────────────────────────────────────
def detect_faces(
    video_path: str,
    start_time: float = 0.0,
    end_time: Optional[float] = None,
    sample_interval: float = 4.0,  # sample every N seconds
    max_samples: int = 150,
) -> list[FacePosition]:
    """
    Detect face positions by sampling frames at regular intervals.
    Uses MediaPipe Face Detection for lightweight, accurate tracking.

    Only samples frames within [start_time, end_time] so face detection
    runs on the clip segment only — not the entire source video.

    Args:
        video_path: Path to the video file
        start_time: Start of the segment to analyze (seconds)
        end_time: End of the segment to analyze (seconds, None = end of video)
        sample_interval: Seconds between frame samples
        max_samples: Maximum number of frames to sample

    Returns:
        List of face positions with timestamps
    """
    import cv2
    import mediapipe as mp

    logger.info(f"Detecting faces (sample every {sample_interval}s, range {start_time:.1f}s-{end_time or 'end'}s)")

    mp_face_detection = mp.solutions.face_detection
    face_detection = mp_face_detection.FaceDetection(
        model_selection=1,  # 1 = full range model (better for varied distances)
        min_detection_confidence=0.5,
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Failed to open video for face detection.")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_interval = int(fps * sample_interval)

    # Start from the clip's start_time, not frame 0
    start_frame = int(start_time * fps)
    end_frame = int(end_time * fps) if end_time else total_frames

    positions: list[FacePosition] = []
    frame_idx = start_frame
    samples_taken = 0

    while cap.isOpened() and samples_taken < max_samples:
        if frame_idx >= end_frame or frame_idx >= total_frames:
            break

        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()

        if not ret:
            break

        timestamp = frame_idx / fps

        # Convert BGR to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_detection.process(rgb_frame)

        if results.detections:
            # Use the most prominent (largest) face
            best_detection = max(
                results.detections,
                key=lambda d: d.location_data.relative_bounding_box.width
                * d.location_data.relative_bounding_box.height,
            )

            bbox = best_detection.location_data.relative_bounding_box
            center_x = bbox.xmin + bbox.width / 2
            center_y = bbox.ymin + bbox.height / 2

            positions.append(FacePosition(
                timestamp=timestamp,
                center_x=min(max(center_x, 0.0), 1.0),
                center_y=min(max(center_y, 0.0), 1.0),
                width=bbox.width,
                height=bbox.height,
            ))

        frame_idx += frame_interval
        samples_taken += 1

    cap.release()
    face_detection.close()

    logger.info(f"Detected faces in {len(positions)}/{samples_taken} sampled frames")
    return positions


def interpolate_face_position(
    positions: list[FacePosition],
    timestamp: float,
) -> tuple[float, float]:
    """
    Get interpolated face center position for a given timestamp.
    Falls back to frame center (0.5, 0.5) if no face data available.
    """
    if not positions:
        return 0.5, 0.5

    # Find surrounding positions
    before = None
    after = None

    for pos in positions:
        if pos.timestamp <= timestamp:
            before = pos
        if pos.timestamp >= timestamp and after is None:
            after = pos

    if before is None and after is None:
        return 0.5, 0.5
    if before is None:
        return after.center_x, after.center_y  # type: ignore
    if after is None:
        return before.center_x, before.center_y
    if before.timestamp == after.timestamp:
        return before.center_x, before.center_y

    # Linear interpolation
    t = (timestamp - before.timestamp) / (after.timestamp - before.timestamp)
    cx = before.center_x + t * (after.center_x - before.center_x)
    cy = before.center_y + t * (after.center_y - before.center_y)
    return cx, cy


# ── Stage 4: Generate ASS Subtitles ─────────────────────────────────
def generate_ass_subtitles(
    transcript: list[TranscriptSegment],
    output_path: str,
    start_time: float,
    end_time: float,
    style_name: str = "minimalist",
    resolution: tuple[int, int] = (1080, 1920),
) -> str:
    """
    Generate ASS subtitle file with word-by-word highlighting.

    Args:
        transcript: Full transcript with word timing
        output_path: Path to write the .ass file
        start_time: Clip start time in seconds
        end_time: Clip end time in seconds
        style_name: Style preset name
        resolution: Video resolution (width, height)

    Returns:
        Path to the generated .ass file
    """
    style = STYLE_CONFIGS.get(style_name, STYLE_CONFIGS["minimalist"])
    width, height = resolution

    # ASS alignment: 2 = bottom center, 5 = center
    alignment = 5 if style["position"] == "center" else 2
    margin_v = 80 if style["position"] == "bottom" else 0

    header = f"""[Script Info]
Title: Cremiro Subtitles
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{style["font_name"]},{style["font_size"]},{style["primary_color"]},&H000000FF,{style["outline_color"]},&H80000000,{-1 if style["bold"] else 0},0,0,0,100,100,0,0,1,{style["outline_width"]},0,{alignment},20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []

    # Filter transcript segments that overlap with clip range
    for segment in transcript:
        if segment.end <= start_time or segment.start >= end_time:
            continue

        # Adjust timing relative to clip start
        if segment.words:
            for word in segment.words:
                if word.end <= start_time or word.start >= end_time:
                    continue

                w_start = max(word.start - start_time, 0)
                w_end = min(word.end - start_time, end_time - start_time)

                start_ts = _seconds_to_ass_time(w_start)
                end_ts = _seconds_to_ass_time(w_end)

                # Escape ASS special characters
                text = word.word.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")

                events.append(
                    f"Dialogue: 0,{start_ts},{end_ts},Default,,0,0,0,,{text}"
                )
        else:
            # Fallback: show full segment text
            seg_start = max(segment.start - start_time, 0)
            seg_end = min(segment.end - start_time, end_time - start_time)

            start_ts = _seconds_to_ass_time(seg_start)
            end_ts = _seconds_to_ass_time(seg_end)

            text = segment.text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")
            events.append(
                f"Dialogue: 0,{start_ts},{end_ts},Default,,0,0,0,,{text}"
            )

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("\n".join(events))
        f.write("\n")

    logger.info(f"Generated ASS subtitles: {output_path} ({len(events)} events)")
    return output_path


def _seconds_to_ass_time(seconds: float) -> str:
    """Convert seconds to ASS time format (H:MM:SS.CC)."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


# ── Stage 5: Smart Crop + Subtitle Burn-in ──────────────────────────
def render_clip(
    video_path: str,
    output_path: str,
    start_time: float,
    end_time: float,
    platform: str,
    face_positions: list[FacePosition],
    subtitle_path: Optional[str] = None,
) -> ClipResult:
    """
    Render a clip with smart cropping and optional subtitle burn-in.

    Uses FFmpeg to:
    1. Trim to start/end time
    2. Crop to platform aspect ratio centered on face
    3. Scale to target resolution
    4. Burn in subtitles (if provided)
    5. Re-encode with quality settings

    Args:
        video_path: Source video path
        output_path: Output clip path
        start_time: Start time in seconds
        end_time: End time in seconds
        platform: Target platform (determines aspect ratio)
        face_positions: Face positions for smart cropping
        subtitle_path: Optional .ass subtitle file path

    Returns:
        ClipResult with output info
    """
    target_w, target_h = PLATFORM_RESOLUTIONS.get(platform, (1080, 1920))
    target_ratio = target_w / target_h

    # Get source video dimensions
    probe_cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        video_path,
    ]
    probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
    probe_data = json.loads(probe_result.stdout)
    src_w = probe_data["streams"][0]["width"]
    src_h = probe_data["streams"][0]["height"]
    src_ratio = src_w / src_h

    # Calculate crop dimensions
    if src_ratio > target_ratio:
        # Source is wider — crop width
        crop_h = src_h
        crop_w = int(src_h * target_ratio)
    else:
        # Source is taller — crop height
        crop_w = src_w
        crop_h = int(src_w / target_ratio)

    # Get average face position across the entire clip duration
    # (more stable centering than a single midpoint sample)
    clip_faces = [p for p in face_positions if start_time <= p.timestamp <= end_time]
    if clip_faces:
        face_cx = sum(p.center_x for p in clip_faces) / len(clip_faces)
        face_cy = sum(p.center_y for p in clip_faces) / len(clip_faces)
    else:
        face_cx, face_cy = 0.5, 0.5  # fallback to frame center

    # Calculate crop position centered on face
    crop_x = int(face_cx * src_w - crop_w / 2)
    crop_y = int(face_cy * src_h - crop_h / 2)

    # Clamp to valid range
    crop_x = max(0, min(crop_x, src_w - crop_w))
    crop_y = max(0, min(crop_y, src_h - crop_h))

    # Build FFmpeg filter chain
    filters = [
        f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}",
        f"scale={target_w}:{target_h}:flags=lanczos",
    ]

    if subtitle_path and os.path.exists(subtitle_path):
        # Escape path for FFmpeg (Windows paths need extra escaping)
        escaped_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
        filters.append(f"ass='{escaped_path}'")

    filter_chain = ",".join(filters)

    duration = end_time - start_time

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_time),
        "-t", str(duration),
        "-i", video_path,
        "-vf", filter_chain,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-threads", "0",
        output_path,
    ]

    logger.info(f"Rendering clip: {start_time:.1f}s - {end_time:.1f}s ({platform})")

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=300,  # 5 minute timeout per clip
    )

    if result.returncode != 0:
        logger.error(f"FFmpeg error: {result.stderr[-500:]}")
        raise RuntimeError(f"Failed to render clip for {platform}.")

    return ClipResult(
        output_path=output_path,
        duration=duration,
        platform=platform,
        width=target_w,
        height=target_h,
        subtitle_path=subtitle_path,
    )


# ── Full Pipeline ────────────────────────────────────────────────────
def process_viral_clip(
    youtube_url: str,
    platform: str,
    style: str = "minimalist",
    clip_index: int = 0,
    work_dir: Optional[str] = None,
    whisper_model: str = "large-v3",
    whisper_device: str = "auto",
    whisper_compute_type: str = "auto",
    status_callback: Optional[Callable[[str], Any]] = None,
) -> ProcessingResult:
    """
    Full pipeline to process a YouTube video into a viral clip.

    This is the single-clip entry point. For multiple clips from the same
    video, use process_viral_clips_batch() instead to avoid re-downloading.

    Uses YouTube's "most replayed" heatmap to select the most engaging
    segment, snaps boundaries to transcript sentences, then renders.

    Args:
        youtube_url: YouTube video URL
        platform: Target platform (tiktok, reels, shorts, linkedin, twitter)
        style: Style preset (minimalist, fast_talker, cinematic)
        clip_index: Which clip to extract (0 = most replayed, 1 = 2nd, etc.)
        work_dir: Working directory (uses temp dir if None)
        whisper_model: Whisper model size
        whisper_device: Device for whisper (cpu, cuda, auto)
        whisper_compute_type: Compute type for whisper
        status_callback: Optional callback for progress updates

    Returns:
        ProcessingResult with clip paths and transcript
    """
    result = process_viral_clips_batch(
        youtube_url=youtube_url,
        clip_configs=[{
            "platform": platform,
            "style": style,
            "clip_rank": clip_index,
        }],
        num_clips=clip_index + 1,
        work_dir=work_dir,
        whisper_model=whisper_model,
        whisper_device=whisper_device,
        whisper_compute_type=whisper_compute_type,
        status_callback=status_callback,
    )
    return result


def process_viral_clips_batch(
    youtube_url: str,
    clip_configs: list[dict],
    num_clips: int = 1,
    work_dir: Optional[str] = None,
    whisper_model: str = "large-v3",
    whisper_device: str = "auto",
    whisper_compute_type: str = "auto",
    status_callback: Optional[Callable[[str], Any]] = None,
) -> ProcessingResult:
    """
    Batch pipeline: download once, transcribe once, select N clips, render each.

    This is the preferred entry point when the user requests multiple clips
    from the same video. Avoids redundant downloads and transcriptions.

    clip_configs is a list of dicts, each with:
      - platform: str (tiktok, reels, etc.)
      - style: str (minimalist, fast_talker, cinematic)
      - clip_rank: int (0 = most replayed, 1 = 2nd, etc.)

    Args:
        youtube_url: YouTube video URL
        clip_configs: List of clip configuration dicts
        num_clips: Number of unique clip segments to select from heatmap
        work_dir: Working directory (uses temp dir if None)
        whisper_model: Whisper model size
        whisper_device: Device for whisper (cpu, cuda, auto)
        whisper_compute_type: Compute type for whisper
        status_callback: Optional callback for progress updates

    Returns:
        ProcessingResult with all rendered clips and shared transcript
    """
    cleanup_dir = work_dir is None
    if work_dir is None:
        work_dir = tempfile.mkdtemp(prefix="cremiro_")

    try:
        # Stage 1: Download (once)
        if status_callback:
            status_callback("downloading")

        video_path, video_info = download_video(youtube_url, work_dir)
        video_duration = video_info.get("duration", 0)
        heatmap = video_info.get("heatmap")

        if heatmap:
            logger.info(f"Heatmap data available: {len(heatmap)} markers")
        else:
            logger.info("No heatmap data — will use evenly-spaced fallback")

        # Stage 2: Transcribe (once)
        if status_callback:
            status_callback("transcribing")

        transcript = transcribe_video(
            video_path,
            model_size=whisper_model,
            device=whisper_device,
            compute_type=whisper_compute_type,
        )

        # Stage 3: Select clip segments using heatmap + transcript
        if status_callback:
            status_callback("analyzing")

        clip_segments = select_clip_segments(
            heatmap=heatmap,
            transcript=transcript,
            video_duration=video_duration,
            num_clips=num_clips,
        )

        # Stage 4: Render each clip config against the selected segments
        # Deduplicate: platforms with the same resolution + same clip rank
        # share the exact same rendered video (e.g. tiktok/reels/shorts are
        # all 1080x1920). Render once per unique (rank, resolution), then
        # copy for duplicate platforms.
        if status_callback:
            status_callback("rendering")

        all_clips: list[ClipResult] = []

        # Cache: (clip_rank, target_w, target_h) -> rendered ClipResult
        render_cache: dict[tuple[int, int, int], ClipResult] = {}
        # Cache: clip_rank -> face_positions (no need to re-detect per platform)
        face_cache: dict[int, list] = {}

        for config in clip_configs:
            platform = config.get("platform", "tiktok")
            style = config.get("style", "minimalist")
            clip_rank = config.get("clip_rank", 0)

            # Pick the segment for this clip's rank
            if clip_rank < len(clip_segments):
                segment = clip_segments[clip_rank]
            else:
                segment = clip_segments[clip_rank % len(clip_segments)]

            start_time = segment.start_time
            end_time = segment.end_time

            resolution = PLATFORM_RESOLUTIONS.get(platform, (1080, 1920))
            target_w, target_h = resolution
            cache_key = (clip_rank, target_w, target_h)

            if cache_key in render_cache:
                # Same rank + same resolution already rendered — reuse it
                cached = render_cache[cache_key]
                all_clips.append(ClipResult(
                    output_path=cached.output_path,
                    duration=cached.duration,
                    platform=platform,  # keep the platform label for this job
                    width=cached.width,
                    height=cached.height,
                    subtitle_path=cached.subtitle_path,
                ))
                logger.info(
                    f"Reusing render for {platform} (same resolution as "
                    f"{cached.platform}: {target_w}x{target_h})"
                )
                continue

            # Detect faces once per clip rank (not per platform)
            if clip_rank not in face_cache:
                face_cache[clip_rank] = detect_faces(
                    video_path, start_time=start_time, end_time=end_time,
                )
            face_positions = face_cache[clip_rank]

            # Generate subtitles for this resolution
            subtitle_path = os.path.join(
                work_dir, f"clip_{clip_rank}_{target_w}x{target_h}.ass",
            )
            generate_ass_subtitles(
                transcript, subtitle_path,
                start_time, end_time,
                style_name=style,
                resolution=resolution,
            )

            # Render clip with smart crop + subtitles
            output_path = os.path.join(
                work_dir, f"clip_{clip_rank}_{target_w}x{target_h}.mp4",
            )
            clip_result = render_clip(
                video_path, output_path,
                start_time, end_time,
                platform, face_positions,
                subtitle_path=subtitle_path,
            )

            render_cache[cache_key] = clip_result
            all_clips.append(clip_result)

        if status_callback:
            status_callback("completed")

        return ProcessingResult(
            clips=all_clips,
            transcript=transcript,
        )

    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        return ProcessingResult(error=str(e))

    finally:
        # Cleanup temp directory if we created it
        if cleanup_dir and work_dir and os.path.exists(work_dir):
            import shutil
            # Don't delete — caller is responsible for cleanup after upload
            pass


def process_social_text(
    youtube_url: str,
    work_dir: Optional[str] = None,
    whisper_model: str = "large-v3",
    whisper_device: str = "auto",
    whisper_compute_type: str = "auto",
    status_callback: Optional[Callable[[str], Any]] = None,
) -> dict:
    """
    Generate social media text/threads from a YouTube video transcript.

    For MVP: returns the raw transcript formatted for social posts.
    Future: GPT-powered summarization and thread generation.
    """
    cleanup_dir = work_dir is None
    if work_dir is None:
        work_dir = tempfile.mkdtemp(prefix="cremiro_")

    try:
        if status_callback:
            status_callback("downloading")

        video_path, video_info = download_video(youtube_url, work_dir)

        if status_callback:
            status_callback("transcribing")

        transcript = transcribe_video(
            video_path,
            model_size=whisper_model,
            device=whisper_device,
            compute_type=whisper_compute_type,
        )

        if status_callback:
            status_callback("completed")

        # Format transcript for social posts
        full_text = " ".join(seg.text for seg in transcript)

        # Split into thread-sized chunks (~280 chars for Twitter)
        thread_parts = []
        words = full_text.split()
        current_part = ""

        for word in words:
            if len(current_part) + len(word) + 1 > 270:
                thread_parts.append(current_part.strip())
                current_part = word
            else:
                current_part += " " + word

        if current_part.strip():
            thread_parts.append(current_part.strip())

        return {
            "full_transcript": full_text,
            "thread_parts": thread_parts,
            "title": video_info.get("title", ""),
            "duration": video_info.get("duration", 0),
        }

    except Exception as e:
        logger.error(f"Social text error: {e}")
        return {"error": str(e)}


def process_blog_post(
    youtube_url: str,
    work_dir: Optional[str] = None,
    whisper_model: str = "large-v3",
    whisper_device: str = "auto",
    whisper_compute_type: str = "auto",
    status_callback: Optional[Callable[[str], Any]] = None,
) -> dict:
    """
    Generate an SEO blog post from a YouTube video transcript.

    For MVP: returns structured transcript with chapters.
    Future: GPT-powered article generation with SEO optimization.
    """
    cleanup_dir = work_dir is None
    if work_dir is None:
        work_dir = tempfile.mkdtemp(prefix="cremiro_")

    try:
        if status_callback:
            status_callback("downloading")

        video_path, video_info = download_video(youtube_url, work_dir)

        if status_callback:
            status_callback("transcribing")

        transcript = transcribe_video(
            video_path,
            model_size=whisper_model,
            device=whisper_device,
            compute_type=whisper_compute_type,
        )

        if status_callback:
            status_callback("completed")

        # Structure transcript into sections
        full_text = " ".join(seg.text for seg in transcript)
        title = video_info.get("title", "Untitled")
        description = video_info.get("description", "")

        # Use chapters if available
        chapters = video_info.get("chapters", [])
        sections = []

        if chapters:
            for chapter in chapters:
                chapter_start = chapter.get("start_time", 0)
                chapter_end = chapter.get("end_time", chapter_start + 60)
                chapter_title = chapter.get("title", "Section")

                chapter_text = " ".join(
                    seg.text for seg in transcript
                    if seg.start >= chapter_start and seg.end <= chapter_end
                )

                sections.append({
                    "title": chapter_title,
                    "content": chapter_text,
                    "start_time": chapter_start,
                })
        else:
            # Split into ~5 equal sections
            segment_count = len(transcript)
            section_size = max(1, segment_count // 5)

            for i in range(0, segment_count, section_size):
                section_segments = transcript[i:i + section_size]
                section_text = " ".join(seg.text for seg in section_segments)
                sections.append({
                    "title": f"Section {i // section_size + 1}",
                    "content": section_text,
                    "start_time": section_segments[0].start if section_segments else 0,
                })

        return {
            "title": title,
            "description": description,
            "full_transcript": full_text,
            "sections": sections,
            "duration": video_info.get("duration", 0),
            "word_count": len(full_text.split()),
        }

    except Exception as e:
        logger.error(f"Blog post error: {e}")
        return {"error": str(e)}
