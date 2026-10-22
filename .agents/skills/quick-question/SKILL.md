---
name: quick-question
description: "Answer a quick factual or lookup question fast from local memory or one web search, with no extra ceremony. Use for single-fact questions, definitions and short checks."
category: research
type: skill
id: skill-quick-question
title: "Quick Question: Rapid Single-Shot Lookup Engine"
kind: procedure
load: on-demand
owner: leonidas
scope: structural
distribution: template
verified: 2026-09-22
related: ["skills-index", "soul", "ask-leonidas"]
generated: false
license: MIT
---

# Quick Question: Rapid Single-Shot Lookup Engine

Rapid, zero-fluff answer ritual for single-shot questions, factual lookups, and Google-style queries. Bypasses multi-step planning, suppresses heavy footers, and delivers the answer directly using resident memory or live web search.

---

## Operating Invariants

1. **Direct Answer First:** The very first line must deliver the answer, number, command, or core takeaway. Never open with "Based on my search...", "Certainly!", or "Here is what I found."
2. **Zero Planning Artifacts:** Never create `implementation_plan.md` or `walkthrough.md` files. Answer inline in the chat.
3. **Suppressed Standing Footer:** Omit the full 5-line standing footer (telemetry gauge, grill block, recap, tasks anchor). Quick questions are self-contained and require no decision branching.
4. **Zero Em-Dash Standard:** Never write the Unicode em dash (U+2014) in any output per [ADR-0012](../../../decisions/0012-zero-emdash-punctuation-standard.md). Use colons, hyphens, or parentheses.
5. **Token Density Budget:** Cap total response length under 150 to 250 tokens unless the user explicitly asks for deep elaboration.

---

## Execution Pipeline

### Step 1: Routing & Source Inspection

- **Personal / PC / AIOS Query:** If the question touches the user's hardware, specs, habits, or local tools, read the authoritative store directly (e.g. [`memory/pc-system-profile.md`](../../../memory/pc-system-profile.md), [`memory/ai-stack.md`](../../../memory/ai-stack.md), [`memory/user.md`](../../../memory/user.md)) without asking.
- **External Web Query:** If the question requires live internet facts, current year data, software updates, or web documentation, immediately call the harness search tool (`search_web`).

### Step 2: Synthesis & Output

- Format the response as:
  - **Answer:** 1-3 crisp bullet points or a single punchy paragraph.
  - **Source / Reference:** 1 line citing the memory file or web URL if relevant.
  - **Next Step:** 1 optional executable command if applicable.
