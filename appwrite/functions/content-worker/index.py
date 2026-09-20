"""CPU-only Appwrite worker for resumable Cremiro jobs."""
import json
import logging
import os
import sys
import tempfile
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("cremiro.content-worker")
ENDPOINT = os.environ.get("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1").rstrip("/")
PROJECT = os.environ["APPWRITE_PROJECT_ID"]
API_KEY = os.environ["APPWRITE_API_KEY"]
DATABASE = os.environ.get("APPWRITE_DATABASE_ID", "cremiro")
REQUESTS_TABLE = os.environ.get("APPWRITE_REQUESTS_TABLE_ID", "requests")
JOBS_TABLE = os.environ.get("APPWRITE_JOB_ITEMS_TABLE_ID", "job_items")
BUCKET = os.environ.get("APPWRITE_MEDIA_BUCKET_ID", "media")
FUNCTION_ID = os.environ.get("APPWRITE_CONTENT_WORKER_FUNCTION_ID", "content-worker")


def headers():
    return {"X-Appwrite-Project": PROJECT, "X-Appwrite-Key": API_KEY}


def row(table, row_id):
    response = requests.get(f"{ENDPOINT}/databases/{DATABASE}/tables/{table}/rows/{row_id}", headers=headers(), timeout=30)
    response.raise_for_status()
    return response.json()


def update(table, row_id, data):
    response = requests.patch(
        f"{ENDPOINT}/databases/{DATABASE}/tables/{table}/rows/{row_id}",
        headers={**headers(), "Content-Type": "application/json"},
        json={"data": data},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def list_rows(table, request_id):
    response = requests.get(
        f"{ENDPOINT}/databases/{DATABASE}/tables/{table}/rows",
        headers=headers(),
        params=[("queries[]", f'equal("request_id",["{request_id}"])'), ("limit", "100")],
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("rows", [])


def upload_file(path, user_id, folder, mime_type):
    with open(path, "rb") as handle:
        response = requests.post(
            f"{ENDPOINT}/storage/buckets/{BUCKET}/files",
            headers=headers(),
            data={"fileId": "unique()", "permissions[]": f'read("user:{user_id}")', "folder": f"users/{user_id}/{folder}"},
            files={"file": (path.name, handle, mime_type)},
            timeout=120,
        )
    response.raise_for_status()
    return response.json()["$id"]


def trigger_next(request_id):
    response = requests.post(
        f"{ENDPOINT}/functions/{FUNCTION_ID}/executions",
        headers={**headers(), "Content-Type": "application/json"},
        json={"body": json.dumps({"request_id": request_id}), "async": True},
        timeout=30,
    )
    response.raise_for_status()


def process_item(request_data, job):
    repo_root = os.environ.get("APPWRITE_FUNCTION_ROOT", str(Path(__file__).resolve().parents[3]))
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)
    from worker.core.pipeline import process_blog_post, process_social_text, process_viral_clip

    input_data = job.get("input_data", {})
    if isinstance(input_data, str):
        input_data = json.loads(input_data or "{}")
    common = {"work_dir": tempfile.mkdtemp(prefix="cremiro-appwrite-"), "whisper_model": os.environ.get("WHISPER_MODEL", "base"), "whisper_device": "cpu", "whisper_compute_type": "int8"}
    if job["job_type"] == "social_text":
        return process_social_text(request_data["youtube_url"], **common)
    if job["job_type"] == "blog_post":
        return process_blog_post(request_data["youtube_url"], **common)
    if job["job_type"] == "viral_clip":
        result = process_viral_clip(request_data["youtube_url"], platform=job.get("platform") or "tiktok", style=job.get("style") or "minimalist", clip_index=int(input_data.get("clip_index", 0)), **common)
        if result.error:
            return {"error": result.error}
        clip = result.clips[0]
        output_path = Path(clip.output_path)
        if output_path.stat().st_size > 50 * 1024 * 1024:
            raise RuntimeError("Rendered output exceeds Appwrite's 50 MB Free-plan limit.")
        return {"file_ids": [upload_file(output_path, job["user_id"], "clips", "video/mp4")], "platform": job.get("platform"), "transcript": [segment.text for segment in result.transcript]}
    if job["job_type"] == "ai_image":
        api_key = os.environ.get("PEXELS_API_KEY")
        if not api_key:
            return {"error": "PEXELS_API_KEY is not configured for image jobs."}
        query = str(input_data.get("prompt") or input_data.get("topic") or "abstract creative background")[:100]
        search = requests.get("https://api.pexels.com/v1/search", headers={"Authorization": api_key}, params={"query": query, "per_page": 1}, timeout=30)
        search.raise_for_status()
        photos = search.json().get("photos", [])
        if not photos:
            return {"error": "No image was found for this job."}
        image = requests.get(photos[0]["src"]["large2x"], timeout=60)
        image.raise_for_status()
        image_path = Path(common["work_dir"]) / "output.jpg"
        image_path.write_bytes(image.content)
        return {"file_ids": [upload_file(image_path, job["user_id"], "images", "image/jpeg")], "provider": "pexels", "alt": photos[0].get("alt", query)}
    raise RuntimeError(f"Unsupported job type: {job['job_type']}")


def main(context):
    payload = json.loads(context.req.body or "{}")
    request_id = payload.get("request_id")
    if not request_id:
        return context.res.json({"error": "request_id is required"}, 400)
    request_data = row(REQUESTS_TABLE, request_id)
    jobs = list_rows(JOBS_TABLE, request_id)
    update(REQUESTS_TABLE, request_id, {"status": "processing", "worker_stage": "render"})
    pending = next((job for job in jobs if job.get("status") not in ("completed", "failed")), None)
    if pending:
        job = pending
        update(JOBS_TABLE, job["$id"], {"status": "processing"})
        try:
            output = process_item(request_data, job)
            if output.get("error"):
                update(JOBS_TABLE, job["$id"], {"status": "failed", "error_message": output["error"]})
            else:
                data = {key: value for key, value in output.items() if key != "file_ids"}
                update(JOBS_TABLE, job["$id"], {"status": "completed", "output_data": json.dumps(data), "output_file_ids": output.get("file_ids", [])})
        except Exception as exc:
            log.exception("job %s failed", job["$id"])
            update(JOBS_TABLE, job["$id"], {"status": "failed", "error_message": str(exc)[:1000]})
    final_jobs = list_rows(JOBS_TABLE, request_id)
    statuses = [job.get("status") for job in final_jobs]
    if any(status not in ("completed", "failed") for status in statuses):
        trigger_next(request_id)
        return context.res.json({"request_id": request_id, "status": "processing"})
    request_status = "completed" if statuses and all(status == "completed" for status in statuses) else "partially_completed" if any(status == "completed" for status in statuses) else "failed"
    update(REQUESTS_TABLE, request_id, {"status": request_status, "worker_stage": "finalize"})
    return context.res.json({"request_id": request_id, "status": request_status})
