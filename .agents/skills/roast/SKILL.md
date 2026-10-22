---
name: roast
description: "Convene a 3-persona subagent council to stress-test ideas and plans with isolated critical reviews."
category: planning
argument-hint: "[the idea to roast]"
type: skill
id: skill-roast
title: "Roast: 3-Persona Stress-Testing Council"
kind: procedure
load: on-demand
owner: shared
scope: structural
distribution: core
verified: 2026-09-09
related: ["skills-index", "grill-me"]
generated: false
disable-model-invocation: true
license: MIT
---

## What this does

Standard AI defaults lean toward agreeable consensus. `/roast` enforces adversarial pressure-testing by convening a council of three independent persona subagents who tear an idea apart and reconstruct it from distinct angles. A lead Judge then synthesizes the findings into a single decisive verdict before sinking time and capital into building the wrong thing.

The council is adversarial by design. No persona may hedge, flatter, or soften critique. The objective is exposing invisible blind spots, fragile assumptions, and genuine leverage points per [ADR-0034](../../../decisions/0034-subagent-context-isolation-and-token-deflation.md).

## Step 1: Get the brief

If `$ARGUMENTS` contains the idea, start there. Then ask the user a tight set of clarifying questions so the council has grounded context to evaluate. Ask only what has not already been provided. Keep to 3-4 questions maximum, in one batch:

1. **The idea** in one or two sentences (what it is, what it does).
2. **Who it is for** and **how it makes money** (the buyer and the pricing model).
3. **Your edge**: relevant skills, audience, or unfair advantages you already hold.
4. **Constraints**: budget, timeline, and how quickly you need the first dollar.

If the user says "just run it" or supplies sufficient context up front, skip questions and proceed immediately. One round of clarification at most, then convene the council.

Synthesize the brief into a single dense paragraph to embed into each council member's prompt, ensuring all three personas evaluate the exact same baseline.

## Step 2: Convene the council (3 agents, in parallel)

Dispatch **all three persona agents concurrently in a single turn**. Embed the identical brief into each, followed by that persona's specific mandate.

### Context Isolation & Token Deflation Standard (ADR-0034)

To protect system headroom and prevent token blowouts:

1. **Zero System Prompt Inheritance:** Subagents run under stripped, context-isolated definitions (<150 words). `TypeName: "self"` in Antigravity and generic `general-purpose` in Claude Code are strictly forbidden.
2. **Single-Turn Direct Return:** Each subagent returns its complete 4-part critique (150-250 words) directly to the parent message bus in a single turn.
3. **Zero Child Disk Writes:** Subagents must never call file-writing tools or dump separate scratch files to disk. All durable persistence is handled by the presiding Judge in Step 3.

### Harness-Specific Dispatch Mechanism

Adapt the dispatch call to the active execution engine:

- **Google Antigravity:**
  Call the native `invoke_subagent` tool once, passing all three personas in the `Subagents` array.
  - If `roast-critic` or `roast-researcher` are not yet registered in the active session, call `define_subagent` upfront with minimal prompt strings.
  - For The Skeptic and The Expansionist: Set `TypeName: "roast-critic"`, `Model: "flash"` (locked to Low effort per ADR-0030/ADR-0034).
  - For The Market Voice: Set `TypeName: "roast-researcher"`, `Model: "flash"` (locked to Low effort).
  - Explicitly forbid `inherit` and `pro` for child personas.
  - Set `Role` to the persona name (e.g. `"The Skeptic"`).
  - Embed the brief and persona mandate in `Prompt`.
  - Stop calling tools after launching; Antigravity will notify you automatically upon completion.

- **Claude Code:**
  Call the native `Task` tool three times in parallel within a single turn.
  - For The Skeptic and The Expansionist: Set `subagent_type: "roast-critic"`, `model: "haiku"`.
  - For The Market Voice: Set `subagent_type: "roast-researcher"`, `model: "haiku"`.
  - Explicitly forbid `sonnet` and `opus` for child personas.
  - Embed the brief and persona mandate in `prompt`.

- **Fallback (Engines without Child Subagents):**
  If running on an engine without subagent tools (e.g. local Ollama or basic chat interface), sequentially evaluate each persona in character within separate sections in your own context window before delivering the verdict.

