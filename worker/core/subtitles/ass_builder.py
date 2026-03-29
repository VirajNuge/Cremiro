"""
Karaoke subtitle engine with phrase-chunked word-by-word highlighting.

Architecture (Oracle-recommended overlapping Dialogues approach):
  - Group words into phrases of 2-4 words
  - Layer 0 (base): Full phrase in dim style for entire phrase duration
  - Layer 1 (highlight): Active word in bright brand-orange style during its timing

This produces a "karaoke" effect where the viewer sees a phrase with the
current word highlighted, which increases retention by ~41%.
"""

import logging
from typing import Optional

from core.models import (
    BRAND_ORANGE_ASS,
    STYLE_CONFIGS,
    Phrase,
    TranscriptSegment,
    WordSegment,
)

logger = logging.getLogger(__name__)


def chunk_words_into_phrases(
    words: list[WordSegment],
    max_words: int = 4,
    max_gap: float = 0.8,
) -> list[Phrase]:
    """
    Group words into display phrases. Split on:
    - Reaching max_words count
    - Gap > max_gap seconds between consecutive words
    - Punctuation (. ! ? ; :) at end of word

    Args:
        words: List of timed words
        max_words: Maximum words per phrase (default 4)
        max_gap: Maximum gap between words before splitting (seconds)

    Returns:
        List of Phrase objects
    """
    if not words:
        return []

    phrases: list[Phrase] = []
    current_words: list[WordSegment] = []

    for word in words:
        # Check if we should start a new phrase
        should_split = False

        if current_words:
            # Gap between this word and previous word
            gap = word.start - current_words[-1].end
            if gap > max_gap:
                should_split = True

            # Reached max words
            if len(current_words) >= max_words:
                should_split = True

            # Previous word ended with sentence-ending punctuation
            prev_text = current_words[-1].word
            if prev_text and prev_text[-1] in ".!?;:":
                should_split = True

        if should_split and current_words:
            phrases.append(_make_phrase(current_words))
            current_words = []

        current_words.append(word)

    # Don't forget the last phrase
    if current_words:
        phrases.append(_make_phrase(current_words))

    return phrases


def _make_phrase(words: list[WordSegment]) -> Phrase:
    """Create a Phrase from a list of WordSegments."""
    return Phrase(
        words=list(words),
        start=words[0].start,
        end=words[-1].end,
        text=" ".join(w.word for w in words),
    )


def generate_ass_subtitles(
    transcript: list[TranscriptSegment],
    output_path: str,
    start_time: float,
    end_time: float,
    style_name: str = "minimalist",
    resolution: tuple[int, int] = (1080, 1920),
    position_override: Optional[int] = None,
) -> str:
    """
    Generate ASS subtitle file with karaoke word-by-word highlighting.

    Uses a two-layer approach:
      - Layer 0: Full phrase in semi-transparent white (dim base)
      - Layer 1: Active word in brand orange (bright highlight)

    Args:
        transcript: Full transcript with word timing
        output_path: Path to write the .ass file
        start_time: Clip start time in seconds
        end_time: Clip end time in seconds
        style_name: Style preset name
        resolution: Video resolution (width, height)
        position_override: Optional vertical position in pixels for subtitle
            placement. When set, overrides the style's MarginV with an
            absolute \\pos() tag. Used by split_screen and pip templates.

    Returns:
        Path to the generated .ass file
    """
    style = STYLE_CONFIGS.get(style_name, STYLE_CONFIGS["minimalist"])
    width, height = resolution

    # ASS alignment: 2 = bottom center, 5 = center
    alignment = 5 if style["position"] == "center" else 2
    margin_v = 80 if style["position"] == "bottom" else 0

    # Highlight style: same font but brand orange, bold, slightly larger
    highlight_font_size = style["font_size"] + 2

    header = f"""[Script Info]
Title: Cremiro Subtitles
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{style["font_name"]},{style["font_size"]},{style["primary_color"]},&H000000FF,{style["outline_color"]},&H80000000,{-1 if style["bold"] else 0},0,0,0,100,100,0,0,1,{style["outline_width"]},0,{alignment},20,20,{margin_v},1
Style: Highlight,{style["font_name"]},{highlight_font_size},{BRAND_ORANGE_ASS},&H000000FF,{style["outline_color"]},&H80000000,-1,0,0,0,100,100,0,0,1,{style["outline_width"] + 1},0,{alignment},20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events: list[str] = []

    # Build position override tag if needed
    if position_override is not None:
        center_x = width // 2
        pos_tag = rf"{{\an2\pos({center_x},{position_override})}}"
    else:
        pos_tag = ""

    # Collect all words within the clip range
    clip_words: list[WordSegment] = []
    for segment in transcript:
        if segment.end <= start_time or segment.start >= end_time:
            continue
        if segment.words:
            for word in segment.words:
                if word.end <= start_time or word.start >= end_time:
                    continue
                clip_words.append(word)

    # Group words into phrases
    phrases = chunk_words_into_phrases(clip_words)

    for phrase in phrases:
        # Adjust timing relative to clip start
        phrase_start = max(phrase.start - start_time, 0)
        phrase_end = min(phrase.end - start_time, end_time - start_time)

        phrase_start_ts = _seconds_to_ass_time(phrase_start)
        phrase_end_ts = _seconds_to_ass_time(phrase_end)

        # Escape ASS special characters in the full phrase text
        phrase_text = _escape_ass(phrase.text)

        # Layer 0: Base phrase — semi-transparent white (dim) for full duration
        dim_text = r"{\c&H80FFFFFF&}" + phrase_text
        events.append(
            f"Dialogue: 0,{phrase_start_ts},{phrase_end_ts},Default,,0,0,0,,{pos_tag}{dim_text}"
        )

        # Layer 1: Per-word highlights — render the FULL phrase text so the
        # highlighted word stays visually in the same position as in Layer 0.
        # Dim words before/after the highlight with fully transparent color
        # (&H00FFFFFF& alpha=00 = fully transparent), highlight the active
        # word in brand orange.
        for word in phrase.words:
            w_start = max(word.start - start_time, 0)
            w_end = min(word.end - start_time, end_time - start_time)

            w_start_ts = _seconds_to_ass_time(w_start)
            w_end_ts = _seconds_to_ass_time(w_end)

            # Build phrase text with per-word inline color overrides:
            # non-highlighted words are transparent, highlighted word is orange
            parts: list[str] = []
            for pw in phrase.words:
                pw_escaped = _escape_ass(pw.word)
                if pw.word == word.word and pw.start == word.start:
                    # This is the active word — render in brand orange
                    parts.append(rf"{{\c{BRAND_ORANGE_ASS}}}" + pw_escaped)
                else:
                    # Other words — fully transparent (invisible)
                    parts.append(r"{\c&H00FFFFFF&\alpha&HFF&}" + pw_escaped)
            # Rejoin with spaces, then reset color after last word
            highlighted_phrase = " ".join(parts) + r"{\r}"

            events.append(
                f"Dialogue: 1,{w_start_ts},{w_end_ts},Highlight,,0,0,0,,{pos_tag}{highlighted_phrase}"
            )

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("\n".join(events))
        f.write("\n")

    logger.info(f"Generated karaoke ASS subtitles: {output_path} ({len(events)} events, {len(phrases)} phrases)")
    return output_path


def _escape_ass(text: str) -> str:
    """Escape ASS special characters."""
    return text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")


def _seconds_to_ass_time(seconds: float) -> str:
    """Convert seconds to ASS time format (H:MM:SS.CC)."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
