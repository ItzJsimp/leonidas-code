---
name: youtube-search
description: "Find, score and curate good YouTube tutorials and creators for a topic. Use when asked what to watch, which creators teach a subject, or to find videos on a topic."
category: research
type: skill
id: skill-youtube-search
title: "YouTube Search : Discovery & Quality Curation"
kind: procedure
load: on-demand
owner: shared
scope: structural
distribution: template
verified: 2026-08-30
related: ["youtube-analyzer", "skills-index", "master-instructions", "context-budget"]
generated: false
license: MIT
---

# YouTube Search & Quality Curation

Zero-token local video search and discovery engine powered by `yt-dlp`. Scours YouTube, filters out slop, scores video quality deterministically against local creator dossiers, extracts SponsorBlock-pruned transcript outlines, and hands off winning videos to [`youtube-analyzer`](../youtube-analyzer/SKILL.md).

## When to Use This Skill

Activate this skill when:

- the user asks to find, search for, or recommend YouTube videos on any topic or learning goal.
- the user asks what creators or YouTubers to watch for a specific skill, concept, or tool.
- the user asks if a specific creator (e.g. Nate Herk, Cole Medin, Greg Isenberg) has uploaded videos about a topic.
- A workflow or learning goal requires educational video discovery before deep study.

Do **NOT** use this skill when you already have a specific video URL or local video file: route directly to [`youtube-analyzer`](../youtube-analyzer/SKILL.md) instead.

---

## Execution: Fast Discovery Pipeline

Run the self-contained search engine from the repository root:

```bash
python ".agents/skills/youtube-search/scripts/search.py" "<query>" [options]
```

### Common Search Modes

| Intent                                 | Command                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Broad Discovery** (Default)          | `python ".agents/skills/youtube-search/scripts/search.py" "<topic>" --top 3`               |
| **Creator-Scoped Search**              | `python ".agents/skills/youtube-search/scripts/search.py" "<topic>" --channel "@nateherk"` |
| **Trusted Ecosystem Search**           | `python ".agents/skills/youtube-search/scripts/search.py" "<topic>" --trusted-only`        |
| **Include Shorts**                     | `python ".agents/skills/youtube-search/scripts/search.py" "<topic>" --include-shorts`      |
| **Quick Metadata Only** (No Subtitles) | `python ".agents/skills/youtube-search/scripts/search.py" "<topic>" --detail brief`        |

---

## The 3-Tier Quality Funnel

1. **Local Pre-Filtering (0 LLM Tokens):**
   - Fetches candidate pool (30-50 videos) via `yt-dlp` Innertube JSON search.
   - Evaluates Duration (3-30 mins default), View Velocity, and Resource Density (GitHub links, docs, timestamps).
   - Multiplies score for channels indexed in [`raw/youtube/creators/`](../../../raw/youtube/creators/).
   - Checks [`raw/youtube/`](../../../raw/youtube/) to flag previously analyzed videos.

2. **Transcript Skimming (~200 LLM Tokens per video):**
   - Downloads subtitle stream locally via `yt-dlp`.
   - Prunes sponsor segments and fluff via the SponsorBlock API.
   - Extracts the 60-90s thesis hook and key chapter transition points.

3. **Curation & Companion Handoff:**
   - Presents top 2-3 scored recommendations with clickable jump links.
   - If high-signal Shorts are detected, displays a 1-line interactive notice.
   - Prompts for deep analysis: _"Say 'Analyze #1' to run the full [`youtube-analyzer`](../youtube-analyzer/SKILL.md) pipeline."_

---

## Output Contract

Every search briefing delivered to the user must contain:

1. **Curated Recommendations:** Numbered list with Title (clickable link), Creator, Duration, Views, and Quality Score (`XX/100`).
2. **Thesis Hook:** 1-2 sentence verbatim thesis from the video opening.
3. **Key Segment Markers:** 3-5 timestamped chapter markers `[MM:SS]`.
4. **Local AIOS Status:** Explicit note if the video is already analyzed in `raw/youtube/`.
5. **Interactive Shorts Note:** If relevant Shorts were found and not requested, offer to show them.
6. **Handoff Action:** 1-line prompt explaining how to trigger deep multimodal analysis.
