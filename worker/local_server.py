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
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel

from core.processor import (
    process_blog_post,
    process_social_text,
    process_viral_clip,
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

    # Sign the callback
    timestamp = str(int(time.time()))
    nonce = str(uuid.uuid4())
    body_str = json.dumps(payload)
    signature_payload = f"{timestamp}.{nonce}.{body_str}"

    signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        signature_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                callback_url,
                json=payload,
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
async def process_job_item(
    job_item: JobItemPayload,
    youtube_url: str,
    callback_url: str,
) -> None:
    """Process a single job item in the background."""
    work_dir = tempfile.mkdtemp(prefix=f"cremiro_{job_item.id[:8]}_")

    try:
        # Notify: processing
        await send_callback(callback_url, job_item.id, "processing")

        if job_item.job_type == "viral_clip":
            result = process_viral_clip(
                youtube_url=youtube_url,
                platform=job_item.platform or "tiktok",
                style=job_item.style or "minimalist",
                clip_index=job_item.input_data.get("clip_index", 0),
                work_dir=work_dir,
                whisper_model=WHISPER_MODEL,
                whisper_device=WHISPER_DEVICE,
                whisper_compute_type=WHISPER_COMPUTE_TYPE,
            )

            if result.error:
                await send_callback(
                    callback_url, job_item.id, "failed",
                    error_message=result.error,
                )
                return

            # For MVP: output the clip path (production would upload to Supabase Storage)
            output_refs = [clip.output_path for clip in result.clips]
            output_data = {
                "clips": [
                    {
                        "path": clip.output_path,
                        "duration": clip.duration,
                        "platform": clip.platform,
                        "width": clip.width,
                        "height": clip.height,
                    }
                    for clip in result.clips
                ],
            }

            await send_callback(
                callback_url, job_item.id, "completed",
                output_data=output_data,
                output_refs=output_refs,
            )

        elif job_item.job_type == "social_text":
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

    # Process each job item in the background
    for job_item in payload.job_items:
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

    port = int(os.getenv("WORKER_PORT", "8000"))
    uvicorn.run(
        "local_server:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
