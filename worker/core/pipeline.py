"""
Pipeline orchestration — thin glue that connects all processing stages.

Shared by the Appwrite content-worker function and local processing tools.
Pipeline stages:
  1. Download: yt-dlp extracts video + audio + heatmap metadata
  2. Transcribe: faster-whisper generates word-level timestamps
  3. Select Clips: heatmap-based engagement ranking + transcript boundary snapping
  4. Detect Faces: MediaPipe samples frames for face positions (per clip)
  5. Smart Crop: FFmpeg dynamically crops to platform aspect ratio following face
  6. Burn Subtitles: FFmpeg overlays karaoke-highlighted ASS subtitles
  7. Upload: Results stored to the private Appwrite media bucket

For multiple clips, download and transcription happen once. Each clip is
independently face-detected, cropped, and rendered.
"""

import logging
import os
import tempfile
from typing import Any, Callable, Optional

from core.classify import classify_video
from core.clip_selector import select_clip_segments
from core.downloader import download_video
from core.faces.detector import detect_faces
from core.faces.tracker import detect_face_tracks
from core.models import (
    PLATFORM_RESOLUTIONS,
    ClipResult,
    FaceTrack,
    ProcessingResult,
    TranscriptSegment,
    VideoClassification,
)
from core.render.renderer import render_clip
from core.scenes import detect_scene_boundaries
from core.subtitles.ass_builder import generate_ass_subtitles
from core.transcriber import transcribe_video

logger = logging.getLogger(__name__)


def _get_subtitle_y_for_template(
    template: str,
    target_h: int,
) -> Optional[int]:
    """
    Get subtitle Y position override for a given template.
    Returns None for templates that use default positioning.
    """
    overrides = {
        "split_screen": int(target_h * 0.96),   # 1850 for 1920h
        "pip": int(target_h * 0.885),            # 1700 for 1920h
    }
    return overrides.get(template)


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
        # Deduplicate: platforms with the same resolution + same clip rank + same
        # template share the exact same rendered video. Render once per unique
        # (rank, resolution, template), then copy for duplicate platforms.
        if status_callback:
            status_callback("rendering")

        all_clips: list[ClipResult] = []

        # Cache: (clip_rank, target_w, target_h, template) -> rendered ClipResult
        render_cache: dict[tuple[int, int, int, str], ClipResult] = {}
        # Cache: clip_rank -> face_positions (flat list for single_face fallback)
        face_cache: dict[int, list] = {}
        # Phase 2 caches
        face_track_cache: dict[int, list[FaceTrack]] = {}
        classification_cache: dict[int, VideoClassification] = {}

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

            # ── Phase 2: Multi-face tracking (once per clip rank) ──
            if clip_rank not in face_track_cache:
                if status_callback:
                    status_callback("classifying")
                try:
                    face_track_cache[clip_rank] = detect_face_tracks(
                        video_path, start_time=start_time, end_time=end_time,
                    )
                except Exception as e:
                    logger.warning(f"Face tracking failed, falling back: {e}")
                    face_track_cache[clip_rank] = []

            face_tracks = face_track_cache[clip_rank]

            # ── Phase 2: Scene detection + classification (once per clip rank) ──
            if clip_rank not in classification_cache:
                try:
                    scenes = detect_scene_boundaries(
                        video_path, start_time=start_time, end_time=end_time,
                    )
                except Exception as e:
                    logger.warning(f"Scene detection failed: {e}")
                    scenes = []

                classification = classify_video(
                    face_tracks=face_tracks,
                    scenes=scenes,
                    clip_duration=end_time - start_time,
                    transcript=transcript,
                    video_info=video_info,
                )
                classification_cache[clip_rank] = classification
                logger.info(
                    f"Clip #{clip_rank} classified as {classification.niche} "
                    f"-> template={classification.template} "
                    f"(confidence={classification.confidence:.2f}, "
                    f"{classification.reasoning})"
                )

            classification = classification_cache[clip_rank]
            template = classification.template

            cache_key = (clip_rank, target_w, target_h, template)

            if cache_key in render_cache:
                # Same rank + resolution + template already rendered — reuse
                cached = render_cache[cache_key]
                all_clips.append(ClipResult(
                    output_path=cached.output_path,
                    duration=cached.duration,
                    platform=platform,
                    width=cached.width,
                    height=cached.height,
                    subtitle_path=cached.subtitle_path,
                ))
                logger.info(
                    f"Reusing render for {platform} (same resolution as "
                    f"{cached.platform}: {target_w}x{target_h}, "
                    f"template={template})"
                )
                continue

            # ── Face positions (flat list for backward compat) ──
            if clip_rank not in face_cache:
                if face_tracks:
                    # Use the largest face track's positions
                    face_cache[clip_rank] = face_tracks[0].positions
                else:
                    face_cache[clip_rank] = detect_faces(
                        video_path, start_time=start_time, end_time=end_time,
                    )
            face_positions = face_cache[clip_rank]

            # ── Generate subtitles with template-specific positioning ──
            subtitle_y_override = _get_subtitle_y_for_template(template, target_h)

            subtitle_path = os.path.join(
                work_dir,
                f"clip_{clip_rank}_{target_w}x{target_h}_{template}.ass",
            )
            generate_ass_subtitles(
                transcript, subtitle_path,
                start_time, end_time,
                style_name=style,
                resolution=resolution,
                position_override=subtitle_y_override,
            )

            # ── Render clip with template + face tracks ──
            output_path = os.path.join(
                work_dir,
                f"clip_{clip_rank}_{target_w}x{target_h}_{template}.mp4",
            )
            clip_result = render_clip(
                video_path, output_path,
                start_time, end_time,
                platform, face_positions,
                subtitle_path=subtitle_path,
                template=template,
                face_tracks=face_tracks,
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
