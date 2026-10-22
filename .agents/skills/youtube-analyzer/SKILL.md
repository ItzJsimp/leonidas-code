---
name: youtube-analyzer
description: "Analyze a YouTube video or channel: transcript, creator formula and timestamped notes. Use when the user shares a YouTube link or asks what a video or creator does."
category: research
scope: structural
distribution: template
type: skill
id: skill-youtube-analyzer
title: "YouTube Analyzer : Multimodal Video Intelligence"
kind: procedure
load: on-demand
owner: shared
verified: 2026-08-24
related: ["skills-index", "mode-02", "master-instructions", "context-budget"]
generated: false
license: MIT
---

**Last updated:** 2026-08-24

# YouTube analyzer

Turn a video into the handful of things you did not already know, each anchored to the second it occurs, each routed to exactly one home.

**Two hard rules.** Everything else is guidance.

1. **No claim without evidence.** Every extracted point cites a transcript quote or a frame timestamp. An extraction with neither is dropped, not softened.
2. **Propose, never apply.** Routed items are recommendations through their governing gate. Nothing writes to canon without approval.

Two references, one level deep:

- Input is a **channel** rather than a single video -> [`references/creator-formula.md`](./references/creator-formula.md)
- Writing the record and directory layout -> [`references/storage.md`](./references/storage.md)

## Route first

| Input                                                                                | Path                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `watch?v=` · `youtu.be/` · `/shorts/`                                                | **Video path**: the pipeline below                                                                   |
| `/@handle` · `/channel/` · `/c/` · `/user/`, or a named creator with research intent | **Creator path**: see `creator-formula.md`                                                           |
| A local file (`.mp4`, `.mkv`, `.mov`, `.webm`)                                       | **Video path**, skipping the download                                                                |
| Both, or ambiguous                                                                   | Ask once: _"Analyse the video, work out the creator's formula, or both?"_ Creator first, then video. |

## Step 1 : Fetch, prune & visual gate

Never ask the user to paste a transcript. Fetch it.

Run the self-contained engine script from the skill scripts directory:

```bash
python ".agents/skills/youtube-analyzer/scripts/watch.py" "<source>" --detail transcript
```

The script automatically:

1. **Duplicate Safety Check:** Extracts the canonical 11-character video ID from any URL format. If already analyzed, halts immediately with a warning (`--force` overrides).
2. Downloads metadata, analytics (views, likes, engagement), description links, and VTT subtitles via `yt-dlp`.
3. Queries the **SponsorBlock API** (`https://sponsor.ajay.app`) to auto-prune sponsor segments, self-promos, and fluff.
4. Scans for **visual indicator cues** (e.g. _"on my screen"_, _"look at this command"_, _"in this UI"_).

**Interactive Visual Gate:**

- **No visual cues detected (~80-90% of videos):** Proceed immediately with `detail: transcript` (0 image tokens).
- **Visual cues detected:** Output a 1-line prompt noting timestamps with visual indicators. If visual extraction is requested, re-run with:
  ```bash
  python ".agents/skills/youtube-analyzer/scripts/watch.py" "<source>" --detail efficient --ocr
  ```

## Step 2 : Context-aware delta pass

Run this _before_ writing any summary, so the summary is already filtered.

### Multi-Tenancy & User Detection

1. Check the active repository:
   - **Leonidas AIOS (`<repo root>`):** Query personal [`memory/`](../../../memory/memory-index.md), [`wiki/`](../../../wiki/wiki-index.md), and active projects in [`BUILD-PLAN.md`](../../../BUILD-PLAN.md).
   - **the peer AIOS (`the peer AIOS`):** Query the peer AIOS business context, Modes, active client pipelines, and business memory.
2. Check `$env:USERNAME`:
   - If user is **the user** running inside `the peer AIOS` and the video contains personal infrastructure or PC/AIOS concepts, surface an interactive bridge prompt:
     _"This video covers personal AIOS / system architecture. Would you like to also log this to Leonidas AIOS?"_
   - If user is **a collaborator**: Keep operations 100% contained within the peer AIOS.

3. Classify every substantive point against the resolved context:
   - 🆕 **New**: Nothing in memory/ or wiki/ covers this.
   - ⚔️ **Contradicts**: Recorded position exists and the video disagrees (name the file it contradicts and both claims).
   - ✅ **Confirms**: Already known (report count only).
   - 📎 **Extends**: Known idea, new depth (state only the delta).

## Step 3 : The analysis blocks

Write the document into `raw/youtube/<creator-slug>/<video-slug>/analysis.md` per [`references/storage.md`](references/storage.md) and [`templates/youtube-analysis.md`](../../../templates/youtube-analysis.md):

1. **Watch-Worthiness Score (1-10):** Grade whether the user needs to visually watch the video or if the document captures 100% of the value. Include concise rationale.
2. **⚡ Executive Brief**: Core thesis + Mermaid architecture diagram.
3. **🎯 Key Moments Worth Watching**: 2-4 curated timestamps formatted as clickable direct jump links `[MM:SS](https://youtu.be/<id>?t=<sec>)`.
4. **🛠️ Technical Architecture Breakdown**: Deep, modular breakdown of tech stack, components, and code mechanisms.
5. **🌶️ High-Value Insights & "The Sauce"**: Timestamped, non-obvious engineering tactics with clickable links.
6. **🖼️ Extracted Prompts & Code Snippets**: Copy-pasteable prompts, CLI commands, and scripts.
7. **🔗 Extracted Description Links & Resources**: Direct hyperlinks to GitHub repos, blogs, tools.
8. **💼 the peer AIOS Commercial Application**: Monetizable client offerings, services, or internal automations.
9. **🔀 AIOS Delta & Actionability Routing**: Classification table + Markdown Git diff blocks for any canon updates.
10. **🚀 3-Step Implementation Plan**: Concrete, high-leverage next moves to replicate or build.

## Step 4 : Store, verify, deliver

Write both files into the dedicated per-video subfolder:

- `raw/youtube/<creator-slug>/<video-slug>/analysis.md`
- `raw/youtube/<creator-slug>/<video-slug>/transcript.txt` (Full verbatim timestamped transcript)

Update `raw/youtube/youtube-index.md`.

**Chat handoff:**

- Clickable link to `analysis.md`.
- Watch-Worthiness score and recommendation in 1 line.
- Delta count in the form _"3 new, 1 extension, 5 already known"_.
- The single most important takeaway in one sentence.
- If a **Canon Patch** was generated, prompt: _"1 patch ready for `memory/tools.md`. Would you like me to apply it now?"_
