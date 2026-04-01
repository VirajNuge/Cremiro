"""
Template-specific FFmpeg filter graph builders (Phase 2).

Each builder returns a FilterResult with the complete -vf filter chain
and optional subtitle position override.

Templates:
  - single_face: Tight crop on single speaker (default, Phase 1 behavior)
  - split_screen: Dual speaker layout for podcasts/interviews
  - pip: Picture-in-picture for tutorials (main + face cam overlay)
  - full_frame: Minimal crop for presentations/screen recordings
"""

import logging
import os
from typing import Optional

from core.faces.detector import interpolate_face_position
from core.models import (
    FacePosition,
    FaceTrack,
    FilterResult,
)

logger = logging.getLogger(__name__)


# ── Public dispatcher ───────────────────────────────────────────────

def build_filter_chain(
    template: str,
    face_positions: list[FacePosition],
    face_tracks: Optional[list[FaceTrack]],
    start_time: float,
    end_time: float,
    src_w: int,
    src_h: int,
    target_w: int,
    target_h: int,
    subtitle_path: Optional[str] = None,
    # Phase 3.2 — Punch-in zoom at sentence boundaries
    punch_in_timestamps: Optional[list[float]] = None,
    # Phase 3.3 — Active speaker switching (stereo L/R → face 0/1)
    speaker_segments: Optional[list[tuple[float, float, int]]] = None,
    # Phase 3.4 — B-Roll overlays
    broll_segments: Optional[list[dict]] = None,
) -> FilterResult:
    """
    Dispatch to the appropriate template builder.

    Returns FilterResult with filter_chain string and optional
    subtitle position override.

    Falls back to single_face if the requested template cannot be
    built (e.g. split_screen with <2 face tracks).

    Phase 3 additions:
      punch_in_timestamps — list of relative timestamps (seconds from clip
          start) where new sentences begin; drives 1.15× zoom toggle.
      speaker_segments    — list of (t_start, t_end, speaker_id) tuples
          (relative to clip start) from stereo RMS analysis.
          speaker_id = 0 or 1 (face track index); -1 = balanced/split.
      broll_segments      — list of {keyword, start, end, url, local_path}
          dicts; each is overlaid at 90% opacity for its time window.
    """
    builders = {
        "single_face": _build_single_face,
        "split_screen": _build_split_screen,
        "pip": _build_pip,
        "full_frame": _build_full_frame,
    }

    builder = builders.get(template)
    if builder is None:
        logger.warning(f"Unknown template '{template}', falling back to single_face")
        builder = builders["single_face"]

    # Phase 3.3: active-speaker template only applies when split_screen has
    # speaker segments with clear dominance (not balanced segments only).
    use_active_speaker = (
        template == "split_screen"
        and speaker_segments
        and face_tracks
        and len(face_tracks) >= 2
        and any(s[2] in (0, 1) for s in speaker_segments)
    )

    if use_active_speaker:
        result = _build_active_speaker(
            face_positions=face_positions,
            face_tracks=face_tracks,
            start_time=start_time,
            end_time=end_time,
            src_w=src_w,
            src_h=src_h,
            target_w=target_w,
            target_h=target_h,
            subtitle_path=subtitle_path,
            speaker_segments=speaker_segments,
        )
    else:
        result = builder(
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

    # Phase 3.2: inject punch-in crop for single-stream templates.
    # split_screen / pip / active_speaker use filter_complex (";"), so
    # punch-in is wired inside those builders instead.
    clip_duration = end_time - start_time
    if punch_in_timestamps and ";" not in result.filter_chain:
        punch_crop = _build_punch_in_crop(punch_in_timestamps, clip_duration)
        if punch_crop:
            result = _inject_punch_in_simple(result, punch_crop)

    # Phase 3.4: append B-Roll overlays when segments are available and
    # local_path has been pre-downloaded by the orchestrator.
    if broll_segments:
        result = _apply_broll_overlays(result, broll_segments, clip_duration)

    return result


# ── Template builders ───────────────────────────────────────────────

def _build_single_face(
    face_positions: list[FacePosition],
    face_tracks: Optional[list[FaceTrack]],
    start_time: float,
    end_time: float,
    src_w: int,
    src_h: int,
    target_w: int,
    target_h: int,
    subtitle_path: Optional[str] = None,
) -> FilterResult:
    """
    Single-face dynamic crop — the Phase 1 behavior.
    Crops to target aspect ratio following the primary face.
    """
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        crop_h = src_h
        crop_w = int(src_h * target_ratio)
    else:
        crop_w = src_w
        crop_h = int(src_w / target_ratio)

    clip_faces = [
        p for p in face_positions
        if start_time <= p.timestamp <= end_time
    ]

    if len(clip_faces) >= 2:
        crop_filter = _build_expression_crop(
            clip_faces, start_time, end_time,
            src_w, src_h, crop_w, crop_h,
        )
    else:
        crop_filter = _build_static_crop(
            clip_faces, src_w, src_h, crop_w, crop_h,
        )

    filters = [
        crop_filter,
        f"scale={target_w}:{target_h}:flags=lanczos",
    ]

    if subtitle_path and os.path.exists(subtitle_path):
        escaped_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
        filters.append(f"ass='{escaped_path}'")

    return FilterResult(
        filter_chain=",".join(filters),
        subtitle_y_override=None,
    )


def _build_split_screen(
    face_positions: list[FacePosition],
    face_tracks: Optional[list[FaceTrack]],
    start_time: float,
    end_time: float,
    src_w: int,
    src_h: int,
    target_w: int,
    target_h: int,
    subtitle_path: Optional[str] = None,
) -> FilterResult:
    """
    Split-screen layout: top half = face 1, bottom half = face 2.
    Each half is independently cropped to follow its respective face.

    Layout (1080x1920):
    +---------------+
    |   Face 1      | 1080x960 crop centered on face 1
    |   (top)       |
    +---------------+
    |   Face 2      | 1080x960 crop centered on face 2
    |   (bottom)    |
    +---------------+

    Falls back to single_face if <2 face tracks available.
    """
    if not face_tracks or len(face_tracks) < 2:
        logger.warning(
            "split_screen requires 2+ face tracks, "
            f"got {len(face_tracks) if face_tracks else 0}. "
            "Falling back to single_face."
        )
        return _build_single_face(
            face_positions=face_positions,
            face_tracks=face_tracks,
            start_time=start_time,
            end_time=end_time,
            src_w=src_w, src_h=src_h,
            target_w=target_w, target_h=target_h,
            subtitle_path=subtitle_path,
        )

    half_h = target_h // 2  # 960 for 1920

    # Each half's aspect ratio: target_w / half_h (1080/960 = 1.125)
    half_ratio = target_w / half_h

    # Crop dimensions from source for each half
    src_ratio = src_w / src_h
    if src_ratio > half_ratio:
        crop_h = src_h
        crop_w = int(src_h * half_ratio)
    else:
        crop_w = src_w
        crop_h = int(src_w / half_ratio)

    # Build crop expressions for each face track
    top_track = face_tracks[0]
    bot_track = face_tracks[1]

    top_crop = _build_face_track_crop(
        top_track, start_time, end_time,
        src_w, src_h, crop_w, crop_h,
    )
    bot_crop = _build_face_track_crop(
        bot_track, start_time, end_time,
        src_w, src_h, crop_w, crop_h,
    )

    # Filter graph using split + independent crops + vstack
    # Note: using filter_complex-style syntax with named streams
    filter_parts = [
        f"[0:v]split=2[s1][s2]",
        f"[s1]{top_crop},scale={target_w}:{half_h}:flags=lanczos[top]",
        f"[s2]{bot_crop},scale={target_w}:{half_h}:flags=lanczos[bottom]",
        f"[top][bottom]vstack=inputs=2[v]",
    ]

    # Add subtitle burn-in after vstack
    if subtitle_path and os.path.exists(subtitle_path):
        escaped_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
        filter_parts[-1] = f"[top][bottom]vstack=inputs=2[vstacked]"
        filter_parts.append(f"[vstacked]ass='{escaped_path}'[v]")

    filter_chain = ";".join(filter_parts)

    return FilterResult(
        filter_chain=filter_chain,
        subtitle_y_override=int(target_h * 0.96),  # 1850 for 1920h
    )


def _build_pip(
    face_positions: list[FacePosition],
    face_tracks: Optional[list[FaceTrack]],
    start_time: float,
    end_time: float,
    src_w: int,
    src_h: int,
    target_w: int,
    target_h: int,
    subtitle_path: Optional[str] = None,
    pip_size: int = 280,
) -> FilterResult:
    """
    Picture-in-Picture: full frame as main content, small face cam overlay.

    Layout (1080x1920):
    +---------------------+
    |                     |
    |   Main content      | Full frame (center crop to 9:16)
    |   (full width)      |
    |                     |
    |              +-----+|
    |              | PiP || 280x280 face cam
    |              +-----+|
    +---------------------+

    Falls back to single_face if no face tracks.
    """
    if not face_tracks or len(face_tracks) < 1:
        logger.warning(
            "pip requires at least 1 face track. Falling back to single_face."
        )
        return _build_single_face(
            face_positions=face_positions,
            face_tracks=face_tracks,
            start_time=start_time,
            end_time=end_time,
            src_w=src_w, src_h=src_h,
            target_w=target_w, target_h=target_h,
            subtitle_path=subtitle_path,
        )

    # Main content: center crop to target aspect ratio (no face following)
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        main_crop_h = src_h
        main_crop_w = int(src_h * target_ratio)
    else:
        main_crop_w = src_w
        main_crop_h = int(src_w / target_ratio)

    main_x = (src_w - main_crop_w) // 2
    main_y = (src_h - main_crop_h) // 2
    main_crop = f"crop={main_crop_w}:{main_crop_h}:{main_x}:{main_y}"

    # PiP: tight crop around the face, static position (average)
    face_track = face_tracks[0]
    avg_cx = sum(p.center_x for p in face_track.positions) / len(face_track.positions)
    avg_cy = sum(p.center_y for p in face_track.positions) / len(face_track.positions)
    avg_w = sum(p.width for p in face_track.positions) / len(face_track.positions)
    avg_h = sum(p.height for p in face_track.positions) / len(face_track.positions)

    # Crop a square region around the face (1.5x face size for breathing room)
    face_crop_size = max(int(avg_w * src_w * 1.5), int(avg_h * src_h * 1.5))
    face_crop_size = max(face_crop_size, pip_size)  # at least pip_size pixels
    face_crop_size = min(face_crop_size, min(src_w, src_h))  # don't exceed source

    face_x = int(avg_cx * src_w - face_crop_size / 2)
    face_y = int(avg_cy * src_h - face_crop_size / 2)
    face_x = max(0, min(face_x, src_w - face_crop_size))
    face_y = max(0, min(face_y, src_h - face_crop_size))

    face_crop = f"crop={face_crop_size}:{face_crop_size}:{face_x}:{face_y}"

    # PiP overlay position: bottom-right with margin
    pip_margin = 20
    pip_bottom_margin = 180  # space for subtitles
    overlay_x = f"W-w-{pip_margin}"
    overlay_y = f"H-h-{pip_bottom_margin}"

    filter_parts = [
        f"[0:v]split=2[main_src][pip_src]",
        f"[main_src]{main_crop},scale={target_w}:{target_h}:flags=lanczos[main]",
        f"[pip_src]{face_crop},scale={pip_size}:{pip_size}:flags=lanczos[pip]",
        f"[main][pip]overlay={overlay_x}:{overlay_y}[v]",
    ]

    # Add subtitle burn-in after overlay
    if subtitle_path and os.path.exists(subtitle_path):
        escaped_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
        filter_parts[-1] = f"[main][pip]overlay={overlay_x}:{overlay_y}[overlaid]"
        filter_parts.append(f"[overlaid]ass='{escaped_path}'[v]")

    filter_chain = ";".join(filter_parts)

    return FilterResult(
        filter_chain=filter_chain,
        subtitle_y_override=int(target_h * 0.885),  # 1700 for 1920h
    )


def _build_full_frame(
    face_positions: list[FacePosition],
    face_tracks: Optional[list[FaceTrack]],
    start_time: float,
    end_time: float,
    src_w: int,
    src_h: int,
    target_w: int,
    target_h: int,
    subtitle_path: Optional[str] = None,
) -> FilterResult:
    """
    Full frame with minimal cropping. No face following.
    Best for screen recordings, presentations, slideshows.

    Strategy:
    - Scale to target width, then crop or pad to target height.
    - If source is wider (16:9 → 9:16): scale width, pad vertically with black.
    - If source is taller: center crop to fit.
    """
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        # Source is wider than target (e.g., 16:9 → 9:16)
        # Scale to target width, then pad vertically
        # This avoids cropping important content in screen recordings
        scaled_h = int(target_w / src_ratio)
        if scaled_h >= target_h:
            # After scaling, source is taller — crop height
            filter_str = (
                f"scale={target_w}:-2:flags=lanczos,"
                f"crop={target_w}:{target_h}:0:(ih-{target_h})/2"
            )
        else:
            # After scaling, source is shorter — pad with black
            pad_y = (target_h - scaled_h) // 2
            filter_str = (
                f"scale={target_w}:-2:flags=lanczos,"
                f"pad={target_w}:{target_h}:0:{pad_y}:black"
            )
    else:
        # Source is taller — center crop sides
        filter_str = (
            f"scale=-2:{target_h}:flags=lanczos,"
            f"crop={target_w}:{target_h}:(iw-{target_w})/2:0"
        )

    filters = [filter_str]

    if subtitle_path and os.path.exists(subtitle_path):
        escaped_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
        filters.append(f"ass='{escaped_path}'")

    return FilterResult(
        filter_chain=",".join(filters),
        subtitle_y_override=None,
    )


# ── Phase 3.3 — Active Speaker Switching ───────────────────────────

def _build_active_speaker(
    face_positions: list[FacePosition],
    face_tracks: list[FaceTrack],
    start_time: float,
    end_time: float,
    src_w: int,
    src_h: int,
    target_w: int,
    target_h: int,
    subtitle_path: Optional[str],
    speaker_segments: list[tuple[float, float, int]],
) -> FilterResult:
    """
    Active-speaker layout: dynamically shows the dominant speaker full-frame
    and falls back to split-screen during balanced segments.

    Approach:
    - Split source into two streams (face 0 and face 1).
    - Each stream is cropped to follow its respective face track at full
      target resolution.
    - A third stream carries the static split-screen fallback.
    - overlay=enable='between(t,...)' selects which stream is visible per
      time window based on speaker_segments.

    Segment types:
      speaker_id = 0  → show face-0 full-frame (top overlay)
      speaker_id = 1  → show face-1 full-frame (mid overlay)
      speaker_id = -1 → show split-screen (base layer)

    Filter graph (simplified):
      [0:v]split=3[s0][s1][ss]
      [s0]<face0 crop+scale>[f0]
      [s1]<face1 crop+scale>[f1]
      [ss]<split_screen crops+vstack>[base]
      [base][f0]overlay=enable='...'[m0]
      [m0][f1]overlay=enable='...'[v]
      [v]ass=...[v]  (optional subtitles)
    """
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h
    if src_ratio > target_ratio:
        full_crop_h = src_h
        full_crop_w = int(src_h * target_ratio)
    else:
        full_crop_w = src_w
        full_crop_h = int(src_w / target_ratio)

    track0 = face_tracks[0]
    track1 = face_tracks[1]

    face0_crop = _build_face_track_crop(
        track0, start_time, end_time,
        src_w, src_h, full_crop_w, full_crop_h,
    )
    face1_crop = _build_face_track_crop(
        track1, start_time, end_time,
        src_w, src_h, full_crop_w, full_crop_h,
    )

    # Split-screen crops for the balanced fallback
    half_h = target_h // 2
    half_ratio = target_w / half_h
    if src_ratio > half_ratio:
        ss_crop_h = src_h
        ss_crop_w = int(src_h * half_ratio)
    else:
        ss_crop_w = src_w
        ss_crop_h = int(src_w / half_ratio)

    ss_top_crop = _build_face_track_crop(
        track0, start_time, end_time,
        src_w, src_h, ss_crop_w, ss_crop_h,
    )
    ss_bot_crop = _build_face_track_crop(
        track1, start_time, end_time,
        src_w, src_h, ss_crop_w, ss_crop_h,
    )

    # Build enable expressions for each full-frame speaker overlay
    def _enable_expr(speaker_id: int) -> str:
        ranges = [
            (s[0], s[1]) for s in speaker_segments if s[2] == speaker_id
        ]
        if not ranges:
            return "0"
        parts = [f"between(t,{t0:.3f},{t1:.3f})" for t0, t1 in ranges]
        return "+".join(parts)  # OR via addition in ffmpeg boolean (>0 = true)

    enable0 = _enable_expr(0)
    enable1 = _enable_expr(1)

    filter_parts = [
        f"[0:v]split=4[s0][s1][ss_top_src][ss_bot_src]",
        f"[s0]{face0_crop},scale={target_w}:{target_h}:flags=lanczos[f0]",
        f"[s1]{face1_crop},scale={target_w}:{target_h}:flags=lanczos[f1]",
        f"[ss_top_src]{ss_top_crop},scale={target_w}:{half_h}:flags=lanczos[ss_top]",
        f"[ss_bot_src]{ss_bot_crop},scale={target_w}:{half_h}:flags=lanczos[ss_bot]",
        f"[ss_top][ss_bot]vstack=inputs=2[base]",
        f"[base][f0]overlay=x=0:y=0:enable='{enable0}'[m0]",
        f"[m0][f1]overlay=x=0:y=0:enable='{enable1}'[v]",
    ]

    if subtitle_path and os.path.exists(subtitle_path):
        escaped_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
        filter_parts[-1] = f"[m0][f1]overlay=x=0:y=0:enable='{enable1}'[pre_sub]"
        filter_parts.append(f"[pre_sub]ass='{escaped_path}'[v]")

    filter_chain = ";".join(filter_parts)

    return FilterResult(
        filter_chain=filter_chain,
        subtitle_y_override=int(target_h * 0.96),
    )


# ── Phase 3.2 — Punch-In Crop ──────────────────────────────────────

def _build_punch_in_crop(
    sentence_starts: list[float],
    clip_duration: float,
    zoom: float = 1.15,
) -> str:
    """
    Returns a crop filter string that toggles zoom at sentence boundaries.

    Odd-indexed sentences (1, 3, 5...) get ``zoom``× magnification;
    even-indexed sentences (0, 2, 4...) get 1.0× (normal).

    Inserted between face-tracking crop and scale= in the filter chain.
    Commas are escaped with \\, for FFmpeg filter chain compatibility.

    Returns "" if fewer than 2 sentences (no effect needed).
    """
    if not sentence_starts or len(sentence_starts) < 2:
        return ""

    punch_ranges: list[tuple[float, float]] = []
    for i, t_start in enumerate(sentence_starts):
        if i % 2 == 0:
            continue  # even index = normal
        t_end = sentence_starts[i + 1] if i + 1 < len(sentence_starts) else clip_duration
        punch_ranges.append((t_start, t_end))

    if not punch_ranges:
        return ""

    # Build nested if-chain from innermost outward
    zoom_expr = "1"
    for t_start, t_end in reversed(punch_ranges):
        zoom_expr = f"if(between(t\\,{t_start:.3f}\\,{t_end:.3f})\\,{zoom:.3f}\\,{zoom_expr})"

    # crop=iw/ZOOM:ih/ZOOM:(iw-ow)/2:(ih-oh)/2
    return f"crop=iw/{zoom_expr}:ih/{zoom_expr}:(iw-ow)/2:(ih-oh)/2"


def _inject_punch_in_simple(result: FilterResult, punch_crop: str) -> FilterResult:
    """
    Insert punch_crop between the face-tracking crop and the scale= filter
    in a simple comma-chain filter (no filter_complex / no ";").

    Strategy: the first filter in the chain is the face crop (crop=W:H:x:y).
    We split on "," but be careful — the crop x/y expressions may themselves
    contain escaped commas (\\,).  We scan for the first top-level comma that
    is NOT preceded by "\\" to find the split point.
    """
    chain = result.filter_chain
    split_idx = _find_first_unescaped_comma(chain)
    if split_idx == -1:
        # Only one filter — append after it, before nothing
        new_chain = f"{chain},{punch_crop}"
    else:
        face_crop_part = chain[:split_idx]
        rest = chain[split_idx + 1:]
        new_chain = f"{face_crop_part},{punch_crop},{rest}"

    return FilterResult(
        filter_chain=new_chain,
        subtitle_y_override=result.subtitle_y_override,
    )


def _find_first_unescaped_comma(s: str) -> int:
    """Return index of first ',' not preceded by '\\', or -1 if not found."""
    for i, ch in enumerate(s):
        if ch == "," and (i == 0 or s[i - 1] != "\\"):
            return i
    return -1


# ── Phase 3.4 — B-Roll Overlays ────────────────────────────────────

def _apply_broll_overlays(
    result: FilterResult,
    broll_segments: list[dict],
    clip_duration: float,
) -> FilterResult:
    """
    Append B-Roll overlay filters to an existing FilterResult.

    Each broll_segment must have:
      local_path  — absolute path to a pre-downloaded MP4 clip
      start       — float, seconds relative to clip start
      end         — float, seconds relative to clip start

    Overlay is applied at 90% opacity using:
      colorchannelmixer=aa=0.9 (yuva444p alpha manipulation)

    For simple filter chains (no ";"), we convert to filter_complex first.
    For existing filter_complex chains, we extend them.

    The final output pad is always [v].
    """
    # Filter to only usable segments (local_path must exist)
    usable = [
        seg for seg in broll_segments
        if seg.get("local_path") and os.path.exists(seg["local_path"])
    ]
    if not usable:
        logger.debug("_apply_broll_overlays: no usable segments (missing local_path)")
        return result

    chain = result.filter_chain
    uses_complex = ";" in chain

    if not uses_complex:
        # Convert simple chain to filter_complex form.
        # [0:v] → existing filters → [v]
        # Then append broll input streams + overlay chains.
        filter_parts = [f"[0:v]{chain}[v_broll_base]"]
        prev_pad = "v_broll_base"
    else:
        # Existing filter_complex already ends in [v].
        # Replace the terminal [v] with [v_broll_base] so we can chain.
        filter_parts = [chain.replace("[v]", "[v_broll_base]", 1)]
        # Edge: subtitle filter rewrites [v] at the end — replace last occurrence
        # using rfind to be safe.
        last_v = filter_parts[0].rfind("[v]")
        if last_v != -1:
            filter_parts[0] = (
                filter_parts[0][:last_v]
                + "[v_broll_base]"
                + filter_parts[0][last_v + 3:]
            )
        prev_pad = "v_broll_base"

    extra_inputs: list[str] = []
    input_idx = 1  # [0:v] is the source video; broll inputs start at 1

    for i, seg in enumerate(usable):
        local_path = seg["local_path"]
        seg_start = float(seg.get("start", 0))
        seg_end = float(seg.get("end", clip_duration))
        seg_duration = seg_end - seg_start

        broll_pad = f"broll_{i}"
        out_pad = f"v_broll_{i}"

        # Input stream pre-processing: trim to segment duration + alpha
        filter_parts.append(
            f"[{input_idx}:v]"
            f"trim=start=0:duration={seg_duration:.3f},"
            f"setpts=PTS-STARTPTS,"
            f"format=yuva444p,"
            f"colorchannelmixer=aa=0.9"
            f"[{broll_pad}]"
        )

        # Overlay on top of previous output, enabled only during segment window
        filter_parts.append(
            f"[{prev_pad}][{broll_pad}]"
            f"overlay=x=0:y=0:enable='between(t,{seg_start:.3f},{seg_end:.3f})'"
            f"[{out_pad}]"
        )

        extra_inputs.append(local_path)
        prev_pad = out_pad
        input_idx += 1

    # Rename final pad back to [v] for downstream compatibility
    filter_parts[-1] = filter_parts[-1].replace(f"[{prev_pad}]", "[v]")

    new_chain = ";".join(filter_parts)

    return FilterResult(
        filter_chain=new_chain,
        subtitle_y_override=result.subtitle_y_override,
        broll_input_paths=extra_inputs,
    )


# ── Shared helpers (moved from renderer.py) ─────────────────────────

def _build_face_track_crop(
    face_track: FaceTrack,
    start_time: float,
    end_time: float,
    src_w: int,
    src_h: int,
    crop_w: int,
    crop_h: int,
) -> str:
    """
    Build a crop filter string for a single face track.
    Uses dynamic expression crop if enough positions, static otherwise.
    """
    positions = [
        p for p in face_track.positions
        if start_time <= p.timestamp <= end_time
    ]

    if len(positions) >= 2:
        return _build_expression_crop(
            positions, start_time, end_time,
            src_w, src_h, crop_w, crop_h,
        )
    else:
        return _build_static_crop(
            positions, src_w, src_h, crop_w, crop_h,
        )


def _build_static_crop(
    clip_faces: list[FacePosition],
    src_w: int,
    src_h: int,
    crop_w: int,
    crop_h: int,
) -> str:
    """Build a static crop filter using average face position."""
    if clip_faces:
        face_cx = sum(p.center_x for p in clip_faces) / len(clip_faces)
        face_cy = sum(p.center_y for p in clip_faces) / len(clip_faces)
    else:
        face_cx, face_cy = 0.5, 0.5

    crop_x = int(face_cx * src_w - crop_w / 2)
    crop_y = int(face_cy * src_h - crop_h / 2)

    crop_x = max(0, min(crop_x, src_w - crop_w))
    crop_y = max(0, min(crop_y, src_h - crop_h))

    return f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}"


