# Deep Research Methodology: 8-Phase Pipeline

Authoritative execution reference for the `research` skill. Governs systematic evidence gathering, parallel subagent swarms, outline adaptation, and verified report packaging.

---

## The 8-Phase Execution Loop

```
Phase 1: SCOPE          -> Decompose core questions, boundaries, and assumptions
Phase 2: PLAN           -> 5-10 orthogonal search angles & dependency mapping
Phase 3: RETRIEVE       -> Parallel subagent swarms; raw dumps to disk; deflated JSON to parent
Phase 4: TRIANGULATE    -> Cross-reference 3+ independent source clusters per core claim
Phase 4.5: REFINE       -> Evidence-driven outline evolution (WebWeaver pattern)
Phase 5: SYNTHESIZE     -> Prose-first (>=80%) narrative synthesis with conceptual frameworks
Phase 6: CRITIQUE       -> Persona-based red teaming (Practitioner, Skeptic, Implementer)
Phase 7: REFINE GAPS    -> Targeted delta-queries for unresolved blind spots
Phase 8: PACKAGE        -> Standard report + sources.jsonl + evidence.jsonl + clickable URLs
```

---

## Phase 1: SCOPE (Research Framing)

1. **Question Decomposition:** Split the inquiry into core technical assertions, external dependencies, and empirical claims.
2. **Boundary Definition:** Explicitly declare what is in scope vs. out of scope (e.g. current year baseline vs. legacy versions).
3. **Audience Stance:** Default to senior systems architect / technical operator unless the prompt specifies a business or executive focus.
4. **Assumption Ledger:** Explicitly record working assumptions rather than defaulting silently.

---

## Phase 2: PLAN (Orthogonal Query Strategy)

Before launching searches, decompose the topic into 5 to 10 distinct, non-overlapping search angles:

- **Core Semantic:** Foundational conceptual definitions and official architecture overviews.
- **Technical Implementation:** Concrete method signatures, APIs, flags, configuration specs, and code repositories.
- **Recent Developments:** Filtered strictly to the current year and past 12-18 months for breaking changes.
- **Academic & Formal Specs:** RFCs, whitepapers, IEEE/ACM papers, or formal benchmarks.
- **Contrarian & Alternative:** Competing frameworks, known criticisms, and adversarial reviews.
- **Empirical Benchmarks:** Quantitative latency, throughput, memory, or cost metrics.
- **Real-World Gotchas:** Production post-mortems, GitHub issue trackers, and edge-case failure modes.

---

## Phase 3: RETRIEVE (Parallel Subagent Swarms & Context Protection)

### Air-Gapped Context Architecture

To prevent context flooding and prompt cache invalidation in the parent orchestrator:

1. **Parallel Dispatch:** Parent agent launches 2 to 5 lightweight subagents concurrently (`Model: 'flash'` in Antigravity, `--model haiku` in Claude Code).
2. **Raw Disk Streaming:** Subagents write full raw HTML/text scrapes, large source dumps, and JSON payloads directly to `wiki/research/runs/<date>-<topic>/raw/`.
3. **Structured Return Contract:** Subagents return only high-signal JSON evidence spans (never raw web text) to the parent:
   ```json
   [
     {
       "claim": "Specific factual assertion",
       "quote": "Exact verbatim quote from primary source",
       "locator": "Section 4.2 / Page 12 / Line 140",
       "source_url": "https://example.com/spec",
       "source_title": "Official Architecture Spec v2",
       "credibility_score": 95
     }
   ]
   ```

### First-Finish-Search (FFS) Completion Thresholds

Proceed to Phase 4 as soon as the first condition is satisfied:

- **Quick Mode:** 1 to 3 sources verified (Credibility > 70) OR 2 minutes elapsed.
- **Standard Mode:** 5 to 12 sources verified (Credibility > 70) OR 6 minutes elapsed.
- **Deep Mode:** 15 to 30+ sources verified (Credibility > 75) OR 15 minutes elapsed.

---

## Phase 4: TRIANGULATE (Cross-Verification)

1. **Multi-Source Corroboration:** Core claims require verification across 3+ independent source clusters (disregarding syndicated content or mirror blogs).
2. **Single-Source Flagging:** Any assertion backed by only one source must be explicitly marked as preliminary or vendor-claimed.
3. **Consensus vs. Debate Mapping:** Identify where sources agree universally vs. where active technical debate remains unresolved.

---

## Phase 4.5: OUTLINE REFINEMENT (Dynamic Evolution)

Prevents confirmation bias when discovered evidence contradicts initial assumptions:

1. Review evidence against Phase 1 scope. If a critical unexpected angle emerged (e.g. security flaw, breaking API deprecation), adapt the outline.
2. Demote or remove planned sections that proved unsupported by evidence.
3. Keep outline adjustments evidence-driven and under 40% structural divergence from the core topic.

---

## Phase 5: SYNTHESIZE (Prose-First Analysis)

1. **Prose Density:** Maintain >=80% cohesive narrative prose. Reserve bullet points strictly for enumerated lists, steps, or registries.
2. **Inline Evidence Anchoring:** Every factual claim must carry an immediate inline citation marker (`[1]`, `[2]`).
3. **Conceptual Frameworks:** Group findings into thematic patterns, architectural trade-offs, and failure mode matrices.

---

## Phase 6 & 7: CRITIQUE & GAP FILLING

1. **Persona-Based Red Team Review:**
   - _Skeptical Practitioner:_ Would an engineer running this in production trust these numbers?
   - _Adversarial Reviewer:_ What counter-examples or competing solutions invalidate this recommendation?
   - _Implementation Engineer:_ Are the steps concrete, executable, and free of vague hand-waving?
2. **Delta-Query Loop-Back:** If a critical gap is surfaced, dispatch 1-2 targeted queries (max 2 minutes) to resolve the blind spot before publishing.

---

## Phase 8: PACKAGE (Durable Artifact Assembly)

Assemble the finalized dossier into [`../templates/research-report-template.md`](../templates/research-report-template.md):

1. **Destination:**
   - General knowledge: `wiki/research/YYYY-MM-DD-<topic-slug>.md`
   - Project-specific: `projects/<project>/research/YYYY-MM-DD-<topic-slug>.md`
2. **Accompanying Ledgers (Optional / Deep Mode):**
   - Save atomic records to `wiki/research/runs/<date>-<topic>/sources.jsonl` and `evidence.jsonl`.
3. **Substrate Update:** Run `pwsh -File scripts/Build-Index.ps1` to link the new artifact into global indexes.
