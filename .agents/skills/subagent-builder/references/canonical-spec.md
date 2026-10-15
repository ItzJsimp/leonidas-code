# Canonical AIOS Subagent Specification

This document defines the authoritative schema and structure for subagents in Leonidas AIOS. All durable subagent profiles live under `.agents/subagents/<name>.md`.

---

## 1. YAML Frontmatter Schema

Every canonical subagent file must start with valid YAML frontmatter:

```yaml
---
name: verifier
description: "Parallel test and verification subagent that runs test suites, pre-commit checks, and verifies file modifications before merge."
models:
  antigravity: "inherit" # flash | flash_lite | pro | inherit
  claude: "haiku" # haiku | sonnet | opus
effort: "high" # low | medium | high
tools: ["run_command", "view_file"]
permissions: "terminal-read-exec" # read-only | terminal-read-exec | full-write
scope: structural # structural | personal
---
```

Multi-line list syntax is also fully supported by `scripts/Sync-Subagents.ps1`:

```yaml
tools:
  - run_command
  - view_file
```

### Field Definitions

| Field                | Type   | Required | Allowed Values                                  | Purpose                                                                  |
| -------------------- | ------ | -------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `name`               | string | Yes      | Lowercase alphanumeric with hyphens             | Unique subagent identifier.                                              |
| `description`        | string | Yes      | High-density sentence                           | Context pointer describing exactly when this subagent should be spawned. |
| `models.antigravity` | string | Yes      | `flash`, `flash_lite`, `pro`, `inherit`         | Model selection when running in Google Antigravity per ADR-0030.         |
| `models.claude`      | string | Yes      | `haiku`, `sonnet`, `opus`                       | Model selection when running in Claude Code per ADR-0030.                |
| `effort`             | string | Yes      | `low`, `medium`, `high`                         | Reasoning effort tier.                                                   |
| `tools`              | array  | Yes      | Canonical tool names                            | Minimal bounded tool array required for the role.                        |
| `permissions`        | string | Yes      | `read-only`, `terminal-read-exec`, `full-write` | Security isolation boundary.                                             |
| `scope`              | string | Yes      | `structural`, `personal`                        | Scope classification per CONTEXT.md.                                     |

---

## 2. Standard Body Sections

The markdown body must follow this exact three-section structure:

### Section 1: Role & Mission

Defines the single core responsibility of the subagent. What problem does it solve, and what is its specialization?

```markdown
## Role & Mission

High-speed codebase inspection specialist. Scans across dozens of files, verifies cross-references, validates frontmatter, and checks for stale links.
```

### Section 2: Spawn vs. Inline Policy

Every subagent must declare concrete mechanical boundaries for when it should be spawned versus when work should remain in the parent orchestrator.

```markdown
## Spawn vs. Inline Policy

- **When to Spawn:** Spawn when scanning >5 files, checking all links across a folder, or auditing frontmatter schema. Do not spawn for single-file grep.
- **Inline Threshold:** Execute directly in parent context if the operation takes <30 seconds or touches <=2 files.
```

### Section 3: Output Contract (Token Deflation Standard)

Subagents run in isolated contexts to keep the parent context clean. The output contract prevents context bloating when the subagent returns.

```markdown
## Output Contract (Token Deflation Standard)

- **Terse Synthesis:** Returns compact markdown summaries (max 400 words) directly to the parent orchestrator.
- **Evidence-First:** Cites specific file paths, line numbers, or external URLs.
- **No Parent Pollution:** Never dumps raw multi-page transcripts or unbounded search results into the parent context.
- **Overflow Spillover Protocol:** When diagnostic error traces or broken links exceed the 400-word ceiling, write full unvarnished logs to `scratch/<subagent>-failures.log` and return an indexed summary pointer with the top 3 critical issues to the orchestrator.
```

---

## 3. Tool Translation Matrix

Canonical subagent tools map mechanically to engine-specific capabilities:

| Canonical Tool         | Antigravity Tool       | Claude Code Tool | Description                                |
| ---------------------- | ---------------------- | ---------------- | ------------------------------------------ |
| `view_file`            | `view_file`            | `Read`           | View file content within slice windows.    |
| `grep_search`          | `grep_search`          | `Grep`           | Search text patterns across files.         |
| `find_by_name`         | `find_by_name`         | `Glob`           | Discover files and directories by pattern. |
| `list_dir`             | `list_dir`             | `Glob`           | List directory contents.                   |
| `run_command`          | `run_command`          | `Bash`           | Execute shell scripts and commands.        |
| `replace_file_content` | `replace_file_content` | `Edit`           | Precise contiguous block replacement.      |
| `write_to_file`        | `write_to_file`        | `Write`          | Write or overwrite whole file contents.    |
| `read_url_content`     | `read_url_content`     | `WebFetch`       | Fetch content from external web URLs.      |
| `search_web`           | `search_web`           | `WebFetch`       | Perform internet web queries.              |
