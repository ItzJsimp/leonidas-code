---
name: claude-harness-reference
description: "Reference for Claude Code CLI, Desktop, subagents, prompt caching tiers, hooks, and MCP servers."
category: system
type: skill
id: skill-claude-harness-reference
title: "Claude Harness Reference : Complete Architecture & Tool Manual"
kind: state
load: on-demand
owner: shared
scope: structural
distribution: core
verified: 2026-09-01
related: ["skills-index", "antigravity-harness-reference", "harness-matrix", "claude-overlay"]
generated: false
disable-model-invocation: true
license: MIT
---

# Claude Harness Reference : Complete Architecture & Tool Manual

This skill equips Antigravity (and other non-Claude engines) with authoritative, grounded knowledge of Anthropic's Claude harness, including **Claude Code CLI**, **Claude Desktop App**, **Claude Cowork**, hooks, prompt caching tiers, subagents, and configuration schemas.

---

## 1. The 3 Primary Claude Surfaces

| Surface                        | Execution Model                        | File Access & Permissions                                                   | Optimal Role                                                              |
| ------------------------------ | -------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Claude Code CLI (`claude`)** | Terminal REPL / Headless execution     | Full local filesystem read/write; direct terminal execution via `Bash` tool | Heavy engineering, automated builds, git workflows, and script execution  |
| **Claude Desktop App**         | Graphical GUI chat & artifacts         | Contextual project files; native Artifacts rendering (HTML/React/SVG)       | Strategic synthesis, ADR review, prompt brainstorming, and coaching modes |
| **Claude Cowork**              | Long-running multi-turn desktop worker | Background workspace operations                                             | Multi-file tasks and long-running interactive pair programming            |

---

## 2. Claude Code CLI Toolset & Capabilities

Claude Code operates with a native set of agentic tools:

- **`Task`:** Spawns autonomous child subagents for focused subtasks, taking `prompt` and optional `model` (`haiku`, `sonnet`, `opus`).
- **`Bash`:** Executes arbitrary shell commands in the host terminal.
- **`Read` / `View`:** Reads file content with slice windowing.
- **`Edit`:** Executes precise, single-contiguous block replacements.
- **`Write`:** Creates or overwrites complete file contents.
- **`Glob` / `Grep`:** High-speed pattern matching across the repository.

---

## 3. Skill Invocation & Slash Command Parsing Discipline

### Discovery locations and precedence

Corrected 2026-09-10: this section previously named only `~/.claude/skills/`, which misled a Q1 decision in [`logs/grill-sessions/2026-09-10-skills-architecture-and-lifecycle.md`](../../../logs/grill-sessions/2026-09-10-skills-architecture-and-lifecycle.md) into assuming project-level discovery did not exist. Claude Code resolves skills from seven locations:

| Location             | Path                                                               | Scope                                                                                 |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Enterprise           | `.claude/skills/<name>/SKILL.md` in the managed settings directory | All users on managed machines                                                         |
| Personal             | `~/.claude/skills/<name>/SKILL.md`                                 | Every project on the machine, but **not** Cowork or cloud sessions                    |
| **Project**          | `.claude/skills/<name>/SKILL.md` in the repo                       | **Sessions in that repository only**, plus every parent directory up to the repo root |
| Nested               | `<subdir>/.claude/skills/<name>/SKILL.md`                          | Sessions started in or below `<subdir>`                                               |
| Additional directory | `.claude/skills/` inside a `--add-dir` target                      | That session only                                                                     |
| Plugin               | `<plugin>/skills/<name>/SKILL.md`                                  | Namespaced, invoked as `/plugin-name:skill-name`                                      |
| Account-synced       | downloaded to `~/.claude/skills/synced/`                           | Cowork and cloud sessions, or local with `CLAUDE_CODE_SYNC_SKILLS=1`                  |

**Precedence on a name collision: Enterprise > Personal > Project.** The practical consequence is counter-intuitive and load-bearing: **a project-level skill is shadowed by a same-named personal one**, so adding project-level copies changes nothing until the personal copies are removed. Plugin skills are namespaced and never collide.

