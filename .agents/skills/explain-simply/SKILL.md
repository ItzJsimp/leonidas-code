---
name: explain-simply
description: "Re-pitch previous explanations in plain, jargon-free English with missing mental models restored."
category: research
scope: personal
distribution: core
disable-model-invocation: true
type: skill
id: skill-explain-simply
title: "Wait What : Comprehension Reset & Plain-English Re-Pitch"
kind: procedure
load: on-demand
owner: shared
verified: 2026-08-22
related: ["skills-index", "soul", "technical-writing"]
generated: false
license: MIT
---

# Wait What : Comprehension Reset

## Purpose

When output loses the reader, drifts into internal jargon, stacks acronyms, or presents conclusions without visible premises, `/explain-simply` resets the explanation.

The agent steps back, restores the unstated context, and re-explains the core concept in plain English.

---

## Operating Procedure

1. **Acknowledge the Gap:** Open with a single-line reset acknowledging where comprehension paused.
2. **State the Premise First:** Explain _why_ the problem exists before explaining _how_ the solution works.
3. **Use Ubiquitous Language:** Restrict terms to plain English (6th–8th grade reading level per `soul.md`). Translate technical concepts on first mention.
4. **Provide a Concrete Analogy or Minimal Example:** Show one real-world, 2-line input/output example that illustrates the concept immediately.
5. **Close with a Check-In:** Ask one direct question to confirm whether the premise is clear before continuing.

---

## Anti-Patterns

- Do not summarize with caveman brevity (e.g. chopping sentences into telegrams). Shortness without clarity fails.
- Do not repeat the exact same paragraphs with louder formatting.
- Do not invent new jargon to explain existing jargon.

---

## Output Contract

- **Length:** ≤3 short paragraphs total.
- **Reading Level:** 6th to 8th grade.
- **Structure:**
  - `**The Core Idea:**` (1–2 sentences)
  - `**Why This Matters:**` (1 paragraph with premise)
  - `**Concrete Example:**` (1 small snippet or analogy)
