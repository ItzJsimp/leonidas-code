---
name: primary-research
description: "Investigate a question against high-trust primary sources and capture findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent."
category: research
scope: structural
distribution: core
type: skill
id: skill-primary-research
title: "Primary Research"
kind: procedure
load: on-demand
owner: shared
verified: 2026-09-28
source: "https://github.com/mattpocock/skills (skills/engineering/research, MIT, commit c55ee46)"
---

# Primary Research

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it where the repo already keeps such notes; match the existing convention, and if there is none, put it somewhere sensible and say where.
