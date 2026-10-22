---
name: llm-wiki-research
description: "Run a multi-lens research investigation (balanced, academic, current reality) and write a staged, cited report. Use for broad topic reports that need several perspectives."
category: research
scope: structural
distribution: core
type: skill
id: skill-llm-wiki-research
title: "LLM Wiki Research"
kind: procedure
load: on-demand
owner: shared
verified: 2026-09-29
generated: false
license: MIT
---

# LLM Wiki Research

Standardized procedure for specialist researcher agents to conduct structured multi-lens investigations, produce grounded evidence reports, and hand off validated briefs to an Orchestrator.

## Core Invariants

1. **Strict Staging Boundary:** Never write or modify files inside the canonical knowledge base (`wiki/` or `concepts/`). Always stage research deliverables to `raw/reports/<topic-slug>.md`. Only the Librarian bot holds write authority to ingest into the LLM Wiki.
2. **Grounded Evidence Required:** Every factual assertion must be anchored to a primary citation, paper DOI, or official documentation URL. Unanchored claims are marked `[unverified]`.
3. **Supervisor Quality Gate:** All outputs must be submitted to the Orchestrator (`@orchestrator`) for quality review before any downstream ingestion.

## The Four Research Lenses

| Lens                | Priority Sources                                                               | Focus & Intent                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Balanced**        | Mix of primary specs, official docs, and secondary analysis                    | Practical, high-signal overview for decision-making.                                                                 |
| **Academic**        | Peer-reviewed literature, arXiv preprints, meta-analyses, Consensus            | Theoretical foundations, mathematical rigor, formal benchmarks, and consensus status.                                |
| **Current Reality** | Production codebases, engineering blogs, live tool documentation, GitHub repos | Real-world implementation details, operational pitfalls, and state of the art in production.                         |
| **Combined**        | Two-pass sweep: Academic Pass first, Current Reality second                    | Explicitly maps academic theory against production practice, highlighting contradictions, gaps, and friction points. |

## Execution Workflow

### Step 1: Query Decomposition & Source Gathering

1. Deconstruct the research question into specific sub-queries:
   - Theoretical / foundational mechanisms (Academic).
   - Practical / implementation patterns (Current Reality).
   - Counter-evidence and failure modes.
2. Query local reference manager (Zotero) if active:
   - Check if relevant papers or notes already exist in the local library.
3. Query external academic sources:
   - Consensus MCP, Semantic Scholar, or arXiv.
4. Query web documentation for current reality.

### Step 2: Synthesis & Contradiction Detection

Synthesize the evidence across three mandatory dimensions:

- **Consensus Points:** Where academic theory and production practice align.
- **Divergence / Counter-Evidence:** Where production contradicts theory, or studies report opposing results.
- **Unresolved Gaps:** Unanswered questions, unknown performance bounds, or missing empirical data.

### Step 3: Write Staged Deliverable

Output the report to `raw/reports/<topic-slug>.md` using the standard structure:

```markdown
# [Report Title]

**Research Question:** [Exact question explored]
**Date:** [YYYY-MM-DD] ([Lens used])

## Bottom Line

[1-2 high-density paragraphs stating core thesis and actionable takeaway, with bracketed citations [1][2]].

## Key Findings & System Structure

[Structured bullet points or architectural diagrams explaining core mechanisms].

## Academic vs Current Reality Analysis (if Combined Pass)

- **Academic Foundation:** [What formal literature claims]
- **Production Reality:** [What real-world systems actually do]
- **Discrepancy / Friction:** [Where theory fails in production]

## Counter-Evidence, Limitations & Risks

[Explicit vulnerabilities, attack surfaces, or failure modes].

## Open Research Questions

[2-4 actionable follow-up questions for future research sprints].

## Source Ledger

| Ref | Title / Source | URL / DOI | Type            | Date | Key Evidence Extracted |
| --- | -------------- | --------- | --------------- | ---- | ---------------------- |
| [1] | ...            | ...       | Academic / Docs | ...  | ...                    |
```

### Step 4: Multi-Agent Handoff

Ping the Orchestrator in the session:
`@orchestrator Staged research brief ready for review at raw/reports/<topic-slug>.md. Summary: [1 sentence]. Please inspect provenance and cite ledger.`
