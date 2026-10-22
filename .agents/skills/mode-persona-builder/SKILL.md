---
name: mode-persona-builder
description: "Author, promote, or refine AIOS Modes and personas adhering to canonical 5-section architecture and mode-specific output contracts."
category: agents
scope: structural
distribution: template
type: skill
id: skill-mode-persona-builder
title: "Mode & Persona Builder"
kind: procedure
load: on-demand
owner: shared
verified: 2026-09-22
related: ["modes-index", "modes-router", "master-instructions", "system-prompt-authoring"]
generated: false
disable-model-invocation: true
license: MIT
---

# Mode & Persona Builder

Produces a fully-formed Mode for Leonidas AIOS: a roster row in [`modes/modes-index.md`](../../../modes/modes-index.md), an instruction file built to canonical 5-section standard with a personalized Output Protocol and Mode Footer Contract, a [`modes/router.md`](../../../modes/router.md) precedence entry, a passed cold-start test, and a `Build:`-prefixed commit per the ADR governing git-history-as-log (see [`decisions/0010-git-history-replaces-the-master-log.md`](../../../decisions/0010-git-history-replaces-the-master-log.md)).

## Read first

- [`MASTER-INSTRUCTIONS.md`](../../../MASTER-INSTRUCTIONS.md) §8 (Modes vs. Skills) and §4 (operating principles)
- [`memory/soul.md`](../../../memory/soul.md) (response architecture, standing footer slots, and communication style)
- [`modes/modes-index.md`](../../../modes/modes-index.md), the locked roster and current status for every Mode
- [`modes/router.md`](../../../modes/router.md), the precedence ladder this Mode must be registered into
- Existing Mode files as worked examples: any numbered `modes/NN-*.md` file (e.g. [`modes/00-build-architect.md`](../../../modes/00-build-architect.md), [`modes/04-finance-coach.md`](../../../modes/04-finance-coach.md))

## Canonical 5-Section Architecture

Every Mode file (`modes/NN-name.md`) must adhere strictly to this five-section structure:

1. **## 1. Identity & Cognitive Stance**
   - Core identity, authority, and cognitive posture (e.g. solvent, forensic, friction-free).
   - Relationship to the operator, cognitive style, and mental models applied.
   - Core vector: what this Mode optimizes, protects, or accelerates.

2. **## 2. Trigger Conditions & Routing Precedence**
   - Exact conditions that activate this Mode (mapping to [`modes/router.md`](../../../modes/router.md)).
   - Clear boundaries and peer handoffs (e.g. where this Mode stops and another takes over).
   - Multi-mode co-activation guidelines (Primary vs. Domain Overlay).

3. **## 3. Domain Store Bindings**
   - **Primary Read Path:** Authoritative files this Mode consumes.
   - **Primary Write Path:** Authoritative single write path (SAWP) for durable mutations.
   - **Bound Skills:** Curated skills dispatched under this Mode.
   - **Bound Memory Files:** Specific files loaded on-demand.
   - **Mode vs. Subagent Verdict:** Architectural rationale for keeping this as a persistent Mode rather than an ephemeral subagent.

4. **## 4. Operational Non-Negotiables**
   - 3 to 6 deterministic, numbered rules and safety constraints.
   - Must include Zero Em-Dash standard (ADR-0012) and relative file link standard (AGENTS.md Rule 7).
   - Domain-specific invariants (e.g. mutation safety restore points in Mode 09, sensitive privacy tags in Mode 04, clinical boundaries in Mode 02, staging blocks in Mode 03).

5. **## 5. Output Protocol & Mode Footer Contract**
   - Standardized top banner, specialized domain badge, crisp TL;DR, and personalized footer footnote.
   - See detailed Output Specification below.

---

## Output Protocol & Mode Footer Contract Specification

Every Mode customizes Leonidas AI's response format while maintaining complete structural consistency with [`memory/soul.md`](../../../memory/soul.md):

### 1. Top Slot & Banner

