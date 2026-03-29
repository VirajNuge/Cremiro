"""
Core video processing pipeline.

Modules:
  - models: Shared data structures and constants
  - pipeline: Orchestration (process_viral_clips_batch, etc.)
  - downloader: YouTube video download via yt-dlp
  - transcriber: Audio transcription via faster-whisper
  - clip_selector: Heatmap-based clip selection
  - faces: Face detection and position tracking
  - subtitles: Karaoke-style ASS subtitle generation
  - render: FFmpeg rendering with dynamic face-following crop
"""
