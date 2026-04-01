"""
Shared data structures and constants for the video processing pipeline.
"""

from dataclasses import dataclass, field
from typing import Optional


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
        "font_size": 58,
        "primary_color": "&H00FFFFFF",  # white
        "outline_color": "&H00000000",  # black
        "outline_width": 3,
        "bold": False,
        "position": "bottom",  # subtitle position
    },
    "fast_talker": {
        "font_name": "Impact",
        "font_size": 68,
        "primary_color": "&H0000FFFF",  # yellow
        "outline_color": "&H00000000",  # black
        "outline_width": 4,
        "bold": True,
        "position": "center",
    },
    "cinematic": {
        "font_name": "Georgia",
        "font_size": 52,
        "primary_color": "&H00FFFFFF",  # white
        "outline_color": "&H00000000",  # black
        "outline_width": 2,
        "bold": False,
        "position": "bottom",
    },
}

# Brand color: #fd6333 -> ASS BGR: &H003363FD&
BRAND_ORANGE_ASS = "&H003363FD&"
# Brand color: #16423c -> ASS BGR: &H003C4216&
BRAND_GREEN_ASS = "&H003C4216&"


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
class Phrase:
    """A group of 2-4 words displayed together as a subtitle unit."""
    words: list[WordSegment]
    start: float  # first word start
    end: float  # last word end
    text: str  # joined words


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


@dataclass
class ClipSegment:
    """A ranked clip segment selected from the video."""
    start_time: float
    end_time: float
    rank: int  # 1 = best (most replayed), 2 = second best, etc.
    score: float  # average heatmap engagement score (0-1)


# ── Phase 2 data structures ─────────────────────────────────────────
@dataclass
class FaceTrack:
    """A tracked face across multiple frames with persistent ID."""
    track_id: int                    # Persistent ID (1, 2, 3...)
    positions: list[FacePosition]    # Timestamped bounding boxes
    avg_size: float                  # Average normalized face area (width * height)


@dataclass
class SceneSegment:
    """A continuous scene between two cuts."""
    start: float       # Start time in seconds
    end: float         # End time in seconds
    duration: float    # Duration in seconds


@dataclass
class VideoClassification:
    """Result of niche classification."""
    niche: str              # "podcast", "tutorial", "talking_head", "presentation", "other"
    template: str           # "split_screen", "pip", "single_face", "full_frame"
    confidence: float       # 0.0 - 1.0
    face_count: int         # Number of distinct faces detected
    scene_cut_rate: float   # Cuts per minute (high = heavily edited)
    reasoning: str          # Human-readable explanation


@dataclass
class FilterResult:
    """Output of a template filter graph builder."""
    filter_chain: str                         # Complete -vf string for ffmpeg
    subtitle_y_override: Optional[int] = None # Override subtitle Y position (pixels)
    # Phase 3.4: absolute paths to B-Roll input files that must be passed
    # as additional -i arguments to ffmpeg (in the order they appear in
    # filter_complex).  Empty list when no B-Roll is used.
    broll_input_paths: list[str] = field(default_factory=list)
