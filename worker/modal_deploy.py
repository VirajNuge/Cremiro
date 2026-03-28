"""
Modal.com production deployment for the Cremiro worker.

Uses the same core/processor.py pipeline as the local server,
wrapped in Modal's serverless GPU infrastructure.

Usage:
    # First time setup:
    pip install modal
    modal token new

    # Deploy:
    modal deploy modal_deploy.py

    # Test locally via Modal's local runner:
    modal run modal_deploy.py

The deployed URL is your WORKER_URL for production.
"""

import hashlib
import hmac
import json
import logging
import os
import time
import uuid

import modal

logger = logging.getLogger("cremiro.worker.modal")

# ── Modal App Setup ─────────────────────────────────────────────────
app = modal.App("cremiro-worker")

# Docker image with all dependencies
worker_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "ffmpeg",
        "libgl1-mesa-glx",
        "libglib2.0-0",
    )
    .pip_install(
        "faster-whisper==1.1.0",
        "mediapipe==0.10.21",
        "yt-dlp==2025.1.15",
        "httpx==0.28.1",
        "Pillow==11.1.0",
        "opencv-python-headless==4.10.0.84",
    )
)

# Mount the core processor code
core_mount = modal.Mount.from_local_dir(
    os.path.join(os.path.dirname(__file__), "core"),
    remote_path="/root/core",
)

# Secrets
webhook_secret = modal.Secret.from_name("cremiro-webhook-secret")


# ── Processing Function ────────────────────────────────────────────
@app.function(
    image=worker_image,
    mounts=[core_mount],
    secrets=[webhook_secret],
    gpu="T4",  # Use T4 for cost-effective GPU inference
    timeout=600,  # 10 minute timeout per job
    retries=0,  # Don't retry — let the webhook handle failure
    allow_concurrent_inputs=4,
)
async def process_job_item(
    job_item_data: dict,
    youtube_url: str,
    callback_url: str,
) -> dict:
    """Process a single job item on Modal infrastructure."""
    import sys
    sys.path.insert(0, "/root")

    from core.processor import (
        process_blog_post,
        process_social_text,
        process_viral_clip,
    )

    job_item_id = job_item_data["id"]
    job_type = job_item_data["job_type"]
    platform = job_item_data.get("platform", "tiktok")
    style = job_item_data.get("style", "minimalist")
    input_data = job_item_data.get("input_data", {})
    secret = os.environ.get("WORKER_WEBHOOK_SECRET", "")

    async def send_status(status, output_data=None, output_refs=None, error_message=None):
        """Send status callback to Next.js webhook."""
        import httpx

        payload = {"job_item_id": job_item_id, "status": status}
        if output_data:
            payload["output_data"] = output_data
        if output_refs:
            payload["output_refs"] = output_refs
        if error_message:
            payload["error_message"] = error_message

        timestamp = str(int(time.time()))
        nonce = str(uuid.uuid4())
        body_str = json.dumps(payload)
        sig_payload = f"{timestamp}.{nonce}.{body_str}"
        signature = hmac.new(
            secret.encode(), sig_payload.encode(), hashlib.sha256
        ).hexdigest()

        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                callback_url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Signature": signature,
                    "X-Timestamp": timestamp,
                    "X-Nonce": nonce,
                },
            )

    try:
        await send_status("processing")

        if job_type == "viral_clip":
            result = process_viral_clip(
                youtube_url=youtube_url,
                platform=platform,
                style=style,
                clip_index=input_data.get("clip_index", 0),
                whisper_model="large-v3",
                whisper_device="cuda",
                whisper_compute_type="float16",
            )

            if result.error:
                await send_status("failed", error_message=result.error)
                return {"status": "failed", "error": result.error}

            # In production, upload to Supabase Storage here
            # For now, return local paths
            output_data = {
                "clips": [
                    {
                        "duration": clip.duration,
                        "platform": clip.platform,
                        "width": clip.width,
                        "height": clip.height,
                    }
                    for clip in result.clips
                ],
            }

            await send_status("completed", output_data=output_data)
            return {"status": "completed"}

        elif job_type == "social_text":
            result = process_social_text(
                youtube_url=youtube_url,
                whisper_model="large-v3",
                whisper_device="cuda",
                whisper_compute_type="float16",
            )

            if "error" in result:
                await send_status("failed", error_message=result["error"])
                return {"status": "failed", "error": result["error"]}

            await send_status("completed", output_data=result)
            return {"status": "completed"}

        elif job_type == "blog_post":
            result = process_blog_post(
                youtube_url=youtube_url,
                whisper_model="large-v3",
                whisper_device="cuda",
                whisper_compute_type="float16",
            )

            if "error" in result:
                await send_status("failed", error_message=result["error"])
                return {"status": "failed", "error": result["error"]}

            await send_status("completed", output_data=result)
            return {"status": "completed"}

        elif job_type == "ai_image":
            await send_status("failed", error_message="AI Image generation not yet available.")
            return {"status": "failed", "error": "Not implemented"}

        else:
            await send_status("failed", error_message=f"Unknown job type: {job_type}")
            return {"status": "failed", "error": f"Unknown job type: {job_type}"}

    except Exception as e:
        logger.error(f"Job {job_item_id} failed: {e}")
        await send_status("failed", error_message=str(e))
        return {"status": "failed", "error": str(e)}


# ── Web Endpoint ────────────────────────────────────────────────────
@app.function(
    image=worker_image,
    secrets=[webhook_secret],
    allow_concurrent_inputs=20,
)
@modal.web_endpoint(method="POST")
async def process(request: dict):
    """
    Web endpoint that receives processing requests from Next.js.

    This is the WORKER_URL for production deployment.
    The endpoint URL is provided by Modal after deployment.
    """
    import asyncio

    request_id = request.get("request_id", "unknown")
    job_items = request.get("job_items", [])
    youtube_url = request.get("youtube_url", "")
    callback_url = request.get("callback_url", "")

    logger.info(f"Received request {request_id} with {len(job_items)} items")

    # Spawn each job item as a separate Modal function call
    for job_item_data in job_items:
        process_job_item.spawn(job_item_data, youtube_url, callback_url)

    return {
        "status": "accepted",
        "request_id": request_id,
        "job_count": len(job_items),
    }
