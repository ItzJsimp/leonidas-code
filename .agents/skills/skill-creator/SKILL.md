---
name: skill-creator
description: "Create, scaffold or refactor a skill to AIOS standards with a sharp trigger description. Use when the user wants a new skill, or a repeated task should become one."
category: agents
scope: structural
distribution: core
license: MIT
---

# Skill Creator

Author, scaffold, and refine agent skills across Claude Code and Google Antigravity. This skill governs the lifecycle of an AIOS skill from initial intent and trigger design down to progressive disclosure, harness budget compliance, and mechanical verification.

Universal document writing theory (pointers, leading words, information hierarchy, pruning) originates in [system-prompt-authoring](../system-prompt-authoring/SKILL.md). This skill adapts that theory specifically to the mechanical packaging, execution loops, and harness constraints of skills.

---

## 1. The Two Loops (Cole Medin / Nate Herk Pattern)

Every skill authoring task operates across two distinct phases:

1. **The Outer Strategic Loop (Intent, Triggers & Schema):**
   - Clarify the user's intent: Is this a repeatable capability, a one-off task, or a domain coach?
   - Determine scope: scope: structural (cross-tenant, reusable tooling) vs scope: personal (the user-specific hardware, finances, routines).
   - Determine distribution: core, template or private (see section 4). Propose a value for every new skill.
   - Decide invocation posture: Model-invoked vs user-invoked (disable-model-invocation: true). Consult [
     eferences/harness-economics.md](references/harness-economics.md).
   - Design the context pointer: Craft a concise description under 250 characters with front-loaded leading words and positive trigger branches.

2. **The Inner Execution Loop (Drafting, Disclosure & Verification):**
   - Scaffold the skill directory via scripts/New-Skill.ps1 or manual layout.
   - Apply progressive disclosure: Structure SKILL.md around sequential steps and completion criteria; push background reference, large schemas, and scripts into
     eferences/ or scripts/.
   - Score against the 6-pillar rubric in [
     eferences/rubric.md](references/rubric.md).
   - Mechanically sync and lint: Run scripts/Sync-AgentSkills.ps1 and scripts/Audit-Substrate.ps1.

---

## 2. Authoring Procedure

### Step 1: Triage and Boundary Check

Before writing any file, determine if a new skill is necessary:

- **Avoid Duplication:** Check existing skills in [.agents/skills/skills-index.md](../skills-index.md). If an existing skill covers 80% of the capability, refactor the existing skill instead.
- **Scope Allocation:** Mark scope: structural if the skill should be tracked in scripts/sync/shared-manifest.psd1 for the peer AIOS. Mark scope: personal if it contains private data or operator-specific hardware bindings.
- **Distribution Triage:** Run the section 4 test and tag `distribution:` in the same change that creates the skill.
- **Determine Execution Style:** Will the skill execute automated steps directly, run interactive Socratic grilling, or guide manual developer workflows?

### Step 2: Choose Invocation Posture & Write Frontmatter

Evaluate against portfolio listing budgets:

- **Model-Invoked:** Omit disable-model-invocation. Write a description that is:
  - **Front-loaded:** Start with active verbs indicating what the skill does (e.g., Create, scaffold, or refactor...).
  - **Positive:** Describe target situations rather than negated exclusions.
  - **Calibrated:** Keep length between 80 and 250 characters (never exceed 550 characters, the Claude Code hard cap).
- **User-Invoked:** Set disable-model-invocation: true. Write a concise human-facing summary. User-invoked skills consume 0 context listing tokens and are reachable strictly via /skill-name. Use this for destructive operations, rare maintenance scripts, or manual operator walkthroughs.
- See [
  eferences/templates.md](references/templates.md) for boilerplate.

### Step 3: Scaffold Directory Structure

Execute the scaffolding helper or create the folder:
`powershell
pwsh -File scripts/New-Skill.ps1 -Name "my-skill" -Description "..." -Scope "structural" -Category "<id from .agents/skills/_categories.json>"
`
Or create manually:
`.agents/skills/<skill-name>/
|-- SKILL.md                 # Primary workflow and completion criteria
|-- references/              # (Optional) Secondary specs, rubrics, deep background
-- scripts/                 # (Optional) Deterministic automation scripts`

### Step 4: Draft Primary SKILL.md (Information Hierarchy)

Organize the root file for execution clarity:

