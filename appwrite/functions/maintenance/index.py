"""Scheduled stale-job monitor for Appwrite Cloud."""
import os
from datetime import datetime, timedelta, timezone
import requests


def main(context):
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    site_url = os.environ.get("NEXT_PUBLIC_SITE_URL", "").rstrip("/")
    if not site_url:
        return context.res.json({"error": "NEXT_PUBLIC_SITE_URL is not configured"}, 500)
    response = requests.post(
        f"{site_url}/api/internal/maintenance",
        headers={"X-Appwrite-Key": os.environ["APPWRITE_API_KEY"]},
        timeout=60,
    )
    response.raise_for_status()
    return context.res.json({"ok": True, "cutoff": cutoff, **response.json()})
