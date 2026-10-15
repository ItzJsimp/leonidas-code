#!/usr/bin/env python3
"""YouTube Search & Discovery Engine for Leonidas AIOS & SimplyGersi AIOS.

Executes zero-token local batch search via yt-dlp, calculates deterministic
Quality Scores (0-100), checks against the local Trusted Creator Roster,
detects duplicates in raw/youtube/, and generates compact SponsorBlock-pruned
Transcript Skims for high-signal video curation.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Try importing shared SponsorBlock helpers from youtube-analyzer if available
ANALYZER_SCRIPTS = Path(__file__).resolve().parent.parent.parent / "youtube-analyzer" / "scripts"
if ANALYZER_SCRIPTS.exists():
    sys.path.insert(0, str(ANALYZER_SCRIPTS))
    try:
        from sponsorblock import extract_video_id, fetch_skip_segments, prune_transcript
    except ImportError:
        extract_video_id = None
        fetch_skip_segments = None
        prune_transcript = None
else:
    extract_video_id = None
    fetch_skip_segments = None
    prune_transcript = None


def fallback_extract_video_id(url_or_id: str) -> str | None:
    if len(url_or_id) == 11 and re.match(r"^[A-Za-z0-9_-]{11}$", url_or_id):
        return url_or_id
    match = re.search(r"(?:v=|/|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})", url_or_id)
    return match.group(1) if match else None


get_video_id = extract_video_id or fallback_extract_video_id


def format_duration(seconds: float | int | None) -> str:
    if not seconds or seconds < 0:
        return "0:00"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def load_creator_dossiers(workspace_root: Path) -> dict[str, dict]:
    """Scans raw/youtube/creators/*.md to load creator handles, slugs, and trust scores."""
    creators_dir = workspace_root / "raw/youtube/creators"
    dossiers = {}
    if not creators_dir.exists():
        return dossiers

    for md_file in creators_dir.glob("*.md"):
        try:
            content = md_file.read_text(encoding="utf-8", errors="ignore")
            title_m = re.search(r'title:\s*["\']?(.*?)["\']?\n', content)
            slug_m = re.search(r'slug:\s*["\']?(.*?)["\']?\n', content)
            trust_m = re.search(r'trust_score:\s*(\d+)', content)
            eng_m = re.search(r'average_engagement_rate:\s*["\']?(.*?)["\']?\n', content)

            slug = slug_m.group(1).strip() if slug_m else md_file.stem
            name = title_m.group(1).strip() if title_m else slug
            trust = int(trust_m.group(1)) if trust_m else 75

            dossiers[slug.lower()] = {
                "name": name,
                "slug": slug,
                "trust_score": trust,
                "avg_engagement": eng_m.group(1) if eng_m else "N/A",
                "path": str(md_file),
            }
            dossiers[name.lower()] = dossiers[slug.lower()]
        except Exception:
            continue
    return dossiers


def load_existing_analyses(workspace_root: Path) -> dict[str, dict]:
    """Scans raw/youtube/ for existing analysis records to flag duplicates."""
    youtube_dir = workspace_root / "raw/youtube"
    records = {}
    if not youtube_dir.exists():
        return records

    for md_file in youtube_dir.glob("**/*.md"):
        if md_file.name in ("index.md", "queue.txt", "queue.jsonl") or "creators" in md_file.parts:
            continue
        try:
            content = md_file.read_text(encoding="utf-8", errors="ignore")
            id_m = re.search(r'(?:id:\s*["\']?|watch\?v=|youtu\.be/)([A-Za-z0-9_-]{11})', content)
            if id_m:
                v_id = id_m.group(1)
                title_m = re.search(r'title:\s*["\']?(.*?)["\']?\n', content)
                records[v_id] = {
                    "path": str(md_file),
                    "title": title_m.group(1) if title_m else md_file.parent.name,
                }
        except Exception:
            continue
    return records


