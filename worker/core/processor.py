"""
Core video processing pipeline.

Shared between local FastAPI server and Modal.com production deployment.
Pipeline stages:
  1. Download: yt-dlp extracts video + audio
  2. Transcribe: faster-whisper generates word-level timestamps
  3. Detect Faces: MediaPipe samples frames for face positions
  4. Smart Crop: FFmpeg crops to platform aspect ratio centered on face
  5. Burn Subtitles: FFmpeg overlays word-timed ASS subtitles
  6. Upload: Results stored to configured storage (local or Supabase Storage)

Each stage is independently callable for debugging and testing.
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
        "font_size": 42,
        "primary_color": "&H00FFFFFF",  # white
        "outline_color": "&H00000000",  # black
        "outline_width": 2,
        "bold": False,
        "position": "bottom",  # subtitle position
    },
    "fast_talker": {
        "font_name": "Impact",
        "font_size": 52,
        "primary_color": "&H0000FFFF",  # yellow
        "outline_color": "&H00000000",  # black
        "outline_width": 3,
        "bold": True,
        "position": "center",
    },
    "cinematic": {
        "font_name": "Georgia",
        "font_size": 38,
        "primary_color": "&H00FFFFFF",  # white
        "outline_color": "&H00000000",  # black
        "outline_width": 1,
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
        "--no-warnings",
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
        # Sanitize error — don't leak internal paths
        if "is not a valid URL" in error_msg or "Unsupported URL" in error_msg:
            raise ValueError("Invalid or unsupported YouTube URL.")
        if "Video unavailable" in error_msg or "Private video" in error_msg:
            raise ValueError("Video is unavailable or private.")
        if "duration" in error_msg.lower():
            raise ValueError(f"Video exceeds maximum duration of {max_duration // 60} minutes.")
        raise RuntimeError(f"Video download failed. Please try again.")

    # Parse video info from JSON output
    video_info = json.loads(result.stdout.strip().split("\n")[-1])

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
    sample_interval: float = 4.0,  # sample every N seconds
    max_samples: int = 150,
) -> list[FacePosition]:
    """
    Detect face positions by sampling frames at regular intervals.
    Uses MediaPipe Face Detection for lightweight, accurate tracking.

    Args:
        video_path: Path to the video file
        sample_interval: Seconds between frame samples
        max_samples: Maximum number of frames to sample

    Returns:
        List of face positions with timestamps
    """
    import cv2
    import mediapipe as mp

    logger.info(f"Detecting faces (sample every {sample_interval}s)")

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

    positions: list[FacePosition] = []
    frame_idx = 0
    samples_taken = 0

    while cap.isOpened() and samples_taken < max_samples:
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

        if frame_idx >= total_frames:
            break

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

    # Get average face position for the clip duration
    mid_time = (start_time + end_time) / 2
    face_cx, face_cy = interpolate_face_position(face_positions, mid_time)

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

    This is the main entry point called by both the local FastAPI server
    and the Modal.com production wrapper.

    Args:
        youtube_url: YouTube video URL
        platform: Target platform (tiktok, reels, shorts, linkedin, twitter)
        style: Style preset (minimalist, fast_talker, cinematic)
        clip_index: Which clip to extract (0-based, for multi-clip requests)
        work_dir: Working directory (uses temp dir if None)
        whisper_model: Whisper model size
        whisper_device: Device for whisper (cpu, cuda, auto)
        whisper_compute_type: Compute type for whisper
        status_callback: Optional callback for progress updates

    Returns:
        ProcessingResult with clip paths and transcript
    """
    cleanup_dir = work_dir is None
    if work_dir is None:
        work_dir = tempfile.mkdtemp(prefix="cremiro_")

    try:
        # Stage 1: Download
        if status_callback:
            status_callback("downloading")

        video_path, video_info = download_video(youtube_url, work_dir)
        video_duration = video_info.get("duration", 0)

        # Stage 2: Transcribe
        if status_callback:
            status_callback("transcribing")

        transcript = transcribe_video(
            video_path,
            model_size=whisper_model,
            device=whisper_device,
            compute_type=whisper_compute_type,
        )

        # Stage 3: Detect faces
        if status_callback:
            status_callback("analyzing")

        face_positions = detect_faces(video_path)

        # Stage 4: Select clip segment
        # Simple strategy: divide video into segments and pick by index
        # A more sophisticated approach would use engagement analysis
        clip_duration = min(60, video_duration)  # max 60s per clip
        num_possible_clips = max(1, int(video_duration / clip_duration))

        if clip_index >= num_possible_clips:
            clip_index = clip_index % num_possible_clips

        start_time = clip_index * clip_duration
        end_time = min(start_time + clip_duration, video_duration)

        # If the segment is too short, use the last valid segment
        if end_time - start_time < 5:
            start_time = max(0, video_duration - clip_duration)
            end_time = video_duration

        # Stage 5: Generate subtitles
        if status_callback:
            status_callback("rendering")

        resolution = PLATFORM_RESOLUTIONS.get(platform, (1080, 1920))
        subtitle_path = os.path.join(work_dir, f"clip_{clip_index}_{platform}.ass")
        generate_ass_subtitles(
            transcript, subtitle_path,
            start_time, end_time,
            style_name=style,
            resolution=resolution,
        )

        # Stage 6: Render clip with smart crop + subtitles
        output_path = os.path.join(work_dir, f"clip_{clip_index}_{platform}.mp4")
        clip_result = render_clip(
            video_path, output_path,
            start_time, end_time,
            platform, face_positions,
            subtitle_path=subtitle_path,
        )

        if status_callback:
            status_callback("completed")

        return ProcessingResult(
            clips=[clip_result],
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
