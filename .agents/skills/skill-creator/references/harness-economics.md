# Harness Economics & Listing Budget Standard

Understanding the physical constraints of Claude Code and Google Antigravity harnesses is mandatory for authoring sustainable skills.

---

## 1. Claude Code Listing Budget (The 78% Overage Reality)

Claude Code loads skills into context via a dynamic listing derived from ~/.claude/settings.json:

- skillListingMaxDescChars: 550 characters maximum per skill description.
- skillListingBudgetFraction: 0.01 (1% of the 200,000 token context window = ~2,000 tokens).

### The Portfolio Competition Reality

Skills do not live in isolation; they compete for a shared listing budget:

- At 60 skills with average descriptions of ~220 characters, the listing consumes over 3,500 tokens (78% above the default 2,000 token budget).
- When the portfolio exceeds the budget, descriptions past the cutoff are truncated or omitted, causing silent auto-routing failures.
- **Authoring Rule:** Target descriptions between **80 and 250 characters**. Every extra character directly degrades routing reliability for all other skills.

---

## 2. Claude Code Project-Scoped Discovery (ADR-0038)

- **Discovery Hierarchy:** Enterprise > Personal (~/.claude/skills/) > Project (<repo>/.claude/skills/).
- **Isolation Standard:** To prevent personal skills (e.g. `financial-audit`, PC gaming tuners) from leaking into business repositories (the peer AIOS), the global folder ~/.claude/skills/ is kept empty.
- **NTFS Junctions:** Skills canonically live in .agents/skills/<name>/SKILL.md. Running scripts/Sync-AgentSkills.ps1 creates project-scoped NTFS junctions in .claude/skills/<name>.
- **Hot-Reloading:** Claude Code hot-reloads skills when junctions are created or modified, but mid-session description edits invalidate the prompt cache.

---

## 3. Google Antigravity Mechanics

- **Native Discovery:** Antigravity natively scans .agents/skills/ within the active workspace.
- **Mid-Text Invocation:** Antigravity detects slash commands (/skill-name) and @ mentions anywhere in prompt text (unlike Claude Code CLI which only dispatches leading tokens).
- **Subagent Routing:** In Antigravity, subagents default to `flash` or `flash_lite` per ADR-0030. Never delegate to inherit when high reasoning effort is active on parent.

---

## 4. Prompt Caching & Prefix Churn

Per ADR-0022 and Claude overlay rules:

1. **Cache Tier Hierarchy:** Tools -> System -> Messages.
2. **Cache Invalidation:** Skill descriptions live in the System prompt tier. Editing a skill's description or frontmatter invalidates both the System and Message cache tiers.
3. **Prefix Stability:** Once a skill is deployed, treat its description as an immutable API contract. Do not tweak wording weekly; batch description refinements during formal audits.
