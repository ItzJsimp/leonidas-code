---
name: zotero-research
description: "Inspect local Zotero reference libraries read-only via local HTTP connector (127.0.0.1:23119) or local SQLite database to ground research in the user's collected academic papers."
category: research
scope: structural
distribution: core
type: skill
id: skill-zotero-research
title: "Zotero Research (Read-Only Reference Bridge)"
kind: procedure
load: on-demand
owner: shared
verified: 2026-09-29
generated: false
disable-model-invocation: true
license: MIT
---

# Zotero Research: Local Reference Bridge

Deterministic read-only bridge connecting Hermes and AIOS agents to a local Zotero library and bibliography.

## Purpose

Enables research agents to check whether the user already has relevant academic literature, PDFs, or annotations filed locally before conducting redundant web searches.

## Safety & Governance

- **Read-Only Invariant:** Never create, edit, re-tag, or delete items in Zotero.
- **Deterministic Tooling:** Always execute queries via the deterministic script wrapper (`scripts/zotero_query.py`), which isolates queries and prevents database locks.

## How to Execute

### Quick Query

```bash
python ".agents/skills/zotero-research/scripts/zotero_query.py" "memory poisoning" --limit 5
```

### JSON Mode (for agent ingestion)

```bash
python ".agents/skills/zotero-research/scripts/zotero_query.py" "multi-agent workflows" --limit 10 --json
```

## Setup & Configuration

1. **Enable Local HTTP Connector:**
   - In Zotero Desktop: `Settings` -> `Advanced` -> Check `Allow other applications on this computer to communicate with Zotero`.
   - Default local API runs at `http://127.0.0.1:23119/`.
2. **Offline / Background Mode:**
   - If Zotero is closed, the script automatically falls back to inspecting the local read-only database at `~/Zotero/zotero.sqlite`.
3. **If Zotero is Not Installed:**
   - The script reports a clean diagnostic message and advises the agent to continue via open academic discovery tools (Semantic Scholar, arXiv) and the Obsidian LLM Wiki.