def run_ytdlp_search(query: str, channel: str | None, limit: int = 30) -> list[dict]:
    """Runs yt-dlp to extract flat candidate metadata in JSON format."""
    if channel:
        # Channel-specific search
        ch = channel.strip()
        if not ch.startswith("http"):
            if not ch.startswith("@"):
                ch = f"@{ch}"
            url = f"https://www.youtube.com/{ch}/search?query={urllib.parse.quote(query)}"
        else:
            url = f"{ch.rstrip('/')}/search?query={urllib.parse.quote(query)}"
        target = url
    else:
        # Global search
        target = f"ytsearch{limit}:{query}"

    cmd = [
        "yt-dlp",
        target,
        "--flat-playlist",
        "--dump-single-json",
        "--no-warnings",
        "--ignore-errors",
    ]

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=25)
        data = json.loads(res.stdout)
        entries = data.get("entries", [])
        return [e for e in entries if e]
    except Exception as e:
        print(f"[search] yt-dlp error: {e}", file=sys.stderr)
        return []


def calculate_quality_score(
    entry: dict,
    dossiers: dict[str, dict],
    existing_analyses: dict[str, dict],
    min_sec: int,
    max_sec: int,
    include_shorts: bool,
) -> tuple[float, dict]:
    """Calculates deterministic Quality Score (0-100) and breakdown."""
    score = 0.0
    breakdown = {}

    v_id = entry.get("id") or ""
    duration = entry.get("duration") or 0
    views = entry.get("view_count") or 0
    uploader = entry.get("uploader") or entry.get("channel") or ""
    uploader_id = entry.get("uploader_id") or ""
    description = entry.get("description") or ""
    title = entry.get("title") or ""

    # 1. Duration filter & score (0-15 pts)
    is_short = duration > 0 and duration < 180
    breakdown["is_short"] = is_short
    if is_short and not include_shorts:
        breakdown["duration_status"] = "Short (Filtered)"
        return -1.0, breakdown

    if duration >= min_sec and duration <= max_sec:
        dur_pts = 15.0
    elif duration > max_sec:
        # Graceful decay for very long videos
        dur_pts = max(5.0, 15.0 - ((duration - max_sec) / 600.0))
    elif is_short and include_shorts:
        dur_pts = 10.0
    else:
        dur_pts = 5.0
    score += dur_pts
    breakdown["duration_pts"] = dur_pts

    # 2. Creator Trust Score (0-35 pts)
    uploader_clean = uploader.lower().strip()
    uploader_id_clean = uploader_id.lower().lstrip("@").strip()
    matched_dossier = None
    for key, d in dossiers.items():
        if key in uploader_clean or key in uploader_id_clean or d["slug"] in uploader_id_clean:
            matched_dossier = d
            break

    if matched_dossier:
        trust = matched_dossier["trust_score"]
        creator_pts = (trust / 100.0) * 35.0
        breakdown["creator_match"] = f"{matched_dossier['name']} (Trust: {trust}/100)"
    elif entry.get("channel_is_verified"):
        creator_pts = 22.0
        breakdown["creator_match"] = "Verified Creator"
    else:
        creator_pts = 14.0
        breakdown["creator_match"] = "Unindexed Creator"
    score += creator_pts
    breakdown["creator_pts"] = creator_pts

    # 3. View / Engagement Velocity (0-30 pts)
    if views >= 500000:
        view_pts = 20.0
    elif views >= 100000:
        view_pts = 17.0
    elif views >= 20000:
        view_pts = 14.0
    elif views >= 5000:
        view_pts = 10.0
    else:
        view_pts = 5.0
    score += view_pts
    breakdown["view_pts"] = view_pts

    # 4. Description & Resource Density (0-20 pts)
    desc_pts = 0.0
    desc_lower = description.lower()
    if "github.com" in desc_lower or "gitlab.com" in desc_lower:
        desc_pts += 7.0
    if "http://" in desc_lower or "https://" in desc_lower:
        desc_pts += 4.0
    if re.search(r"\b\d{1,2}:\d{2}\b", description):  # Has timestamps / chapters in description
        desc_pts += 6.0
    if len(description) > 150:
        desc_pts += 3.0
    score += min(20.0, desc_pts)
    breakdown["resource_pts"] = min(20.0, desc_pts)

    # 5. Deduplication status
    if v_id in existing_analyses:
        breakdown["already_analyzed"] = existing_analyses[v_id]["path"]
    else:
        breakdown["already_analyzed"] = None

    return round(score, 1), breakdown


