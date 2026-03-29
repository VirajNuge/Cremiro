"""
Niche classifier — heuristic-based video content classification.

Classifies video content to select the optimal rendering template.
Uses lightweight heuristics (no ML models, no GPU) based on:
  1. Face count and spatial arrangement from multi-face tracking
  2. Scene cut rate from scene detection
  3. Transcript keywords (optional signal)
  4. Video metadata from yt-dlp (title, description, categories)

Decision tree output maps to one of four templates:
  - split_screen: 2+ speakers on opposite sides (podcast/interview)
  - pip: Picture-in-picture (tutorial with face cam)
  - single_face: Tight crop on single speaker (talking head)
  - full_frame: Minimal crop (presentation/screen recording)
"""

import logging
from statistics import mean
from typing import Optional

from core.models import (
    FaceTrack,
    SceneSegment,
    TranscriptSegment,
    VideoClassification,
)

logger = logging.getLogger(__name__)

# ── Keyword lists for heuristic classification ──────────────────────

TUTORIAL_KEYWORDS = [
    "tutorial", "how to", "step by step", "walkthrough", "demo",
    "screen", "code", "coding", "programming", "setup", "install",
    "guide", "learn", "lesson", "course",
]

PODCAST_KEYWORDS = [
    "podcast", "episode", "interview", "conversation", "guest",
    "host", "discuss", "talk", "chat", "ep.", "ep ",
]


def classify_video(
    face_tracks: list[FaceTrack],
    scenes: list[SceneSegment],
    clip_duration: float,
    transcript: list[TranscriptSegment],
    video_info: dict,
) -> VideoClassification:
    """
    Classify video niche and select rendering template.

    Decision tree:
    1. Count distinct face tracks with sufficient presence (>30% of frames)
    2. Compute scene cut rate (cuts per minute)
    3. Check face spatial arrangement (left/right split vs. centered)
    4. Check transcript/metadata for keyword signals
    5. Apply rules to select niche + template

    Args:
        face_tracks: Multi-face tracking results
        scenes: Scene boundary results for the clip segment
        clip_duration: Duration of the clip in seconds
        transcript: Transcript segments for keyword analysis
        video_info: yt-dlp video metadata dict

    Returns:
        VideoClassification with niche, template, confidence, reasoning
    """
    # Step 1: Count prominent faces (present in >30% of expected samples)
    # Expected samples = clip_duration / 0.5 (default sample interval)
    expected_samples = max(1, clip_duration / 0.5)
    prominent_faces = [
        t for t in face_tracks
        if len(t.positions) > expected_samples * 0.3
    ]
    face_count = len(prominent_faces)

    # Step 2: Scene cut rate (cuts per minute)
    cut_count = max(0, len(scenes) - 1)
    cuts_per_min = (cut_count / clip_duration) * 60 if clip_duration > 0 else 0

    # Step 3: Face arrangement analysis (for 2+ faces)
    faces_are_split = False
    if face_count >= 2:
        f1 = prominent_faces[0]
        f2 = prominent_faces[1]
        avg_x1 = mean(p.center_x for p in f1.positions)
        avg_x2 = mean(p.center_x for p in f2.positions)
        faces_are_split = (
            (avg_x1 < 0.4 and avg_x2 > 0.6)
            or (avg_x2 < 0.4 and avg_x1 > 0.6)
        )

    # Step 4: Keyword signals from transcript + metadata
    text = _extract_text(transcript, video_info)
    has_tutorial_keywords = _match_keywords(text, TUTORIAL_KEYWORDS)
    has_podcast_keywords = _match_keywords(text, PODCAST_KEYWORDS)

    # Step 5: Decision tree
    # Rule 1: Podcast — 2+ faces on opposite sides, low cut rate
    if face_count >= 2 and cuts_per_min < 5 and faces_are_split:
        return VideoClassification(
            niche="podcast",
            template="split_screen",
            confidence=0.85,
            face_count=face_count,
            scene_cut_rate=cuts_per_min,
            reasoning=(
                f"{face_count} faces on opposite sides, "
                f"low cut rate ({cuts_per_min:.1f}/min)"
            ),
        )

    # Rule 2: Interview — 2+ faces, low cut rate (not necessarily split)
    if face_count >= 2 and cuts_per_min < 10:
        return VideoClassification(
            niche="interview",
            template="split_screen",
            confidence=0.7,
            face_count=face_count,
            scene_cut_rate=cuts_per_min,
            reasoning=(
                f"{face_count} faces, moderate cut rate ({cuts_per_min:.1f}/min)"
            ),
        )

    # Rule 3: Tutorial — 1 face + BOTH high cuts AND tutorial keywords
    # Require both signals to avoid false positives on plain talking-head videos
    # that happen to have tutorial-adjacent words in their title/description.
    if face_count == 1 and cuts_per_min > 8 and has_tutorial_keywords:
        return VideoClassification(
            niche="tutorial",
            template="pip",
            confidence=0.75,
            face_count=face_count,
            scene_cut_rate=cuts_per_min,
            reasoning=(
                f"1 face, high cuts ({cuts_per_min:.1f}/min) + tutorial keywords"
            ),
        )

    # Rule 4: Presentation — 0 faces + tutorial keywords or high cuts
    if face_count == 0 and (has_tutorial_keywords or cuts_per_min > 10):
        return VideoClassification(
            niche="presentation",
            template="full_frame",
            confidence=0.6,
            face_count=face_count,
            scene_cut_rate=cuts_per_min,
            reasoning=(
                f"No faces, "
                f"{'tutorial keywords' if has_tutorial_keywords else 'high cut rate'} "
                f"({cuts_per_min:.1f} cuts/min)"
            ),
        )

    # Rule 5: Talking head — 1 face, low cut rate
    if face_count == 1 and cuts_per_min < 8:
        return VideoClassification(
            niche="talking_head",
            template="single_face",
            confidence=0.8,
            face_count=face_count,
            scene_cut_rate=cuts_per_min,
            reasoning=(
                f"1 dominant face, low cut rate ({cuts_per_min:.1f}/min)"
            ),
        )

    # Fallback — safe default (Phase 1 behavior)
    return VideoClassification(
        niche="other",
        template="single_face",
        confidence=0.5,
        face_count=face_count,
        scene_cut_rate=cuts_per_min,
        reasoning=(
            f"No strong signal (faces={face_count}, "
            f"cuts={cuts_per_min:.1f}/min), using safe default"
        ),
    )


def _extract_text(
    transcript: list[TranscriptSegment],
    video_info: dict,
) -> str:
    """
    Extract searchable text from transcript and video metadata.
    Returns lowercase concatenation of title + description + first 500 chars of transcript.
    """
    parts: list[str] = []

    title = video_info.get("title", "")
    if title:
        parts.append(title)

    description = video_info.get("description", "")
    if description:
        parts.append(description[:500])

    # First ~500 chars of transcript
    transcript_text = " ".join(seg.text for seg in transcript)
    if transcript_text:
        parts.append(transcript_text[:500])

    return " ".join(parts).lower()


def _match_keywords(text: str, keywords: list[str]) -> bool:
    """Check if any keyword appears in the text."""
    return any(kw in text for kw in keywords)
