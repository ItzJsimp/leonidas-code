---
name: "defuddle"
description: "Fetch a web page as clean Markdown without menus, ads or banners. Use when the user gives a URL to read, summarize or cite, before a plain page fetch."
category: "efficiency"
scope: "structural"
distribution: core
type: "skill"
id: "skill-defuddle"
title: "Defuddle"
kind: "procedure"
load: "on-demand"
owner: "shared"
verified: 2026-10-04
source: "https://github.com/kepano/obsidian-skills (skills/defuddle, MIT, commit 3ccff53)"
license: MIT
---

# Defuddle

Use Defuddle CLI to extract clean readable content from web pages. Prefer over WebFetch for standard web pages: it removes navigation, ads, and clutter, reducing token usage.

If not installed: `npm install -g defuddle`

## Usage

Always use `--md` for markdown output:

```bash
defuddle parse <url> --md
```

Save to file:

```bash
defuddle parse <url> --md -o content.md
```

Extract specific metadata:

```bash
defuddle parse <url> -p title
defuddle parse <url> -p description
defuddle parse <url> -p domain
```

## Output formats

| Flag        | Format                           |
| ----------- | -------------------------------- |
| `--md`      | Markdown (default choice)        |
| `--json`    | JSON with both HTML and markdown |
| (none)      | HTML                             |
| `-p <name>` | Specific metadata property       |

Credit: adapted from [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) (MIT). See [LICENSE](LICENSE).
