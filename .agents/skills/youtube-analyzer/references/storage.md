# Local Storage Standard & Output Template

Read when generating the analysis or creator profile for local AIOS storage.

## Targets

All YouTube knowledge lives locally in `raw/youtube/` using dedicated per-video subfolders:

- **Video Analysis:** `raw/youtube/<creator-slug>/<video-slug>/analysis.md`
- **Raw Transcript:** `raw/youtube/<creator-slug>/<video-slug>/transcript.txt`
- **Creator Dossiers:** `raw/youtube/creators/<creator-slug>.md`
- **Master Index:** `raw/youtube/youtube-index.md`

## Video Analysis Schema (YAML Frontmatter in `analysis.md`)

```yaml
---
title: "<exact verbatim YouTube title>"
url: https://www.youtube.com/watch?v=<video-id>
creator: "<Creator Name>"
upload_date: YYYY-MM-DD
processed_date: YYYY-MM-DD
duration: "MM:SS"
views: 18871
likes: 823
comments_count: 104
engagement_rate: "4.91%"
subscribers: 22400
topics: [<Topic1>, <Topic2>, <Topic3>]
detail_preset: "transcript" # transcript | efficient | balanced | token-burner
sponsorblock_pruned: true
visual_cues_found: 12
watch_worthiness_score: 7 # 1-10 visual necessity rating
watch_rationale: "<1-2 sentences on why the video is or is not worth watching visually>"
title_history: []
top_takeaway: "<One sentence: the single most valuable thing learned>"
---
```

## Clickable Timestamp Linking Standard

Always format every timestamp in `analysis.md` as an exact clickable YouTube jump link using seconds:

- Format: `[MM:SS](https://youtu.be/<video-id>?t=<seconds>)`
- Example: `[04:30](https://youtu.be/IMQw3aHjf2Q?t=270)` (Calculated as `4 * 60 + 30 = 270s`).

## `analysis.md` Document Structure (Governed by [`templates/youtube-analysis.md`](../../../../templates/youtube-analysis.md))

Use clean GitHub Flavored Markdown with standard headings:

```markdown
# <exact verbatim YouTube title>

> **Source:** [<url>](url) · **Creator:** [<Creator Name>](../../creators/<creator-slug>.md) · **Date:** YYYY-MM-DD · **Transcript:** [`transcript.txt`](./transcript.txt)
```

Signal Score: 94% fluff pruned · 15m 29s (2,240 words) condensed into 450 high-density words (5.0x density multiplier) · 0 image tokens burned
Watch-Worthiness: 7/10 (Recommended for UI Demo) · The architecture is fully documented in analysis.md, but the retro 80s tape recorder UI demo at [13:26](https://youtu.be/IMQw3aHjf2Q?t=806) is worth 60 seconds of visual viewing.

```

## ⚡ Executive Brief
2-3 sentence distillation of the video's core thesis + Mermaid architecture diagram.

## 🎯 Key Moments Worth Watching (Clickable Jump Links)
Shortlist of 2-4 exact moments worth seeing visually with clickable timestamps.

## 🛠️ Technical Architecture Breakdown
Comprehensive numbered breakdown of components, frameworks, and mechanisms.

## 🌶️ High-Value Insights & "The Sauce"
Timestamped non-obvious engineering tactics and rare configurations with clickable timestamps.

## 🖼️ Extracted Prompts & Code Snippets
Copy-pasteable prompts, CLI commands, and scripts.

## 🔗 Extracted Description Links & Resources
Direct links to GitHub repositories, blog posts, and documentation.

## 💼 the peer AIOS Commercial Application
Specific service offerings, client deliverables, and agency automations to productize.

## 🔀 AIOS Delta & Actionability Routing
Classification table + Markdown Git diff blocks for any canon updates.

## 🚀 3-Step Implementation Plan
Concrete, high-leverage next moves to replicate or build.
```