- **Line 1 (Active Mode Banner):** `**Active Mode:** Mode NN: [Mode Name]` (or `**Active Modes:** Mode NN (Primary) | Mode YY (Domain)` when co-activating).
- **Line 2 (Domain Status Badge):** A high-contrast visual landmark signaling domain state, scope, or safety constraints:
  - _Mode 00:_ `🏗️ Architecture Vector: [Current State -> Ideal Target] | Gap Closed: [Gap]`
  - _Mode 01:_ `⚡ Triage & Dispatch: [General Task | Fast Capture | Text Transformation]` (substantive turns)
  - _Mode 02:_ `⚠️ Clinical Boundary: Educational & self-care only (not medical diagnosis/treatment) | Source Tier: [Sources]`
  - _Mode 03:_ `🛡️ Commercial Scope: Sub-mode [A-E] | Write-Staging Gate: [Active / Zero Staged]`
  - _Mode 04:_ `🔒 [Sensitive Domain: Finances - Verified from financial summary]` (mandatory when quoting figures)
  - _Mode 05:_ `⚡ Momentum & Focus: [Activation Friction: Low/Med/High] | WIP Limit: [X/3 Active Focus Items]`
  - _Mode 06:_ `🧭 Vision Horizon: [1-3yr Strategic Target] | Decision Gate: [M2 Inversion & M5 Constraint]`
  - _Mode 07:_ `🔍 Evidence Rigor: [N Primary Sources Verified] | Wiki Synthesis Target: [wiki/path.md]`
  - _Mode 08:_ `⚙️ Instruction & Meta Architecture: [Skills | Prompts | Modes | Hooks | Token Budgets]`
  - _Mode 09:_ `💻 Target Machine: [DESKTOP-BPUDGRG | JAKESLAPTOP] | Mutation Safety Gate: [Restore Point Verified | Read-Only Diagnostic]`
  - _Mode 10:_ `🛠️ Stack & Deliverable: [Frameworks/Languages] | Path: [Filepath] | Status: [Runnable Prototype]`
- **Line 3 (Top-Line TL;DR):** 1-3 crisp, scannable bullets or single bold takeaway providing immediate value.

### 2. Body & Specialized Mid-Response Gates

Modes define specialized execution blocks required for their cognitive work:

- _Mode 00:_ Mandatory Plus-One Section (`### Second-Order Blind Spots & Edge Cases` and `### Frontier / Peer-Reviewed Upgrade`).
- _Mode 02:_ Medical source citations and explicit Clinician Visit Threshold.
- _Mode 03:_ 🛡️ the peer AIOS Write Staging Block with sanitization verification.
- _Mode 04:_ Forensic calculations, inline parenthetical jargon translations, and Closing Micro-Drill.
- _Mode 05:_ 1-3 WIP items with physical completion criteria, ending with binary check ("Ready to start item 1?").
- _Mode 06:_ Mandatory Cognitive Gate block (`**Inversion (M2):**` and `**Constraint (M5):**`).
- _Mode 07:_ Structured synthesis tables and 1-2 question Comprehension Checkpoint.
- _Mode 09:_ Quantitative telemetry benchmark, Step-by-Step procedure, and Restore Point verification.
- _Mode 10:_ Runnable vertical slice, launch instructions, and zero phantom dependencies.

### 3. Mode-Specific Footer Contract (Mode Footnotes)

Substantive chat turns close with the 7-element standing footer defined in [`memory/soul.md`](../../../memory/soul.md). Each Mode specifies its personalized **Mode Footnote / Domain Anchor** occupying Slot 3:

1. `**Model Rating:** [Model & Effort] ([Rating 1-10]) | **Next:** [Model] ([Cache Advice]) | **Context:** [Tokens]k / 150k tokens (Prompt X/50)`
2. `**🧠 Psychological Anchor:** [Study / Bias / Model] -> [1 concise causal sentence]`
3. `**<Domain> Anchor:** [1 dense line of domain-specific state, telemetry, or safety gates]`
4. Grill block (when a decision is open, 2-3 options with lettered choices)
5. `### Next Actions` (2-3 numbered options formatted as short phrases the user can say back)
6. Session recap (strictly 1 concise line naming changes and git state)
7. Top Focus Tasks anchor (strictly 1 concise line referencing top 1-3 active items from [`TASKS.md`](../../../TASKS.md))

