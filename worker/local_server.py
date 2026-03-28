"""
Local development FastAPI server for the Cremiro worker.

Receives job dispatches from the Next.js API, processes them using
the shared core/processor.py pipeline, and sends results back
via the webhook callback.

Usage:
    cd worker
    pip install -r requirements.txt
    python local_server.py

    # For external access (Ngrok):
    ngrok http 8000
    # Set WORKER_URL in .env.local to your Ngrok URL
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import shutil
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from core.processor import (
    process_blog_post,
    process_social_text,
    process_viral_clip,
    process_viral_clips_batch,
)

# Load environment variables
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cremiro.worker")

# ── Configuration ───────────────────────────────────────────────────
WEBHOOK_SECRET = os.getenv("WORKER_WEBHOOK_SECRET", "")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")  # Use 'base' for local dev (faster)
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WORKER_PORT = int(os.getenv("WORKER_PORT", "8000"))
# Base URL this worker is reachable at — used to build public output URLs.
# Override with your Ngrok URL when testing externally.
WORKER_BASE_URL = os.getenv("WORKER_BASE_URL", f"http://localhost:{WORKER_PORT}")

# Persistent directory that stores rendered output files.
# Files survive between requests so the frontend can fetch/download them.
OUTPUTS_DIR = Path(os.getenv("OUTPUTS_DIR", "./outputs")).resolve()
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

if not WEBHOOK_SECRET:
    logger.warning("WORKER_WEBHOOK_SECRET not set — webhook callbacks will fail!")


# ── Models ──────────────────────────────────────────────────────────
class JobItemPayload(BaseModel):
    id: str
    job_type: str
    credits_cost: int
    platform: Optional[str] = None
    style: Optional[str] = None
    input_data: dict = {}


class ProcessRequest(BaseModel):
    request_id: str
    job_items: list[JobItemPayload]
    youtube_url: str
    video_id: str
    callback_url: str


# ── HMAC Verification ──────────────────────────────────────────────
def verify_hmac(
    body: bytes,
    signature: str,
    timestamp: str,
    nonce: str,
) -> bool:
    """Verify HMAC-SHA256 signature from the Next.js API."""
    if not WEBHOOK_SECRET:
        logger.warning("No webhook secret configured — skipping verification")
        return True

    payload = f"{timestamp}.{nonce}.{body.decode('utf-8')}"
    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


# ── Webhook Callback ───────────────────────────────────────────────
async def send_callback(
    callback_url: str,
    job_item_id: str,
    status: str,
    output_data: Optional[dict] = None,
    output_refs: Optional[list[str]] = None,
    error_message: Optional[str] = None,
) -> None:
    """Send a status update back to the Next.js webhook endpoint."""
    payload: dict[str, Any] = {
        "job_item_id": job_item_id,
        "status": status,
    }

    if output_data is not None:
        payload["output_data"] = output_data
    if output_refs is not None:
        payload["output_refs"] = output_refs
    if error_message is not None:
        payload["error_message"] = error_message

    # Encode body manually so the signed bytes exactly match what is sent.
    # httpx's json= uses compact encoding (no spaces), whereas json.dumps()
    # defaults to spaces after separators — causing signature mismatch.
    body_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    timestamp = str(int(time.time()))
    nonce = str(uuid.uuid4())
    signature_payload = f"{timestamp}.{nonce}.{body_bytes.decode('utf-8')}"

    signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        signature_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                callback_url,
                content=body_bytes,
                headers={
                    "Content-Type": "application/json",
                    "X-Signature": signature,
                    "X-Timestamp": timestamp,
                    "X-Nonce": nonce,
                },
            )

            if response.status_code != 200:
                logger.error(
                    f"Callback failed for {job_item_id}: "
                    f"status={response.status_code}, body={response.text[:200]}"
                )
            else:
                logger.info(f"Callback sent: {job_item_id} -> {status}")

    except Exception as e:
        logger.error(f"Callback error for {job_item_id}: {e}")


# ── Background Processing ──────────────────────────────────────────
async def process_viral_clip_batch(
    clip_jobs: list[JobItemPayload],
    youtube_url: str,
    callback_url: str,
) -> None:
    """
    Process multiple viral_clip job items as a single batch.

    Downloads the video once, transcribes once, selects N clip segments
    ranked by YouTube's "most replayed" heatmap, then renders each clip.
    Each job item gets its own callback with its rendered output.
    """
    work_dir = tempfile.mkdtemp(prefix=f"cremiro_batch_")

    try:
        # Notify all jobs: processing
        for job in clip_jobs:
            await send_callback(callback_url, job.id, "processing")

        # Build clip configs from job items
        # Each job's clip_index maps to a rank in the heatmap ranking
        clip_configs: list[dict] = []
        for job in clip_jobs:
            clip_configs.append({
                "platform": job.platform or "tiktok",
                "style": job.style or "minimalist",
                "clip_rank": job.input_data.get("clip_index", 0),
                "job_item_id": job.id,  # track which job gets which clip
            })

        # Determine how many unique clip segments we need
        max_rank = max(c["clip_rank"] for c in clip_configs) + 1

        # Run the batch pipeline (download once, transcribe once)
        result = process_viral_clips_batch(
            youtube_url=youtube_url,
            clip_configs=clip_configs,
            num_clips=max_rank,
            work_dir=work_dir,
            whisper_model=WHISPER_MODEL,
            whisper_device=WHISPER_DEVICE,
            whisper_compute_type=WHISPER_COMPUTE_TYPE,
        )

        if result.error:
            for job in clip_jobs:
                await send_callback(
                    callback_url, job.id, "failed",
                    error_message=result.error,
                )
            return

        # Match each rendered clip back to its job item and send callbacks.
        # Multiple jobs may share the same rendered file (e.g. tiktok + reels
        # + shorts all produce 1080x1920) — we copy it once per job_item_id.
        for i, (config, clip) in enumerate(zip(clip_configs, result.clips)):
            job_id = config["job_item_id"]

            filename = f"{job_id}_{clip.platform}.mp4"
            dest = OUTPUTS_DIR / filename

            # Copy the rendered file (may be the same source for same-res platforms)
            shutil.copy2(clip.output_path, dest)
            public_url = f"{WORKER_BASE_URL}/outputs/{filename}"

            clips_meta = [{
                "url": public_url,
                "duration": clip.duration,
                "platform": clip.platform,
                "width": clip.width,
                "height": clip.height,
            }]

            logger.info(f"Output available at: {public_url}")

            await send_callback(
                callback_url, job_id, "completed",
                output_data={"clips": clips_meta},
                output_refs=[public_url],
            )

    except Exception as e:
        logger.error(f"Batch clip processing failed: {e}")
        for job in clip_jobs:
            await send_callback(
                callback_url, job.id, "failed",
                error_message=str(e),
            )

    finally:
        try:
            shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass


async def process_job_item(
    job_item: JobItemPayload,
    youtube_url: str,
    callback_url: str,
) -> None:
    """Process a single non-clip job item in the background."""
    work_dir = tempfile.mkdtemp(prefix=f"cremiro_{job_item.id[:8]}_")

    try:
        # Notify: processing
        await send_callback(callback_url, job_item.id, "processing")

        if job_item.job_type == "social_text":
            result = process_social_text(
                youtube_url=youtube_url,
                work_dir=work_dir,
                whisper_model=WHISPER_MODEL,
                whisper_device=WHISPER_DEVICE,
                whisper_compute_type=WHISPER_COMPUTE_TYPE,
            )

            if "error" in result:
                await send_callback(
                    callback_url, job_item.id, "failed",
                    error_message=result["error"],
                )
                return

            await send_callback(
                callback_url, job_item.id, "completed",
                output_data=result,
            )

        elif job_item.job_type == "blog_post":
            result = process_blog_post(
                youtube_url=youtube_url,
                work_dir=work_dir,
                whisper_model=WHISPER_MODEL,
                whisper_device=WHISPER_DEVICE,
                whisper_compute_type=WHISPER_COMPUTE_TYPE,
            )

            if "error" in result:
                await send_callback(
                    callback_url, job_item.id, "failed",
                    error_message=result["error"],
                )
                return

            await send_callback(
                callback_url, job_item.id, "completed",
                output_data=result,
            )

        elif job_item.job_type == "ai_image":
            # AI Image generation — placeholder for future implementation
            # Would integrate with DALL-E, Midjourney API, or Stable Diffusion
            await send_callback(
                callback_url, job_item.id, "failed",
                error_message="AI Image generation is not yet available.",
            )

        else:
            await send_callback(
                callback_url, job_item.id, "failed",
                error_message=f"Unknown job type: {job_item.job_type}",
            )

    except Exception as e:
        logger.error(f"Job {job_item.id} failed: {e}")
        await send_callback(
            callback_url, job_item.id, "failed",
            error_message=str(e),
        )

    finally:
        # Cleanup working directory
        try:
            shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass


# ── FastAPI App ─────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Cremiro Worker started")
    logger.info(f"Whisper model: {WHISPER_MODEL}, device: {WHISPER_DEVICE}")
    yield
    logger.info("Cremiro Worker shutting down")


app = FastAPI(
    title="Cremiro Worker",
    description="Video processing worker for Cremiro",
    version="0.1.0",
    lifespan=lifespan,
)

# Serve rendered output files — browser fetches video directly from here.
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "cremiro-worker"}


@app.post("/process")
async def process_request(
    request: Request,
    x_signature: str = Header(...),
    x_timestamp: str = Header(...),
    x_nonce: str = Header(...),
):
    """
    Receive a processing request from the Next.js API.

    Verifies HMAC signature, then processes each job item
    in the background (non-blocking).
    """
    body = await request.body()

    # Verify HMAC signature
    if not verify_hmac(body, x_signature, x_timestamp, x_nonce):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Timestamp replay protection (5 minute window)
    try:
        req_timestamp = int(x_timestamp)
        now = int(time.time())
        if abs(now - req_timestamp) > 300:
            raise HTTPException(status_code=401, detail="Request expired")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid timestamp")

    # Parse request
    try:
        payload = ProcessRequest(**json.loads(body))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request: {e}")

    logger.info(
        f"Received request {payload.request_id} "
        f"with {len(payload.job_items)} job items"
    )

    # Process job items — batch viral_clip jobs together (download once),
    # process other job types individually.
    clip_jobs = [j for j in payload.job_items if j.job_type == "viral_clip"]
    other_jobs = [j for j in payload.job_items if j.job_type != "viral_clip"]

    if clip_jobs:
        asyncio.create_task(
            process_viral_clip_batch(clip_jobs, payload.youtube_url, payload.callback_url)
        )

    for job_item in other_jobs:
        asyncio.create_task(
            process_job_item(job_item, payload.youtube_url, payload.callback_url)
        )

    return {
        "status": "accepted",
        "request_id": payload.request_id,
        "job_count": len(payload.job_items),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "local_server:app",
        host="0.0.0.0",
        port=WORKER_PORT,
        reload=True,
        log_level="info",
    )