1. **Title & Mission Statement:** 1-2 lines defining what the skill achieves.
2. **Sequential Steps (The Recipe):** Numbered actions the agent performs in order. Keep steps lean.
3. **Progressive Disclosure:** If a reference table, schema, or guide exceeds 30 lines, move it to
   eferences/<topic>.md and point to it with a markdown link.
4. **Completion Criteria ("Done when"):** Explicit, observable conditions confirming the task finished. Avoid vague bounds like "ensure clean design"; use checkable gates like "All unit tests pass and Audit-Substrate.ps1 reports 0 errors".

### Step 5: Mechanical Validation and Sync

Never leave a skill unlinked or unvalidated:

1. **Link to Claude Code:** Run pwsh -File scripts/Sync-AgentSkills.ps1 to update project-scoped .claude/skills/ junctions.
2. **Substrate Linter:** Run pwsh -File scripts/Audit-Substrate.ps1 to verify frontmatter, ensure no U+2014 em dashes exist, and validate markdown links.
3. **Drift Detection:** Run pwsh -File scripts/Detect-Drift.ps1 to verify shared manifest alignment.
4. **Rebuild Indexes:** Run pwsh -File scripts/Build-Index.ps1 if a new skill was registered.

---

## 3. Governance Standards Checklist

Every skill in AIOS must satisfy these non-negotiables:

- [ ] **No Em Dashes (ADR-0012):** Zero Unicode U+2014 characters. Use colons, commas, hyphens, or parentheses.
- [ ] **Quoted YAML Frontmatter (ADR-0013):** String fields in frontmatter (
      ame, description) must be double-quoted.
- [ ] **Explicit Scope Tag (ADR-0013):** Must include scope: structural or scope: personal.
- [ ] **Distribution Tag:** Must include `distribution: core | template | private` right after `scope:` (section 4).
- [ ] **Zero Navigation Footers (ADR-0013):** Do not add Quick Navigation or trailing index footers.
- [ ] **Repo-Relative Links (Rule 7):** All file references inside repository markdown files must be clickable relative links (e.g. [
      eferences/rubric.md](references/rubric.md)).
- [ ] **Listing Budget Solvent:** Keep descriptions tight to prevent portfolio listing truncation in Claude Code.

---

## 4. Distribution Triage (Shareable AIOS Bundles)

`distribution:` sits right after `scope:` and decides what ships when the user builds or hands over an AIOS (a hand-over bundle, universal template, future installs). It is separate from `scope`: `scope` says whether the pattern is reusable, `distribution` says whether this skill is packaged for other people.

| Value      | Meaning                                                                                                        | Ships as                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `core`     | User-agnostic. Works for anyone with zero edits: no owner name, personal path, hardware, accounts or business. | Real copy, always                                              |
| `template` | Generic procedure, but a few facts are owner-specific (name, machine, folders, accounts).                      | Copy with `{{PLACEHOLDER}}` blanks the recipient's agent fills |
| `private`  | Owner-only (own business, bridge, brand assets, workflows).                                                    | Never                                                          |
| absent     | Not triaged yet.                                                                                               | Not shipped until triaged                                      |

**Triage test (run on every new or refactored skill):**

1. Remove the owner's name, paths, machines and accounts. Does the skill still work unchanged for a stranger? Propose `core`.
2. Works after a few blanks? Propose `template` and list each blank in a `## Fill-ins` section at the bottom of the SKILL.md: placeholder, meaning, and how to get it (read memory, detect with a command, or interview the user once).
3. Tied to the owner's own business or setup? Propose `private`.

**Placeholders:** `{{UPPER_SNAKE}}`, reusing names already in [`Export-UniversalAIOS.py`](../../../scripts/Export-UniversalAIOS.py) (`{{OPERATOR_NAME}}`, `{{AIOS_NAME}}`, `{{MACHINE_NAME}}`, `{{CPU_MODEL}}`, `{{USER_HOME}}`, `{{REPO_PATH}}`) before inventing new ones. The recipient's agent fills blanks from what it knows about the user, or interviews them once and saves the answers to memory.

**Ask, don't wait:** the owner never has to say which skills to replicate. Tag the proposed value in the same change, then tell the user in one closing line (`distribution: core, nothing personal in it`). Ask first only when borderline (generic method but heavy personal data, or a `private` call on something that looks reusable). Never leave a new skill untagged, and never promote `private` to `core` without the user's yes.

**Keeping `core` clean:** a `core` skill names the user as "the user", never "the user", and has zero absolute personal paths. Re-run the test when a skill picks up owner-specific content.
