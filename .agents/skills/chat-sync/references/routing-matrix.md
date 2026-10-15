---
type: reference
id: ref-chat-sync-routing
title: "Chat Sync: Detailed Routing Matrix"
description: Granular routing rules, collision handling, conflict resolution, and cross-repo boundaries for chat-sync.
kind: state
load: reference
owner: leonidas
scope: structural
verified: 2026-08-30
related: ["skill-chat-sync", "standard-frontmatter"]
generated: false
---

# Chat Sync Detailed Routing Matrix

Authoritative routing reference for mapping extracted conversation artifacts to target files in AIOS.

## Granular Destination Map

| Extracted Item                                     | Target Destination                                                                                  | Execution Method                   | Gating Tier                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------- |
| Standing preference, durable decision, or feedback | `memory/<slug>.md` (indexed by [`memory/memory-index.md`](../../../../memory/memory-index.md), gen) | `pwsh scripts/New-Memory.ps1`      | 🔴 Approval Queue                                        |
| Actionable operational task                        | `tasks/<slug>.md`                                                                                   | `pwsh scripts/New-Task.ps1`        | 🟢 Auto-write (if unambiguous) / 🔴 Queue (if ambiguous) |
| Active project outcome or milestone                | `projects/<slug>/project.md`                                                                        | In-place file update               | 🟢 Auto-write                                            |
| Domain terminology definition                      | [`CONTEXT.md`](../../../../CONTEXT.md)                                                              | Inline glossary update             | 🟢 Auto-write                                            |
| Architectural decision record (ADR)                | `decisions/000N-<slug>.md`                                                                          | `pwsh scripts/New-ADR.ps1`         | 🔴 Approval Queue                                        |
| Code or script implementation                      | Target codebase file                                                                                | Direct file edit + Git commit      | 🟢 Auto-write (per ADR-0010)                             |
| Unresolved thought or quick capture                | `capture/`                                                                                          | `pwsh scripts/Capture-Thought.ps1` | 🟢 Auto-write                                            |
| Stale or drifted canon document                    | Read-only flag in sync output                                                                       | Surface staleness flag             | Read-Only (Never auto-edit canon)                        |

## Collision & Conflict Resolution Rules

1. **Existing Memory Slug:** If a memory slug matches an existing file under `memory/`, inspect the existing content. If the new decision updates or refines the existing fact, run `scripts/New-Memory.ps1 -Update`. Never generate duplicate files (`slug-2.md`).
2. **Contradictory Memories:** If a new decision contradicts a prior memory, overwrite the prior memory in place, document what changed in the file body, and update its `description:`.
3. **Cross-Repository Boundary:** Never write personal memory or Leonidas tasks into `D:\SimplyGersi AIOS\`. Cross-repo interactions operate strictly through Mode 3 per [ADR-0008](../../../../decisions/0008-mode-3-is-a-cross-repo-read-overlay.md) with explicit operator confirmation.

## Staleness Confidence Scoring

When flagging drifted canon files in Step 2:

- **Confidence 1 (Low):** Minor phrasing drift or optional convention update.
- **Confidence 2 (Medium):** Process steps or referenced tooling evolved during the session.
- **Confidence 3 (High):** Document contradicts a newly locked architecture or file path.
