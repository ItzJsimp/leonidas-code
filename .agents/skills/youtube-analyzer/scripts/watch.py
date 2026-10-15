#!/usr/bin/env python3
"""Unified watch entrypoint for Leonidas AIOS & SimplyGersi AIOS.

Extracts transcript, applies SponsorBlock pruning, captures video analytics,
detects visual indicator cues, extracts keyframes/scene frames on demand,
and supports local zero-token OCR.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR))

from config import frame_cap
from download import download, fetch_captions, is_url
from frames import auto_fps, auto_fps_focus, extract_at_timestamps, extract_keyframes, extract_scene_or_uniform, format_time, get_metadata, merge_frames, parse_time, parse_timestamps
from ocr import is_ocr_available, run_local_ocr
from sponsorblock import extract_video_id, fetch_skip_segments, prune_transcript
from transcribe import detect_visual_cues, filter_range, format_transcript, parse_vtt


def find_existing_analysis(video_id: str, workspace_root: Path) -> dict | None:
    youtube_dir = workspace_root / "raw/youtube"
    if not youtube_dir.exists():
        return None
    for md_file in youtube_dir.glob("**/*.md"):
        if md_file.name == "index.md":
            continue
        try:
            content = md_file.read_text(encoding="utf-8", errors="ignore")
            if (f"id: {video_id}" in content or 
                f'id: "{video_id}"' in content or 
                f"id: '{video_id}'" in content or
                f"watch?v={video_id}" in content or
                f"youtu.be/{video_id}" in content):
                title_match = re.search(r'title:\s*["\']?(.*?)["\']?\n', content)
                date_match = re.search(r'date:\s*["\']?(.*?)["\']?\n', content)
                return {
                    "path": str(md_file),
                    "title": title_match.group(1) if title_match else md_file.stem,
                    "date": date_match.group(1) if date_match else "Unknown",
                }
        except Exception:
            continue
    return None


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="watch",
        description="YouTube & Video Intelligence Engine with Analytics, SponsorBlock, Visual Cues, and Local OCR.",
    )
    ap.add_argument("source", help="Video URL or local file path")
    ap.add_argument(
        "--detail",
        choices=["transcript", "efficient", "balanced", "token-burner"],
        default="transcript",
        help="Detail preset (default: transcript for 0 image tokens).",
    )
    ap.add_argument("--max-frames", type=int, default=None, help="Override frame cap")
    ap.add_argument("--resolution", type=int, default=512, help="Frame width in pixels (default: 512)")
    ap.add_argument("--timestamps", type=str, default=None, help="Comma-separated timestamps for cue frames (MM:SS)")
    ap.add_argument("--start", type=str, default=None, help="Range start (MM:SS)")
    ap.add_argument("--end", type=str, default=None, help="Range end (MM:SS)")
    ap.add_argument("--no-sponsorblock", action="store_true", help="Disable SponsorBlock auto-pruning")
    ap.add_argument("--ocr", action="store_true", help="Run local OCR on extracted cue frames (0 LLM image tokens)")
    ap.add_argument("--force", action="store_true", help="Force re-analysis even if video was previously analyzed")
    ap.add_argument("--out-dir", type=str, default=None, help="Working directory")
    args = ap.parse_args()

    url_source = is_url(args.source)
    video_id = extract_video_id(args.source) if url_source else None

    # Safety Check: Duplicate Video Detection
    if video_id and not args.force:
        workspace_root = Path.cwd()
        existing = find_existing_analysis(video_id, workspace_root)
        if existing:
            print()
            print(f"> [!WARNING]")
            print(f"> **Duplicate Video Detected:** This video was already analyzed on **{existing['date']}**.")
            print(f"> **Title:** {existing['title']}")
            print(f"> **Existing Record:** `{existing['path']}`")
            print(">")
            print("> Re-running will overwrite or re-process this video. If you wish to re-analyze with a different detail preset, re-run with `--force`.")
            print()
            return 0

    detail = args.detail
    max_frames = args.max_frames or frame_cap(detail)
    cue_timestamps = parse_timestamps(args.timestamps)

    if args.out_dir:
        work = Path(args.out_dir).expanduser().resolve()
    else:
        work = Path(tempfile.mkdtemp(prefix="aios-watch-"))
    work.mkdir(parents=True, exist_ok=True)
    print(f"[watch] working dir: {work}", file=sys.stderr)

    dl = {"subtitle_path": None, "info": {}, "downloaded": False}
    transcript_segments: list[dict] = []
    video_path: str | None = None

    if url_source:
        print("[watch] fetching captions & metadata via yt-dlp...", file=sys.stderr)
        dl = fetch_captions(args.source, work / "download")
        if dl.get("subtitle_path"):
            transcript_segments = parse_vtt(dl["subtitle_path"])

    # SponsorBlock Pruning
    skip_segments = []
    dropped_sponsor_count = 0
    if url_source and not args.no_sponsorblock:
        v_id = video_id or dl.get("info", {}).get("id")
        if v_id:
            print("[watch] querying SponsorBlock API...", file=sys.stderr)
            skip_segments = fetch_skip_segments(v_id)
            if skip_segments:
                transcript_segments, dropped_sponsor_count = prune_transcript(transcript_segments, skip_segments)
                print(f"[watch] SponsorBlock: pruned {dropped_sponsor_count} sponsor/fluff lines across {len(skip_segments)} segment(s)", file=sys.stderr)

    # Detect visual indicator cues in transcript
    visual_cues = detect_visual_cues(transcript_segments)

    # Only download video stream if frames or OCR requested
    need_video = detail != "transcript" or bool(cue_timestamps) or (args.ocr and bool(visual_cues))
    if need_video:
        if url_source:
            print("[watch] downloading video stream for frame/OCR processing...", file=sys.stderr)
            dl = download(args.source, work / "download", audio_only=False)
        else:
            dl = download(args.source, work / "download")
        video_path = dl["video_path"]

    meta = get_metadata(video_path) if video_path else {
        "duration_seconds": float((dl.get("info") or {}).get("duration") or 0),
        "width": None, "height": None, "codec": None, "has_audio": False,
    }
    full_duration = meta["duration_seconds"]

    start_sec = parse_time(args.start)
    end_sec = parse_time(args.end)
    effective_start = start_sec if start_sec is not None else 0.0
    effective_end = end_sec if end_sec is not None else full_duration
    effective_duration = max(0.0, effective_end - effective_start)
    focused = start_sec is not None or end_sec is not None

    if transcript_segments and focused:
        transcript_segments = filter_range(transcript_segments, start_sec, end_sec)

    frames: list[dict] = []
    cue_frames: list[dict] = []

    # Extract cue frames
    if cue_timestamps and video_path:
        cue_frames, _ = extract_at_timestamps(
            video_path, work / "frames", cue_timestamps,
            resolution=args.resolution, max_frames=max_frames,
            start_seconds=start_sec, end_seconds=end_sec,
        )

    # Extract detail frames if requested
    if detail != "transcript" and video_path:
        if detail == "efficient":
            frames, _ = extract_keyframes(
                video_path, work / "frames",
                resolution=args.resolution, max_frames=max_frames,
                start_seconds=start_sec, end_seconds=end_sec,
            )
        else:
            fps, target = auto_fps(effective_duration, max_frames=max_frames or 100)
            frames, _ = extract_scene_or_uniform(
                video_path, work / "frames", fps=fps, target_frames=target,
                resolution=args.resolution, max_frames=max_frames,
                start_seconds=start_sec, end_seconds=end_sec,
            )

    if cue_frames:
        frames = merge_frames(frames, cue_frames)

    # Run Local OCR if requested
    ocr_results = []
    if args.ocr and frames:
        print("[watch] running local OCR on extracted frames (0 LLM image tokens)...", file=sys.stderr)
        ocr_results = run_local_ocr([f["path"] for f in frames])

    info = dl.get("info") or {}
    transcript_text = format_transcript(transcript_segments)

    print()
    print("# watch: video intelligence report")
    print()
    print(f"- **Source:** {args.source}")
    if info.get("title"):
        print(f"- **Title:** {info['title']}")
    if info.get("uploader"):
        print(f"- **Uploader:** {info['uploader']}")
    if info.get("upload_date"):
        print(f"- **Upload Date:** {info['upload_date']}")
    print(f"- **Duration:** {format_time(full_duration)} ({full_duration:.1f}s)")
    if info.get("view_count"):
        print(f"- **Analytics:** {info['view_count']:,} views · {info.get('like_count', 0):,} likes · {info.get('comment_count', 0):,} comments (Engagement: {info.get('engagement_rate', 0)}%)")
    print(f"- **Detail Preset:** {detail}")
    if skip_segments:
        print(f"- **SponsorBlock:** {len(skip_segments)} segment(s) pruned ({dropped_sponsor_count} lines removed)")
    print(f"- **Visual Cues Detected:** {len(visual_cues)} moments in transcript")
    print(f"- **Frames Extracted:** {len(frames)}")
    if ocr_results:
        print(f"- **Local OCR Extracted:** {len(ocr_results)} frame(s) with readable on-screen text/code")

    if info.get("extracted_links"):
        print()
        print("## Extracted Description Links & Resources")
        print()
        for link in info["extracted_links"]:
            print(f"- {link}")

    if visual_cues and detail == "transcript":
        print()
        print("> [!NOTE]")
        print(f"> **Visual Cues Found:** {len(visual_cues)} moments reference on-screen UI, diagrams, or code.")
        print("> Sample timestamps:", ", ".join(f"`t={format_time(c['timestamp'])}`" for c in visual_cues[:5]))

    if ocr_results:
        print()
        print("## Local OCR Text / Code Snippets (0 LLM Image Tokens)")
        print()
        for item in ocr_results:
            print(f"**Frame:** `{Path(item['path']).name}`")
            print("```text")
            print(item["text"])
            print("```")
            print()

    if frames:
        print()
        print("## Frames")
        print()
        for f in frames:
            print(f"- `{f['path']}` (t={format_time(f['timestamp_seconds'])})")

    print()
    print("## Transcript")
    print()
    if transcript_text:
        print("```")
        print(transcript_text)
        print("```")
    else:
        print("_No transcript available._")

    print()
    print("---")
    print(f"_Work dir: `{work}`_")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
