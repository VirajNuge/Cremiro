"""
Stage 3: Face detection and position interpolation.

Uses MediaPipe for lightweight face detection (Phase 1).
Will be replaced with YOLO26n + ByteTrack in Phase 2.
"""

import logging
from typing import Optional

from core.models import FacePosition

logger = logging.getLogger(__name__)


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
