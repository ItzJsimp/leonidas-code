# Google Antigravity Subagent Reference

This document covers subagent definition, invocation, runtime bridging, and lifecycle management in **Google Antigravity**.

---

## 1. Antigravity Subagent Architecture & Discovery Reality

In Google Antigravity, subagents run concurrently in the background. They do not block the parent orchestrator unless the parent explicitly waits. The orchestrator receives notifications automatically upon subagent completion.

**Discovery Reality:** Unlike Claude Code, Google Antigravity does not automatically scan `.agents/subagents/*.md` from disk at startup. Antigravity discovers workspace rules (`AGENTS.md`, `GEMINI.md`) and skills (`.agents/skills/*/SKILL.md`), but its subagent execution mechanism is runtime-driven:

1. **Built-in System Subagents:** `self` (inherits full parent context and tools) and `research` (read-only research tools).
2. **Dynamic In-Session Registration:** Defined on the fly via `define_subagent` and executed via `invoke_subagent`.

To bridge this gap, AIOS compiles all canonical subagents into `.agents/subagents/manifest.json` and provides the `scripts/Get-SubagentPayload.ps1` tool to output ready-to-run runtime payloads.

---

## 2. Runtime Payload Generation (`Get-SubagentPayload.ps1`)

To obtain the exact JSON payload for a subagent:

```powershell
pwsh scripts/Get-SubagentPayload.ps1 -Name verifier -Action invoke
```

Or for both `define_subagent` and `invoke_subagent`:

```powershell
pwsh scripts/Get-SubagentPayload.ps1 -Name verifier -Action both
```

---

## 3. Dynamic Definition API (`define_subagent`)

Use `define_subagent` when a specialized subagent type is needed for the duration of a session:

```json
{
  "name": "custom_auditor",
  "description": "Specialized auditor for validating complex AST graph nodes.",
  "system_prompt": "You are an expert AST auditor...",
  "enable_write_tools": false,
  "enable_subagent_tools": false,
  "enable_mcp_tools": false
}
```

### Parameter Guidelines

- `enable_write_tools`: Set to `false` for read-only research and inspection subagents to enforce zero risk of unapproved mutations.
- `enable_subagent_tools`: Keep `false` unless building recursive swarm topologies.
- `enable_mcp_tools`: Enable only when subagents require external tool integrations.

---

## 4. Invocation API (`invoke_subagent`)

Subagents are launched using the `invoke_subagent` tool:

```json
{
  "Subagents": [
    {
      "TypeName": "self",
      "Role": "AIOS Subagent: verifier",
      "Prompt": "Execute drift detection and verify zero em-dash compliance...",
      "Model": "flash",
      "Workspace": "inherit"
    }
  ]
}
```

### Model Selection Parameters

- `inherit` (default): Inherits the parent agent's active model.
- `flash`: Gemini 3.8 Flash (recommended default for swarms, parallel research, and linting per ADR-0030).
- `flash_lite`: Gemini 3.6 Flash (high-speed, lowest cost, for pure indexing and grep sweeps).
- `pro`: Gemini 3.1 Pro (heavy reasoning, formal proof verification, or mega-context analysis).

### Workspace Isolation Modes

- `inherit` (default): Operates directly within the current parent workspace directory.
- `branch`: Creates a new isolated workspace cloned from parent.
- `share`: Shares the parent repository directory without duplicating storage (worktree style).

---

## 5. Lifecycle Management (`manage_subagents`)

The parent orchestrator manages subagent swarms via `manage_subagents`:

- `Action: "list"`: Inspects active subagents, conversation IDs, and lifecycle states (`running`, `idle`, `errored`).
- `Action: "kill"`: Terminates specific subagents by ConversationId.
- `Action: "kill_all"`: Kills all active child subagents and deletes branched workspaces.
