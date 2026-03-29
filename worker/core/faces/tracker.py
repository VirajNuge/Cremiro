"""
Multi-face tracking with IoU-based identity assignment.

Extends Phase 1 single-face detection to:
  1. Detect ALL faces in each sampled frame (not just the largest)
  2. Assign persistent IDs across frames using IoU-based greedy matching
  3. Return list[FaceTrack] — one track per unique face with timestamped positions

Uses MediaPipe Face Detection (already installed, ~15ms/frame on CPU).
IoU tracking is sufficient for talking-head/podcast videos where faces
don't move drastically between 0.5s samples.
"""

import logging
from typing import Optional

from core.models import FacePosition, FaceTrack

logger = logging.getLogger(__name__)


def compute_iou(a: FacePosition, b: FacePosition) -> float:
    """
    Compute Intersection over Union between two face bounding boxes.
    Both use normalized coordinates (0-1): center_x, center_y, width, height.
    """
    a_x1 = a.center_x - a.width / 2
    a_y1 = a.center_y - a.height / 2
    a_x2 = a.center_x + a.width / 2
    a_y2 = a.center_y + a.height / 2

    b_x1 = b.center_x - b.width / 2
    b_y1 = b.center_y - b.height / 2
    b_x2 = b.center_x + b.width / 2
    b_y2 = b.center_y + b.height / 2

    inter_x1 = max(a_x1, b_x1)
    inter_y1 = max(a_y1, b_y1)
    inter_x2 = min(a_x2, b_x2)
    inter_y2 = min(a_y2, b_y2)

    if inter_x2 <= inter_x1 or inter_y2 <= inter_y1:
        return 0.0

    inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
    a_area = a.width * a.height
    b_area = b.width * b.height
    union_area = a_area + b_area - inter_area

    return inter_area / union_area if union_area > 0 else 0.0


def detect_face_tracks(
    video_path: str,
    start_time: float,
    end_time: float,
    sample_interval: float = 0.5,
    max_samples: int = 300,
    min_detection_confidence: float = 0.5,
    iou_threshold: float = 0.3,
    lost_buffer: int = 10,
) -> list[FaceTrack]:
    """
    Detect and track multiple faces across video frames.

    Algorithm:
    1. Sample frames at sample_interval (default 0.5s = 2 FPS)
    2. Run MediaPipe face detection on each frame (returns ALL faces)
    3. Match faces between consecutive frames using IoU overlap
    4. Assign persistent track IDs (new face = new ID)
    5. Return one FaceTrack per unique face, containing all its positions

    Args:
        video_path: Path to source video
        start_time: Clip start time (seconds)
        end_time: Clip end time (seconds)
        sample_interval: Seconds between frame samples (default 0.5)
        max_samples: Maximum frames to sample
        min_detection_confidence: MediaPipe confidence threshold
        iou_threshold: Minimum IoU to consider same face (default 0.3)
        lost_buffer: Samples before a lost track is deactivated (default 10 = ~5s)

    Returns:
        List of FaceTrack, sorted by avg_size descending (largest face first).
        Each FaceTrack has:
          - track_id: int (1, 2, 3...)
          - positions: list[FacePosition] with timestamps
          - avg_size: float (average normalized area)
    """
    try:
        import cv2
        import mediapipe as mp
    except ImportError as e:
        logger.warning(f"Missing dependency for face tracking: {e}")
        return []

    logger.info(
        f"Tracking faces: {start_time:.1f}s-{end_time:.1f}s, "
        f"interval={sample_interval}s"
    )

    mp_face_detection = mp.solutions.face_detection  # type: ignore[attr-defined]
    face_detection = mp_face_detection.FaceDetection(
        model_selection=1,  # full range model
        min_detection_confidence=min_detection_confidence,
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.warning("Failed to open video for face tracking")
        return []

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        cap.release()
        face_detection.close()
        logger.warning("Invalid FPS, cannot track faces")
        return []

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Track storage: track_id -> list of FacePosition
    tracks: dict[int, list[FacePosition]] = {}
    # Last known position per active track
    active_tracks: dict[int, FacePosition] = {}
    # How many consecutive samples each track has been missing
    lost_count: dict[int, int] = {}
    next_id = 1

    samples_taken = 0
    t = start_time

    while t <= end_time and samples_taken < max_samples:
        frame_idx = int(t * fps)
        if frame_idx >= total_frames:
            break

        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            t += sample_interval
            samples_taken += 1
            continue

        timestamp = t
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_detection.process(rgb_frame)

        # Extract all detected faces as FacePosition
        detections: list[FacePosition] = []
        if results.detections:
            for detection in results.detections:
                bbox = detection.location_data.relative_bounding_box
                cx = bbox.xmin + bbox.width / 2
                cy = bbox.ymin + bbox.height / 2
                detections.append(FacePosition(
                    timestamp=timestamp,
                    center_x=min(max(cx, 0.0), 1.0),
                    center_y=min(max(cy, 0.0), 1.0),
                    width=max(bbox.width, 0.0),
                    height=max(bbox.height, 0.0),
                ))

        # Sort detections by area descending (match largest first)
        detections.sort(key=lambda d: d.width * d.height, reverse=True)

        # Greedy IoU matching
        matched_tracks: set[int] = set()
        matched_dets: set[int] = set()

        for det_idx, det in enumerate(detections):
            best_track_id: Optional[int] = None
            best_iou = iou_threshold

            for track_id, last_pos in active_tracks.items():
                if track_id in matched_tracks:
                    continue
                iou = compute_iou(det, last_pos)
                if iou > best_iou:
                    best_iou = iou
                    best_track_id = track_id

            if best_track_id is not None:
                # Matched — append to existing track
                tracks[best_track_id].append(det)
                active_tracks[best_track_id] = det
                lost_count[best_track_id] = 0
                matched_tracks.add(best_track_id)
                matched_dets.add(det_idx)
            else:
                # New face — create new track
                tracks[next_id] = [det]
                active_tracks[next_id] = det
                lost_count[next_id] = 0
                matched_dets.add(det_idx)
                next_id += 1

        # Increment lost count for unmatched active tracks
        for track_id in list(active_tracks.keys()):
            if track_id not in matched_tracks:
                lost_count[track_id] = lost_count.get(track_id, 0) + 1
                # Remove tracks that have been lost for too long
                if lost_count[track_id] >= lost_buffer:
                    del active_tracks[track_id]
                    del lost_count[track_id]

        t += sample_interval
        samples_taken += 1

    cap.release()
    face_detection.close()

    # Build FaceTrack objects
    result: list[FaceTrack] = []
    for track_id, positions in tracks.items():
        if not positions:
            continue
        avg_size = sum(p.width * p.height for p in positions) / len(positions)
        result.append(FaceTrack(
            track_id=track_id,
            positions=positions,
            avg_size=avg_size,
        ))

    # Sort by avg_size descending (largest face = primary speaker)
    result.sort(key=lambda ft: ft.avg_size, reverse=True)

    # Re-assign track_ids based on sorted order (1 = largest)
    for i, track in enumerate(result):
        track.track_id = i + 1

    logger.info(
        f"Face tracking: {len(result)} tracks from "
        f"{samples_taken} samples ({sum(len(t.positions) for t in result)} total detections)"
    )
    return result
