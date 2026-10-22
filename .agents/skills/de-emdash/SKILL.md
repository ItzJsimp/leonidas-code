---
name: de-emdash
description: "Scan documents and rewrite U+2014 em dashes into clean, fluent punctuation per ADR-0012 standards."
category: knowledge
scope: structural
distribution: core
type: skill
id: skill-de-emdash
title: "De-Emdash : Natural Punctuation & Sentence Flow Rewriter"
kind: procedure
load: on-demand
owner: shared
verified: 2026-08-22
related: ["skills-index", "technical-writing", "soul"]
generated: false
disable-model-invocation: true
license: MIT
---

# De-Emdash : Natural Punctuation & Flow Rewriter

## Purpose

Eliminate em dashes (`-`) across documentation, skill definitions, scripts, and metadata by rewriting sentences naturally rather than performing crude regex substitution.

Mechanical replacement of `: ` with `-` or spaces causes disjointed, robotic prose. This skill enforces human-grade sentence flow using commas, colons, parentheses, conjunctions, or concise sentence splits.

---

## Rewriting Guide

| Context                         | Em Dash Pattern                          | Natural Rewrite Strategy          | Example                                                                           |
| ------------------------------- | ---------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| **Parenthetical thought**       | `The system, which runs on D:, is fast.` | **Commas or parentheses**         | `The system, which runs on D:, is fast.` or `The system (running on D:) is fast.` |
| **Amplification / explanation** | `We chose local files, they are faster.` | **Colon or semicolon**            | `We chose local files: they are faster.`                                          |
| **Abrupt shift / contrast**     | `The design works, but has bugs.`        | **Conjunction or sentence split** | `The design works, but has bugs.`                                                 |
| **Table separators / metadata** | `Title, Description`                     | **Colon, pipe, or hyphen**        | `Title: Description` or `Title \| Description`                                    |

---

## Procedure

1. **Inventory:** Run `pwsh -File scripts/Find-EmDashes.ps1` to list all files and line numbers containing em dashes.
2. **Batch Rewrite:** Process target files section-by-section, rewriting sentences to read crisply and naturally.
3. **Verify Flow:** Ensure sentences maintain 6th–8th grade readability and clear cadence per `memory/soul.md`.
4. **Reconcile:** Re-run index generator and commit.