def _build_expression_crop(
    clip_faces: list[FacePosition],
    start_time: float,
    end_time: float,
    src_w: int,
    src_h: int,
    crop_w: int,
    crop_h: int,
    update_rate: float = 0.1,
    smoothing_window: int = 5,
) -> str:
    """
    Build a dynamic crop filter using ffmpeg expressions with piecewise
    linear interpolation that smoothly follows face movement.

    The approach:
    1. Sample interpolated face positions at update_rate intervals
    2. Apply moving average smoothing to prevent jitter
    3. Generate ffmpeg crop expression with 'if(lt(t,...))' chains
    """
    duration = end_time - start_time

    # Step 1: Generate raw position samples at update_rate intervals
    raw_positions: list[tuple[float, float, float]] = []
    t = 0.0
    while t <= duration:
        abs_time = start_time + t
        cx, cy = interpolate_face_position(clip_faces, abs_time)
        raw_positions.append((t, cx, cy))
        t += update_rate

    # Ensure we have the final position
    if raw_positions and raw_positions[-1][0] < duration:
        cx, cy = interpolate_face_position(clip_faces, end_time)
        raw_positions.append((duration, cx, cy))

    if len(raw_positions) < 2:
        return _build_static_crop(clip_faces, src_w, src_h, crop_w, crop_h)

    # Step 2: Apply moving average smoothing
    smoothed: list[tuple[float, float, float]] = []
    for i in range(len(raw_positions)):
        half_win = smoothing_window // 2
        start_idx = max(0, i - half_win)
        end_idx = min(len(raw_positions), i + half_win + 1)
        window = raw_positions[start_idx:end_idx]

        avg_cx = sum(p[1] for p in window) / len(window)
        avg_cy = sum(p[2] for p in window) / len(window)
        smoothed.append((raw_positions[i][0], avg_cx, avg_cy))

    # Step 3: Convert to pixel coordinates and clamp
    keyframes: list[tuple[float, int, int]] = []
    for t_rel, cx, cy in smoothed:
        crop_x = int(cx * src_w - crop_w / 2)
        crop_y = int(cy * src_h - crop_h / 2)
        crop_x = max(0, min(crop_x, src_w - crop_w))
        crop_y = max(0, min(crop_y, src_h - crop_h))
        keyframes.append((t_rel, crop_x, crop_y))

    # Step 4: Downsample — keep only significant changes
    filtered: list[tuple[float, int, int]] = [keyframes[0]]
    min_pixel_change = 5

    for kf in keyframes[1:]:
        prev = filtered[-1]
        dx = abs(kf[1] - prev[1])
        dy = abs(kf[2] - prev[2])
        if dx > min_pixel_change or dy > min_pixel_change:
            filtered.append(kf)

    if filtered[-1] != keyframes[-1]:
        filtered.append(keyframes[-1])

    # Step 5: Cap keyframes for expression length
    max_keyframes = 50
    if len(filtered) > max_keyframes:
        step = len(filtered) / max_keyframes
        downsampled = [filtered[int(i * step)] for i in range(max_keyframes)]
        if downsampled[-1] != filtered[-1]:
            downsampled.append(filtered[-1])
        filtered = downsampled

    x_expr = _build_piecewise_expr(filtered, axis="x")
    y_expr = _build_piecewise_expr(filtered, axis="y")

    logger.debug(f"Dynamic crop: {len(filtered)} keyframes over {duration:.1f}s")

    # Escape commas so ffmpeg doesn't treat them as filter separators
    x_escaped = x_expr.replace(",", "\\,")
    y_escaped = y_expr.replace(",", "\\,")

    return f"crop={crop_w}:{crop_h}:{x_escaped}:{y_escaped}"