def parse_vtt_lines(vtt_path: Path) -> list[dict]:
    """Extracts timestamped text lines from WebVTT subtitle files."""
    if not vtt_path.exists():
        return []
    text = vtt_path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    segments = []
    current_start = 0.0
    time_re = re.compile(r"(\d{2}):(\d{2}):(\d{2})\.(\d{3}) -->")
    time_short_re = re.compile(r"(\d{2}):(\d{2})\.(\d{3}) -->")

    for line in lines:
        line_s = line.strip()
        m = time_re.search(line_s)
        if m:
            h, mi, s, ms = map(int, m.groups())
            current_start = h * 3600 + mi * 60 + s + ms / 1000.0
            continue
        m2 = time_short_re.search(line_s)
        if m2:
            mi, s, ms = map(int, m2.groups())
            current_start = mi * 60 + s + ms / 1000.0
            continue
        if (
            line_s
            and not line_s.startswith("WEBVTT")
            and not line_s.startswith("NOTE")
            and not line_s.startswith("Kind:")
            and not line_s.startswith("Language:")
            and "-->" not in line_s
        ):
            # Clean HTML tags and inline styles
            cleaned = re.sub(r"<[^>]+>", "", line_s).strip()
            # Deduplicate consecutive repeated words from auto-subs
            cleaned = re.sub(r"\b(\w+)(?:\s+\1\b)+", r"\1", cleaned, flags=re.IGNORECASE)
            if cleaned and not cleaned.lower().startswith("kind:") and not cleaned.lower().startswith("language:"):
                segments.append({"start": current_start, "text": cleaned})
    return segments


