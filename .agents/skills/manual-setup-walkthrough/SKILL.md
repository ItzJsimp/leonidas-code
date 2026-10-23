---
name: manual-setup-walkthrough
description: "Generate interactive CLI walkthroughs and verification scripts for complex manual operator setups."
category: code
scope: structural
distribution: core
type: skill
id: skill-manual-setup-walkthrough
title: "Wizard : Interactive Setup & Step-by-Step CLI Guide Generator"
kind: procedure
load: on-demand
owner: shared
verified: 2026-08-22
related: ["skills-index", "powershell-master", "master-instructions"]
generated: false
disable-model-invocation: true
license: MIT
---

# Wizard Skill

## Purpose

When an installation, account authentication, driver update, or environment configuration requires manual human steps, `/manual-setup-walkthrough` creates an interactive, foolproof script (PowerShell/Bash) or a structured step-by-step checklist that guides the operator without confusion.

---

## Script Design Standards

1. **Pre-flight Checks:** Verify administrative elevation, execution policies, required binaries, and paths before starting.
2. **Pause for Human Action:** When the operator must perform an external action (e.g. logging into a web portal, copying an API key), prompt with `Read-Host "Press Enter once complete..."`.
3. **Automated Verification:** Test each step immediately after completion before moving to the next.
4. **Graceful Error Recovery:** Provide exact corrective instructions if a step fails rather than crashing unhandled.

---

## Output Contract

Generates an executable script in `scripts/manual-setup-walkthroughs/<manual-setup-walkthrough-name>.ps1` or displays a clear interactive console walkthrough.