Project-level discovery is the mechanism that makes per-tenant scoping possible, which is what [ADR-0013](../../../decisions/0013-canonical-skills-yaml-quoting-and-zero-footers.md) point 1 means by preferring workspace-native discovery over global symlinks.

### Dispatch parsing

- **First-Token CLI Dispatch:** The CLI command interpreter only intercepts the very first token of a prompt if it begins with a slash (`/skill-name`). It expands the resolved `<skill-name>/SKILL.md` directly into the system/context block before sending to the model.
- **Mid-Text Slash Limitation:** Secondary slash commands placed mid-text (e.g. `Use /ask-leonidas and /system-prompt-authoring to help with this`) are treated by the CLI parser as plain text words. The CLI does NOT auto-expand mid-text slash commands.
- **Mandatory `@`-File Injection for Multi-Skill Workflows:** Whenever a prompt in Claude Code requires multiple skills or secondary procedures, format them using Claude's native file-injection syntax:
  `@.agents/skills/<skill-name>/SKILL.md`
  This guarantees that Claude Code's file loader pre-loads the full markdown instructions into the context window on Turn 1 with 100% mechanical certainty.
  (Contrast with Google Antigravity, which parses multiple slash commands and `@` skill declarations placed anywhere in the prompt body).

---

## 4. Subagent Discovery & Execution (`/agents`)

In Claude Code, subagents are autonomous assistants designed to handle specific tasks in isolated context windows:

- **Discovery Locations:**
  - `[Project Root]/.claude/agents/*.md` (Project-specific subagents, highest priority).
  - `~/.claude/agents/*.md` (User-level global subagents).
- **Subagent YAML Schema:**
  ```yaml
  ---
  name: codebase-auditor
  description: "When this subagent should be invoked automatically"
  tools: Read, Bash, Glob, Grep
  model: haiku
  ---
  ```
- **CLI Commands:**
  - `/agents`: Opens the interactive manual-setup-walkthrough to list, create, and edit custom subagents.
  - `@<agent-name>`: Explicitly directs a prompt to a specific subagent.

---

## 5. Prompt Caching Hierarchy & Invalidation Cascade

Claude models utilize a 3-tier prefix prompt cache:

```
[ Tier 1: Tools ]  -->  [ Tier 2: System Instructions ]  -->  [ Tier 3: Message History ]
```

- **Tier 1 Invalidation:** Modifying Tool definitions busts 100% of Tool, System, and Message caches.
- **Tier 2 Invalidation:** Toggling web search, changing thinking budgets, or editing System prompts preserves Tool cache but busts System and Message caches.
- **Tier 3 Invalidation:** Modifying conversation messages or changing models (`/model`) busts all downstream message caches.
- **TTL Window:** 1-hour inactivity expiration in Claude Code CLI (5 minutes in standard API calls).

---

## 6. Lifecycle Hooks & Configuration Schema

Hooks execute custom scripts or validation checks on tool lifecycle events:

- **Config Home:** `.claude/settings.json` or `~/.claude/settings.json`.
- **Supported Events:**
  - `PreToolUse`: Triggers before a tool executes (can block execution or modify arguments).
  - `PostToolUse`: Triggers after a tool finishes (can run auto-formatters, linters, or test suites).
  - `UserPromptSubmit`: Evaluates user input before sending to model (e.g. prompt-improver hook).
- **Example `.claude/settings.json`:**
  ```json
  {
    "permissions": {
      "allow": ["Edit", "Write", "Bash(npm test:*)", "Bash(pwsh:*)"]
    },
    "hooks": {
      "PostToolUse": [
        {
          "matcher": "Edit",
          "command": "pwsh -NoProfile -File ./scripts/Format-Code.ps1"
        }
      ]
    }
  }
  ```

---

## 7. Output Contract

- When advising on Claude workflows from Antigravity, cite exact `.claude/` paths and CLI flags (`claude -p`, `/agents`, `--mcp-debug`).
- Preserve the distinction between Antigravity's VS Code core and Claude Code's terminal REPL.