Each Mode must define its exact Slot 3 syntax in Section 5:

- Mode 00: `**Substrate Anchor:** Substrate Health: [PASS/FAIL] | Active Tasks: [N] | Word Footprint: [Nk / 15k]`
- Mode 01: `**Triage Anchor:** Pending Captures: [N] | Capture Queue: [Clean | Pending Triage]`
- Mode 02: `**Health Anchor:** Clinical Escalation Threshold: [Trigger or None] | Care Log: [Path]`
- Mode 03: `**Commercial Anchor:** Pipeline Stage: [Stage] | Staged Cross-Repo Writes: [0 staged | N awaiting confirmation]`
- Mode 04: `**Financial Anchor:** Verified Liquid Runway: [X.X mos] | High-Interest Drag Target: [Target]`
- Mode 05: `**Focus Anchor:** Active WIP: [X/3 items] | 2-Minute Activation Step: [Immediate action]`
- Mode 06: `**Vision Anchor:** Active Constraint (M5): [Bottleneck] | Inversion Check (M2): [Failure mode mitigated]`
- Mode 07: `**Research Anchor:** Wiki Artifact: [wiki/path.md] | Source Rigor: [Verified Primary / Secondary]`
- Mode 08: `**Engineering Anchor:** Unified Execution via Mode 00 | Canon Alignment: [Verified]`
- Mode 09: `**System Anchor:** Machine: [DESKTOP-BPUDGRG/JAKESLAPTOP] | Restore Point: [Verified / Clean] | Telemetry: [Nominal]`
- Mode 10: `**Foundry Anchor:** Launch: [Launch command] | Zero-Bloat Gate: [Passed] | Slices: [N/M Complete]`

---

## Procedure

1. **Create the file.** Author `modes/NN-name.md`, where `NN` is the two-digit Mode number and `name` is lowercase hyphenated.
2. **Fill the frontmatter.** Set `type: mode`, `id: mode-NN-name`, `title: "Mode NN: Human Name"`, `description: "..."`, `kind: state`, `load: on-demand`, `owner: shared`, `scope: structural`, `status: Active | Scaffold`, `mode_number: NN`, `readiness: "Wired" | "Scaffold"`, `verified: <today>`, `generated: false`.
3. **Write the 5 sections.** Author the body adhering to the canonical 5-section architecture above:
   - Section 1: Identity & Cognitive Stance
   - Section 2: Trigger Conditions & Routing Precedence
   - Section 3: Domain Store Bindings
   - Section 4: Operational Non-Negotiables
   - Section 5: Output Protocol & Mode Footer Contract (Top banner, domain badge, TL;DR, specialized blocks, Slot 3 Domain Anchor syntax)
4. **Register in the router.** Add a row to the precedence ladder in [`modes/router.md`](../../../modes/router.md), state exactly when it fires, and confirm it does not compete with an existing rule.
5. **Update the Index.** Run `pwsh -NoProfile -File scripts/Build-Index.ps1` to regenerate [`modes/modes-index.md`](../../../modes/modes-index.md).
6. **Run the cold-start test.** Read only [`AGENTS.md`](../../../AGENTS.md) -> [`MASTER-INSTRUCTIONS.md`](../../../MASTER-INSTRUCTIONS.md) -> this Mode's file, and confirm that alone is enough to act correctly.
7. **Verify & Commit.** Run `pwsh -NoProfile -File scripts/Audit-Substrate.ps1` to verify zero broken links and zero em dashes. Commit via safe-parallel-commit protocol.

## Anti-patterns

- Duplicating scope another Mode already owns.
- Restating canon inline instead of linking it via relative paths.
- Omitting Section 5 or failing to define the Mode Footnote / Domain Anchor.
- Emitting Unicode U+2014 em dashes in prose, headings, or code comments (ADR-0012).
- Marking a Mode Active before its instruction file and router entry both exist.
- Using absolute `file:///` URIs instead of repo-relative markdown links.
