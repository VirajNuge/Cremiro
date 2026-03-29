"""
Scene detection module using PySceneDetect.

Detects scene boundaries (cuts, transitions) within video segments.
Used for:
  1. Niche classification signal — high cut rate = edited content,
     low cut rate = podcast/talking-head
  2. Future: clip quality scoring (penalize fragmented clips)

Performance: ~2-3x realtime on CPU for 1080p.
Only processes the selected clip segment, NOT the full video.
"""

import logging
from typing import Optional

from core.models import SceneSegment

logger = logging.getLogger(__name__)


def detect_scene_boundaries(
    video_path: str,
    start_time: float,
    end_time: float,
    threshold: float = 27.0,
    min_scene_len: int = 15,
) -> list[SceneSegment]:
    """
    Detect scene cuts within a video segment.

    Args:
        video_path: Path to source video
        start_time: Segment start (seconds)
        end_time: Segment end (seconds)
        threshold: ContentDetector sensitivity (lower = more sensitive, default 27.0)
        min_scene_len: Minimum frames between cuts (default 15)

    Returns:
        List of SceneSegment dataclasses with start/end/duration.
        Empty list if no cuts detected (single continuous scene).
    """
    try:
        from scenedetect import ContentDetector, detect

        scene_list = detect(
            video_path=video_path,
            detector=ContentDetector(
                threshold=threshold,
                min_scene_len=min_scene_len,
            ),
            start_time=start_time,
            end_time=end_time,
        )

        segments = [
            SceneSegment(
                start=s.get_seconds(),
                end=e.get_seconds(),
                duration=e.get_seconds() - s.get_seconds(),
            )
            for s, e in scene_list
        ]

        logger.info(
            f"Scene detection: {len(segments)} scenes, "
            f"{max(0, len(segments) - 1)} cuts in "
            f"{end_time - start_time:.1f}s segment"
        )
        return segments

    except Exception as e:
        logger.warning(f"Scene detection failed, treating as single scene: {e}")
        return []


def count_cuts(
    video_path: str,
    start_time: float,
    end_time: float,
    threshold: float = 27.0,
) -> int:
    """
    Count scene cuts in a segment.

    Cuts = len(scenes) - 1. A segment with no detected cuts has 0 cuts.
    """
    scenes = detect_scene_boundaries(video_path, start_time, end_time, threshold)
    return max(0, len(scenes) - 1)
