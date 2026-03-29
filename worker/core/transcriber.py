"""
Stage 2: Audio transcription via faster-whisper.
"""

import logging

from core.models import TranscriptSegment, WordSegment

logger = logging.getLogger(__name__)


def transcribe_video(
    video_path: str,
    model_size: str = "large-v3",
    device: str = "auto",
    compute_type: str = "auto",
) -> list[TranscriptSegment]:
    """
    Transcribe video using faster-whisper with word-level timestamps.

    Args:
        video_path: Path to the video/audio file
        model_size: Whisper model size (tiny, base, small, medium, large-v3)
        device: Device to use (cpu, cuda, auto)
        compute_type: Compute type (int8, float16, auto)

    Returns:
        List of transcript segments with word-level timing
    """
    from faster_whisper import WhisperModel

    logger.info(f"Transcribing with model: {model_size}")

    model = WhisperModel(
        model_size,
        device=device,
        compute_type=compute_type,
        cpu_threads=8,
    )

    segments_iter, info = model.transcribe(
        video_path,
        word_timestamps=True,
        vad_filter=True,
        beam_size=1,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    logger.info(f"Detected language: {info.language} (prob: {info.language_probability:.2f})")

    transcript: list[TranscriptSegment] = []

    for segment in segments_iter:
        words = []
        if segment.words:
            for w in segment.words:
                words.append(WordSegment(
                    word=w.word.strip(),
                    start=w.start,
                    end=w.end,
                ))

        transcript.append(TranscriptSegment(
            text=segment.text.strip(),
            start=segment.start,
            end=segment.end,
            words=words,
        ))

    logger.info(f"Transcribed {len(transcript)} segments, {sum(len(s.words) for s in transcript)} words")
    return transcript
