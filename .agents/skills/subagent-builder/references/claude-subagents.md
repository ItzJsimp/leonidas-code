# Claude Code Subagent Reference

This document covers subagent discovery, configuration, and execution within Anthropic's **Claude Code** harness (CLI and Desktop).

---

## 1. Subagent Storage & Discovery Locations

Claude Code discovers subagents from two locations:

1. **Project Subagents (Recommended):**
   - Path: `.claude/agents/<name>.md`
   - Scoped to the current repository. Checked into Git so all team members and agents share the configuration.
2. **User Global Subagents:**
   - Path: `~/.claude/agents/<name>.md`
   - Global across all projects on the machine.

---

## 2. Claude Code Subagent YAML Schema

A valid Claude Code subagent file contains YAML frontmatter followed by system prompt instructions:

```yaml
---
name: codebase-auditor
description: "Parallel read-only codebase auditor for deep AST search, ripgrep scans, link verification, and drift detection."
tools: Read, Grep, Glob
model: haiku
---
# Role Instructions
You are an expert codebase auditor...
```

### Frontmatter Keys

- `name`: Subagent identifier (lowercase, hyphens permitted).
- `description`: Context pointer explaining when Claude Code should autonomously delegate to this subagent.
- `tools`: Comma-separated list of enabled tools. Options include:
  - `Read`: Read files.
  - `Edit`: Contiguous file block replacement.
  - `Write`: Create or overwrite files.
  - `Glob`: Pattern-based file finding.
  - `Grep`: Ripgrep text matching.
  - `Bash`: Terminal command execution.
  - `WebFetch`: HTTP URL fetching.
- `model`: Model tier to use:
  - `haiku`: Claude 3.5 Haiku (default for read passes, fast searches, and token budgeting per ADR-0030).
  - `sonnet`: Claude Sonnet 5 (for substantive coding, refactors, and test implementation).
  - `opus`: Claude Opus 5 (reserved strictly for formal mathematical proofs or intractable security analysis).

---

## 3. Claude Code Execution Workflows

- **Interactive Subagent Manager:** Run `/agents` in the Claude Code REPL to list, view, or configure custom subagents.
- **Direct Subagent Routing:** Prefix a prompt with `@<agent-name>` to route intent directly to that agent.
- **Autonomous Subagent Spawning:** The orchestrator agent spawns subagents via the `Task` tool when prompted by workload complexity or task delegation criteria.
