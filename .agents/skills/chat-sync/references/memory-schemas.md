---
type: reference
id: ref-memory-schemas
title: "Chat Sync: Memory Schemas and Types"
description: Complete frontmatter schema, taxonomy types, and pointer formatting for AIOS durable memory files.
kind: state
load: reference
owner: leonidas
scope: structural
verified: 2026-08-30
related: ["skill-chat-sync", "memory-durable"]
generated: false
---

# Memory Schemas & Taxonomy Reference

Authoritative schema definitions for files stored in [`memory/`](../../../../memory/memory-index.md) and listed in the generated [`memory/memory-index.md`](../../../../memory/memory-index.md).

## Memory Frontmatter Schema

Every durable memory file under `memory/<slug>.md` must contain valid YAML frontmatter:

```yaml
---
name: <kebab-case-slug>
description: "<one-line dense summary, max 25 words>"
metadata:
  type: decision | preference | feedback | system | reference
  scope: personal | structural
verified: YYYY-MM-DD
---
# Title of Memory

Dense body content capturing durable facts, architectural patterns, or standing preferences.
```

## Taxonomy Types

| Type         | Definition                                                            | Example                                                             |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `decision`   | Settled architectural choice or operational boundary                  | [`no-clear-command.md`](../../../../memory/no-clear-command.md)     |
| `preference` | Operator habits, style guides, and interaction preferences            | Editor layout, naming preferences                                   |
| `feedback`   | Direct operator correction or operational rule learned from a failure | [`verify-dont-assume.md`](../../../../memory/verify-dont-assume.md) |
| `system`     | Persistent hardware, network, or environment facts                    | [`pc-system-profile.md`](../../../../memory/pc-system-profile.md)   |
| `reference`  | Standing technical specifications or lookup patterns                  | [`prompt-caching.md`](../../../../memory/prompt-caching.md)         |

## Index Entry (generated)

There is no hand-kept pointer list (retired per ADR-0063). [`scripts/Build-Index.ps1`](../../../../scripts/Build-Index.ps1) builds [`memory/memory-index.md`](../../../../memory/memory-index.md) from each file's frontmatter `description:`, so the description is the pointer.

### Description Rules

1. **Single Line:** One sentence, no line wraps.
2. **Dense Description:** Under 30 words, written so a zero-context engine can decide whether to open the file.
3. **No Em Dashes:** Strict Zero Em-Dash enforcement applies to all descriptions and links.
