---
name: deep-research
description: "Run a free, source-ledgered research pass over arXiv, Crossref, Semantic Scholar and the web with citations. Use for academic or literature questions that need many sources."
category: research
scope: structural
distribution: core
type: skill
id: skill-deep-research
title: "Zero-Cost Deep Research Workflow"
kind: procedure
load: on-demand
owner: shared
verified: 2026-09-29
generated: false
license: MIT
---

# Deep Research: Zero-Cost Discovery & Synthesis Workflow

Standardized procedure for running deep academic and web investigations at zero marginal cost (\$0.00) while maintaining rigorous evidence density and citation grounding.

## Architecture & Cost Profile

| Layer                  | Component                      | Cost   | Details                                                                                                                                                           |
| ---------------------- | ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LLM Inference**      | Free OpenRouter / Local Ollama | \$0.00 | OpenRouter free models (`z-ai/glm-5.3-flash`, `qwen/qwen-2.5-72b-instruct:free`, `meta-llama/llama-3.3-70b-instruct:free`) or local Ollama (`qwen2.5:14b`/`32b`). |
| **Academic Discovery** | arXiv API + Crossref API       | \$0.00 | Completely open REST APIs; queries millions of peer-reviewed papers, conference proceedings, preprints, and DOIs without authentication.                          |
| **Web Discovery**      | DuckDuckGo / SearXNG           | \$0.00 | Zero-auth web search endpoints.                                                                                                                                   |
| **Web Extraction**     | Local Parser / Trafilatura     | \$0.00 | Local HTML-to-markdown text extraction; avoids per-page scraping API fees.                                                                                        |
| **Local Knowledge**    | Zotero Local Bridge + Obsidian | \$0.00 | Local desktop HTTP API (`127.0.0.1:23119`) and local markdown vault.                                                                                              |

## Workflow Stages

### Stage 1: Topic Decomposition & Multi-Engine Sweep

Run the deterministic discovery script to pull preprints and peer-reviewed literature across open scholarly indexes:

```bash
python ".agents/skills/deep-research/scripts/deep_search.py" "<research query>" --limit 5
```

For JSON output to feed directly into agent analysis:

```bash
python ".agents/skills/deep-research/scripts/deep_search.py" "<research query>" --limit 5 --json
```

### Stage 2: Web Reality Sweep

Cross-reference academic literature with production implementations:

1. Search developer blogs, documentation, and GitHub issue trackers using Hermes built-in `web` tool.
2. Check local Zotero library via `python .agents/skills/zotero-research/scripts/zotero_query.py "<query>"`.

### Stage 3: Two-Pass Cross-Mapping (Combined Pass)

1. **Academic Pass:** Extract consensus, formal proofs, benchmarks, and theoretical guarantees from the arXiv/Crossref papers.
2. **Current Reality Pass:** Extract real-world production constraints, developer workarounds, and common runtime failures.
3. **Discrepancy Analysis:** Highlight where production systems ignore academic safety bounds, or where academic models fail under real-world latency/cost pressures.

### Stage 4: Output Staging & Hand-off

Write deliverable to `raw/reports/<topic-slug>.md` with:

- Bottom Line (1-2 paragraphs with inline citations).
- Key Mechanisms & System Structure.
- Evidence Matrix (Consensus vs Discrepancies).
- Open Research Vectors.
- Comprehensive Source Ledger table.

Hand off to the Orchestrator for QA verification.
