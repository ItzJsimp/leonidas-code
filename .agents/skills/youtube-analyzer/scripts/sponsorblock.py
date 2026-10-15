"""SponsorBlock API integration to strip sponsors, self-promos, and fluff."""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
import urllib.error

SPONSORBLOCK_API = "https://sponsor.ajay.app/api/skipSegments"
DEFAULT_CATEGORIES = ["sponsor", "selfpromo", "interaction", "intro", "outro"]


def extract_video_id(url_or_id: str) -> str | None:
    if len(url_or_id) == 11 and re.match(r"^[A-Za-z0-9_-]{11}$", url_or_id):
        return url_or_id
    match = re.search(r"(?:v=|/|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})", url_or_id)
    return match.group(1) if match else None


def fetch_skip_segments(video_id: str, categories: list[str] | None = None) -> list[dict]:
    """Fetch skip segments from SponsorBlock API. Returns list of {start, end, category}."""
    cats = categories or DEFAULT_CATEGORIES
    cats_param = json.dumps(cats)
    url = f"{SPONSORBLOCK_API}?videoID={video_id}&categories={urllib.parse.quote(cats_param)}"
    req = urllib.request.Request(url, headers={"User-Agent": "LeonidasAIOS-YouTubeAnalyzer/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            segments = []
            for item in data:
                pts = item.get("segment", [])
                if len(pts) == 2:
                    segments.append({
                        "start": float(pts[0]),
                        "end": float(pts[1]),
                        "category": item.get("category", "sponsor"),
                    })
            return sorted(segments, key=lambda s: s["start"])
    except Exception:
        # Fail open on network timeouts or 404s (no sponsor segments)
        return []


def is_in_skipped(timestamp: float, skip_segments: list[dict]) -> bool:
    for seg in skip_segments:
        if seg["start"] <= timestamp <= seg["end"]:
            return True
    return False


def prune_transcript(segments: list[dict], skip_segments: list[dict]) -> tuple[list[dict], int]:
    """Remove transcript lines falling inside skip segments. Returns (pruned_segments, dropped_count)."""
    if not skip_segments:
        return segments, 0
    kept = []
    dropped = 0
    for seg in segments:
        ts = seg.get("start", 0.0)
        if is_in_skipped(ts, skip_segments):
            dropped += 1
        else:
            kept.append(seg)
    return kept, dropped