def fetch_transcript_skim(video_id: str, work_dir: Path) -> dict:
    """Fetches subtitles, runs SponsorBlock, and produces a 150-word outline."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    sub_dir = work_dir / f"sub_{video_id}"
    sub_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        "yt-dlp",
        url,
        "--skip-download",
        "--write-auto-sub",
        "--write-sub",
        "--sub-lang", "en",
        "--sub-format", "vtt",
        "-o", str(sub_dir / "%(id)s.%(ext)s"),
        "--no-warnings",
        "--quiet",
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=15)
        vtt_files = list(sub_dir.glob("*.vtt"))
        if not vtt_files:
            return {"outline": None, "hook": None, "chapters": []}

        segments = parse_vtt_lines(vtt_files[0])
        if not segments:
            return {"outline": None, "hook": None, "chapters": []}

        # SponsorBlock pruning if available
        if fetch_skip_segments and prune_transcript:
            skip_segs = fetch_skip_segments(video_id)
            if skip_segs:
                segments, _ = prune_transcript(segments, skip_segs)

        # 1. Extract opening hook (0s to 75s)
        hook_lines = [s["text"] for s in segments if s["start"] <= 75.0]
        hook_text = " ".join(hook_lines[:8])

        # 2. Extract segment markers every 3-5 mins
        max_time = segments[-1]["start"] if segments else 0.0
        interval = max(180.0, max_time / 5.0)
        outline_markers = []
        last_t = -interval

        for s in segments:
            if s["start"] - last_t >= interval:
                outline_markers.append(f"[{format_duration(s['start'])}] {s['text'][:80]}...")
                last_t = s["start"]
                if len(outline_markers) >= 5:
                    break

        return {
            "hook": hook_text[:280] + ("..." if len(hook_text) > 280 else ""),
            "outline": outline_markers,
        }
    except Exception:
        return {"outline": None, "hook": None, "chapters": []}


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="search",
        description="YouTube Search & Quality Curation Engine for Leonidas AIOS.",
    )
    ap.add_argument("query", help="Search query string")
    ap.add_argument("--channel", type=str, default=None, help="Channel handle (e.g. @nateherk) or URL")
    ap.add_argument("--trusted-only", action="store_true", help="Search only across indexed creator dossiers")
    ap.add_argument("--limit", type=int, default=30, help="Initial candidate batch limit (default: 30)")
    ap.add_argument("--top", type=int, default=3, help="Top curated results to return (default: 3)")
    ap.add_argument("--include-shorts", action="store_true", help="Include shorts (<3 mins)")
    ap.add_argument("--min-duration", type=int, default=180, help="Min duration in seconds (default: 180)")
    ap.add_argument("--max-duration", type=int, default=2400, help="Max duration in seconds (default: 2400)")
    ap.add_argument("--detail", choices=["brief", "skim"], default="skim", help="Detail preset (default: skim)")
    ap.add_argument("--json", action="store_true", help="Output raw JSON")
    args = ap.parse_args()

    workspace_root = Path.cwd()
    dossiers = load_creator_dossiers(workspace_root)
    existing = load_existing_analyses(workspace_root)

    # Trusted-only mode query resolution
    if args.trusted_only:
        entries = []
        slugs = sorted(list(set(d["slug"] for d in dossiers.values())))
        for s in slugs[:5]:  # Query top 5 dossiers
            res = run_ytdlp_search(args.query, channel=f"@{s}", limit=5)
            entries.extend(res)
    else:
        entries = run_ytdlp_search(args.query, channel=args.channel, limit=args.limit)

    if not entries:
        if args.json:
            print(json.dumps({"results": [], "shorts_count": 0}))
        else:
            print(f"> [!WARNING]\n> No YouTube results found matching query: **{args.query}**.")
        return 0

    scored_candidates = []
    shorts_detected = []

    for e in entries:
        score, breakdown = calculate_quality_score(
            e,
            dossiers,
            existing,
            min_sec=args.min_duration,
            max_sec=args.max_duration,
            include_shorts=args.include_shorts,
        )
        if breakdown.get("is_short") and not args.include_shorts:
            shorts_detected.append(e)
            continue
        if score > 0:
            scored_candidates.append((score, e, breakdown))

    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    top_candidates = scored_candidates[: args.top]

    # Run zero-token transcript skimming for top candidates if detail=skim
    work_dir = Path(tempfile.mkdtemp(prefix="aios-yt-search-"))
    results = []

    for score, entry, breakdown in top_candidates:
        v_id = entry.get("id") or ""
        skim_data = {}
        if args.detail == "skim" and v_id:
            skim_data = fetch_transcript_skim(v_id, work_dir)

        results.append({
            "id": v_id,
            "url": f"https://youtu.be/{v_id}",
            "title": entry.get("title") or "Untitled",
            "uploader": entry.get("uploader") or entry.get("channel") or "Unknown",
            "duration_formatted": format_duration(entry.get("duration")),
            "duration_seconds": entry.get("duration") or 0,
            "views": entry.get("view_count") or 0,
            "quality_score": score,
            "breakdown": breakdown,
            "skim": skim_data,
        })

    # Cleanup temp dir
    try:
        shutil.rmtree(work_dir, ignore_errors=True)
    except Exception:
        pass

    if args.json:
        print(json.dumps({"results": results, "shorts_count": len(shorts_detected)}, indent=2))
        return 0

    # Markdown Report
    print(f"# YouTube Search & Quality Curation : `{args.query}`")
    print()
    print(f"- **Total Candidates Scanned:** {len(entries)} (Filtered pool: {len(scored_candidates)})")
    if args.channel:
        print(f"- **Channel Scope:** `{args.channel}`")
    print(f"- **Top Curated Recommendations:** {len(results)}")
    print()

    for idx, r in enumerate(results, 1):
        analyzed_badge = " *(Already Logged in AIOS)*" if r["breakdown"].get("already_analyzed") else ""
        print(f"### {idx}. [{r['title']}]({r['url']}){analyzed_badge}")
        print(f"- **Creator:** {r['uploader']} · **Duration:** {r['duration_formatted']} · **Views:** {r['views']:,}")
        print(f"- **Quality Score:** `{r['quality_score']} / 100` ({r['breakdown']['creator_match']} · Score Breakdown: Duration +{r['breakdown']['duration_pts']} | Creator +{r['breakdown']['creator_pts']} | Views +{r['breakdown']['view_pts']} | Resources +{r['breakdown']['resource_pts']})")

        if r["breakdown"].get("already_analyzed"):
            print(f"- 📁 **Local AIOS Record:** `{r['breakdown']['already_analyzed']}`")

        if r["skim"].get("hook"):
            print(f"- ⚡ **Thesis Hook:** \"{r['skim']['hook']}\"")

        if r["skim"].get("outline"):
            print("- 📌 **Key Segment Markers:**")
            for marker in r["skim"]["outline"]:
                print(f"  - {marker}")
        print()

    if shorts_detected and not args.include_shorts:
        print("> [!NOTE]")
        print(f"> **Shorts Detected:** Found **{len(shorts_detected)}** relevant YouTube Shorts on this topic.")
        print("> Would you like to view top Shorts? (Run with `--include-shorts` or ask Leonidas).")
        print()

    print("---")
    print("💡 **Handoff:** Say `Analyze #1` (or paste any URL) to execute deep multimodal analysis and write notes to `raw/youtube/`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
