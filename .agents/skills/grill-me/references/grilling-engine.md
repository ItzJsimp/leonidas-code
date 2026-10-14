# Grilling Engine

Shared interview engine for [`grill-me`](../SKILL.md) (chat-only) and
[`grill-with-docs`](../../grill-with-docs/SKILL.md) (writes ADRs and glossary terms).
Not a listed skill: demoted from the standalone `grilling` skill on 2026-09-28 per
[ADR-0066](../../../../decisions/0066-grill-family-consolidation-grilling-demoted-to-an-unlisted-engine.md).

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

## 1. Setup & Pre-Round Fact Finding

Before Round 1:

1. **Gather Environment Facts:** Finding facts is the agent's job, never the user's. When a question needs facts from the environment (filesystem, code, configs, tools), look them up directly via tools or dispatch a subagent. Never ask the user for facts you can discover yourself.
2. **Initialize Capture File:** Create the capture file at `logs/grill-sessions/{YYYY-MM-DD}-{topic-slug}.md` (create the directory if missing; fetch date via `Get-Date -Format yyyy-MM-dd` or `date +%F`, never guess). Populate header: Topic, Date, One-line Goal, and Pre-Round Facts. Tell the user in one line where it is saving, then ask Round 1 through the question tool.
   The file, not the conversation, is the durable source of truth: a session that compacts mid-interview must not lose more than the round in flight.

## 2. The Frontier & Round Discipline

Work the design tree in **rounds**.

- The **frontier** is every architectural or strategic decision whose prerequisites are already settled: questions you can ask _now_ without guessing answers you haven't heard yet. Ask the whole frontier in one round.
- A question whose answer depends on another open question belongs to a _later_ round.
- If a fact lookup is ongoing, only downstream dependent questions wait; ask the rest of the frontier immediately.

### Design and Taste Interviews

For visual or aesthetic decisions, convert option branches into generated artifacts (images, mockups) and run each round on a labeled contact sheet: the operator answers from pixels, not prose. A picked artifact can settle multiple branches at once; record the winner and its recipe in the capture file.

## 3. Option Quality Ceiling Standard

Every question must provide 2 to 4 discrete options followed by a decisive recommendation, delivered through the question tool (section 5).

To ensure options are genuinely valuable, diverse, and useful rather than obvious filler, every option must satisfy four quality gates:

1. **Steelmanned Viability (Production-Grade Bar):**
   Every option must be a robust, defensible architectural path that a rational principal engineer would champion under specific real-world conditions. Zero strawmen, zero "do nothing", zero "skip governance/testing", and zero superficial renames. If an option would never be chosen by a serious builder, it fails the gate.

2. **Orthogonal Architectural Archetypes:**
   Options must represent competing philosophies and structural trade-offs, rather than degraded copies of the recommended answer. Anchor candidate options across distinct archetypes:
   - **Minimalist / Native (Ponytail/YAGNI):** Smallest moving parts, standard library, zero dependencies, fastest to ship, lowest maintenance surface.
   - **Deterministic / Mechanical Gate:** Strict automated validation, script/AST enforcement, hard guarantees, eliminating human discipline failure modes.
   - **Ergonomic / Adaptive / Flexible:** Low activation friction, progressive disclosure, graceful fallback, high operator agency.
   - **Telemetry-Rich / Audit-Grade:** Structured event logs, persistent schemas, deep post-mortem traceability, explicit state transitions.
   - **Decoupled / Modular / Isolated:** Independent boundaries, subagent/hook delegation, clean separation of concerns.

3. **Explicit "Wins When" Clause:**
   Every option must explicitly articulate the scenario where it beats all others. This surfaces hidden trade-offs and respects operator intent:
   Format: `- **<Letter>)** **<Archetype / Strategy Title>**: <Concrete mechanism and technical reality>. *(Wins when: <specific constraint, priority, or context where this option is the superior choice>)*`

4. **Calibrated Count (Quality Over Volume):**
   Present 2 to 4 options based strictly on how many distinct, defensible paths exist. If only 2 or 3 genuine paths exist, stop at 2 or 3. Never add filler options to pad count.

## 4. The Recommended Answer & Deciding Factor

Preserve the fast-path for the operator. Lead with a clear recommendation, the single deciding factor, and what flips it:

- Format: `➡️ **Recommended: <Letter>** - <Decisive rationale and single deciding factor>. **What flips it:** <The exact constraint, priority shift, or trade-off that would make another option superior>.`
- This enables rapid scanning: the operator can read the question, glance at the recommendation and "What flips it", and either accept it in seconds or explore the steelmanned alternatives.

## 5. Round Delivery Contract

Deliver every round through the structured question tool, never as chat text. In Claude Code that is `AskUserQuestion`; in other harnesses, their user-input tool. The user sees a card and picks an option instead of typing a letter. This is always on, for every grill session.

- **One call per round.** Put the whole frontier (up to 4 questions) in a single tool call. A frontier larger than 4 splits across calls, most blocking first.
- **Question field:** a short header plus the tension or context, plain text only. Never paste the option list, a recommendation paragraph, or markdown into it.
- **Options:** 2 to 4 per question, each with a short `label` (the title or archetype) and a `description` holding the concrete mechanism and the Wins when clause: `<mechanism>. Wins when: <condition>.` The card supplies A, B, C letters, so do not add them to labels.
- **Recommendation:** put the recommended option FIRST and end its label with ` (Recommended)`. Add to its description: `Why: <deciding factor>. Flips if: <condition>.`
- **Plain text everywhere** in the tool fields: no bold, emoji, or markdown. If the tool accepts only string options, put title and explanation together in each string.
- **Free-form answers:** the card lets the user type their own answer. Treat it as the verbatim answer and checkpoint it as written.
- If the tool is unavailable or errors, fall back to the chat format below and say so once.

Fallback chat format (only when the tool is unavailable). Emit as live markdown, never inside a code fence:

❓ **Q1** - **<question title>**: <context>
- **A)** **<Option Title>**: <mechanism>. *(Wins when: <condition>)*
- **B)** **<Option Title>**: <mechanism>. *(Wins when: <condition>)*

➡️ **Recommended: <Letter>** - <rationale>. **What flips it:** <condition>.

## 6. Checkpointing & State Advancement

1. **Checkpointing:** Before formulating the next round, append the completed round to the capture file: each question asked, the user's verbatim answer, and settled decisions. Read back the write. If the write fails, report it and keep answers visible in chat. Append new rounds at the END of the Rounds section, newest last. Never anchor a patch on a section header (`### Round N`): the replace consumes the header text and reorders or deletes the whole section - anchor on unique body text instead, and when reading the write back, verify the rounds still appear in ascending order.
2. **Recomputing Frontier:** Each answered round pushes the frontier outward and unblocks downstream questions. Recompute and ask the next round.

## 7. Session Synthesis & Bridge to Execution

When the frontier is empty (all branches visited, zero hidden assumptions remaining), deliver a final synthesis and append it to the capture file:

- **Settled Architecture:** The agreed design, components, and boundaries.
- **Accepted Tradeoffs:** Explicit trade-offs and constraints accepted.
- **Next Action:** The immediate file, command, or implementation slice to execute.

Wait for user confirmation before executing changes.
