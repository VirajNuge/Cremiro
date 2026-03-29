"""
Stage 5: Video rendering — probe, build filter chain, run FFmpeg.

This is now a thin wrapper that:
  1. Probes source video dimensions
  2. Delegates filter chain building to filtergraph.py
  3. Runs FFmpeg with the filter chain
  4. Returns ClipResult

All crop logic, template builders, and expression generators live
in filtergraph.py.
"""

import json
import logging
import subprocess
from typing import Optional

from core.models import (
    PLATFORM_RESOLUTIONS,
    ClipResult,
    FacePosition,
    FaceTrack,
)
from core.render.filtergraph import build_filter_chain

logger = logging.getLogger(__name__)


def render_clip(
    video_path: str,
    output_path: str,
    start_time: float,
    end_time: float,
    platform: str,
    face_positions: list[FacePosition],
    subtitle_path: Optional[str] = None,
    template: str = "single_face",
    face_tracks: Optional[list[FaceTrack]] = None,
) -> ClipResult:
    """
    Render a clip with template-based cropping and optional subtitle burn-in.

    Uses FFmpeg to:
    1. Trim to start/end time
    2. Apply template-specific filter chain (crop, scale, overlay, etc.)
    3. Burn in subtitles (if provided)
    4. Re-encode with quality settings

    Args:
        video_path: Source video path
        output_path: Output clip path
        start_time: Start time in seconds
        end_time: End time in seconds
        platform: Target platform (determines aspect ratio)
        face_positions: Face positions for smart cropping
        subtitle_path: Optional .ass subtitle file path
        template: Rendering template (single_face, split_screen, pip, full_frame)
        face_tracks: Optional multi-face tracking data (for split_screen, pip)

    Returns:
        ClipResult with output info
    """
    target_w, target_h = PLATFORM_RESOLUTIONS.get(platform, (1080, 1920))

    # Probe source video dimensions
    src_w, src_h = _probe_dimensions(video_path)

    # Delegate filter chain building to filtergraph module
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
    )

    duration = end_time - start_time

    # Determine if we need -filter_complex (contains ';') or simple -vf
    uses_complex = ";" in filter_result.filter_chain
    if uses_complex:
        # Complex filter graph — use -filter_complex and map the output
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", video_path,
            "-filter_complex", filter_result.filter_chain,
            "-map", "[v]",
            "-map", "0:a?",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-threads", "0",
            output_path,
        ]
    else:
        # Simple filter chain — use -vf
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", video_path,
            "-vf", filter_result.filter_chain,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-threads", "0",
            output_path,
        ]

    logger.info(
        f"Rendering clip: {start_time:.1f}s - {end_time:.1f}s "
        f"({platform}, template={template})"
    )
    logger.debug(f"FFmpeg filter: {filter_result.filter_chain}")

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


def _probe_dimensions(video_path: str) -> tuple[int, int]:
    """Probe source video dimensions using ffprobe."""
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
    return src_w, src_h