### The Three Persona Mandates

**1. The Skeptic (Bear Case & Economics)**

> You are The Skeptic on an idea stress-testing council. Assume this idea fails. Your job is to expose fatal flaws, incentive misalignments, core causal breakdowns, and unit-economic arithmetic failures. Strip away jargon; attack the weakest structural seams. Zero hedging, zero polite optimism, no "it could work if..." Return your complete 4-part critique directly to the orchestrator (150-250 words): 1. One-line stance; 2. 3-5 sharpest failure points; 3. Core insight; 4. Dimension score (1-10, where 1 = catastrophic flaw, 10 = bulletproof). THE BRIEF: [brief]

**2. The Market Voice (Customer & Competitor Reality)**

> You are The Market Voice on an idea stress-testing council. Roleplay the target customer with skepticism, and use web search tools to verify real competitors and pricing benchmarks. What is your honest friction, switching inertia, or reason to do nothing? What actual competitors already solve this, and what price feels realistic? Cite specific competitor data and sources. Return your complete 4-part critique directly to the orchestrator (150-250 words): 1. One-line stance; 2. 3-5 customer objections and competitor facts; 3. Core insight; 4. Dimension score (1-10, where 1 = unviable/ignored, 10 = urgent must-buy). THE BRIEF: [brief]

**3. The Expansionist (Bull Case & Leverage)**

> You are The Expansionist on an idea stress-testing council. Make the strongest possible case FOR this idea. Identify the highest asymmetrical upside, 10x unlock points, non-obvious distribution loops, and defensibility the founder might be overlooking. Argue for potential, enterprise value, and scalability. Return your complete 4-part critique directly to the orchestrator (150-250 words): 1. One-line stance; 2. 3-5 strongest leverage points and 10x unlocks; 3. Core insight; 4. Dimension score (1-10, where 1 = zero leverage, 10 = undeniable no-brainer). THE BRIEF: [brief]

**Completion Criterion:** Do not proceed to Step 3 until all three structured critiques have been received by the orchestrator.

## Step 3: The Judge delivers the verdict

Once all three critiques are in, YOU act as the presiding Judge. Review the findings and synthesize a decisive conclusion without averaging numerical scores.

Incorporate the **economics lens** directly: realistic pricing, time-to-first-dollar, and whether the founder can execute and ship rapidly given their stated edge.

### Consolidated Disk Drop (ADR-0034)

Compile the three persona critiques, your synthesized analysis, and the final verdict into a single markdown file at `scratch/roast-verdict.md` using `write_to_file` in **one single write operation**.

Format the response using this exact structure:

```
## THE VERDICT: GO / RESHAPE / KILL
Confidence: [low / medium / high]

**The call in one line:** [the decision, plainly]

**Why:** [2-3 sentences resolving the primary tension among council members]

**Biggest risk:** [the single obstacle most likely to kill this venture]
**Biggest upside:** [the strongest catalyst or leverage point to pursue]

**Money read:** [estimated pricing, time-to-first-dollar, and shipment speed vs founder edge]

**The cheapest 48-hour test:** [the smallest, fastest empirical test to validate the riskiest assumption BEFORE writing code or spending capital]

**If RESHAPE:** [the specific strategic pivot that eliminates fatal flaws while preserving upside]
```

Follow the verdict block with the three individual council scores on a single line:
`Skeptic X/10 · Market Voice X/10 · Expansionist X/10`

Provide the relative link to the consolidated report:

- `Consolidated Verdict Report: scratch/roast-verdict.md`

## Rules

- Every persona must stay rigidly in character. No persona may hedge, qualify, or soften findings. Friction produces the signal.
- Subagents must strictly honor the Token Deflation Standard: direct 150-250 word critique to chat, zero child file writes.
- The Judge must make an unequivocal call. "It depends" is a refusal, not a verdict. Select GO, RESHAPE, or KILL and defend it.
- The cheapest 48-hour test is the highest-value deliverable. It provides empirical truth without building full infrastructure.
- Keep the final verdict dense, scannable, and actionable. Council personas supply depth; the Judge supplies executive decision.
