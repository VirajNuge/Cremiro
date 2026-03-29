"""
Stage 3: Clip selection using YouTube heatmap + transcript boundary snapping.
"""

import logging
from typing import Optional

from core.models import ClipSegment, TranscriptSegment

logger = logging.getLogger(__name__)


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

    Searches within a +/-5s tolerance window for the closest segment edges.
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