def _build_piecewise_expr(
    keyframes: list[tuple[float, int, int]],
    axis: str,
) -> str:
    """
    Build an ffmpeg expression for piecewise linear interpolation.

    For axis="x", uses keyframe[1]; for axis="y", uses keyframe[2].

    Produces nested if(lt(t,...)) expressions for smooth transitions.
    """
    idx = 1 if axis == "x" else 2

    if len(keyframes) <= 1:
        return str(keyframes[0][idx])

    # Build nested if expressions from the end backwards
    expr = str(keyframes[-1][idx])

    for i in range(len(keyframes) - 2, -1, -1):
        t0 = keyframes[i][0]
        t1 = keyframes[i + 1][0]
        v0 = keyframes[i][idx]
        v1 = keyframes[i + 1][idx]

        dt = t1 - t0
        if dt <= 0:
            lerp = str(v0)
        elif v0 == v1:
            lerp = str(v0)
        else:
            dv = v1 - v0
            if dv < 0:
                lerp = f"{v0}+({dv})*(t-{t0:.3f})/{dt:.3f}"
            else:
                lerp = f"{v0}+{dv}*(t-{t0:.3f})/{dt:.3f}"

        if i == 0 and len(keyframes) == 2:
            expr = lerp
        else:
            expr = f"if(lt(t,{t1:.3f}),{lerp},{expr})"

    return expr
