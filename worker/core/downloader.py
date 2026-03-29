"""
Stage 1: Video download via yt-dlp.
"""

import json
import logging
import os
import subprocess

logger = logging.getLogger(__name__)


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
        logger.info("No cookies configured — downloading without authentication")

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
        raise RuntimeError("Video download failed. Please try again.")

    # Parse video info from JSON output — filter for JSON lines only (yt-dlp
    # may mix warnings/progress lines with the final JSON object)
    json_lines = [ln for ln in result.stdout.splitlines() if ln.strip().startswith("{")]
    if not json_lines:
        raise RuntimeError("yt-dlp produced no JSON output — cannot read video metadata.")
    video_info = json.loads(json_lines[-1])

    # Find the downloaded file
    video_path = os.path.join(output_dir, "source.mp4")
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
