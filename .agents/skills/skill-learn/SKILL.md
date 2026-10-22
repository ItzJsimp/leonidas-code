---
name: "skill-learn"
description: "Turn a doc, past chat or notes into a proposed skill, or use /skill-learn tune to propose fixes from repeated corrections. Apply only accepted changes; select the drafting model per batch."
disable-model-invocation: true
category: system
scope: "structural"
distribution: core
license: MIT
---

# Skill Learn

Hermes reserves `/learn`; this shared command is `/skill-learn <source>` or `/skill-learn tune`.

Hermes reserves `/learn`; this shared command is `/skill-learn <source>` or `/skill-learn tune`.

Hermes reserves `/learn`; this shared command is `/skill-learn <source>` or `/skill-learn tune`.

Draft first. Write canonical skills only after the user accepts each proposal.

## Skill Learn from a source

1. Read the supplied file, URL, notes or past conversation. Use the available session search for past chats.
2. Extract a repeatable procedure: trigger, steps and observable result. A fact without a procedure belongs in memory.
3. Check [existing skills](../skills-index.md) for overlap. If an existing skill covers most of the procedure, propose an edit to it.
4. Draft using [skill-creator](../skill-creator/SKILL.md): quoted name/description, category from [_categories.json](../_categories.json), scope, distribution, numbered workflow and checkable completion criteria.
5. Show the exact draft, proposed path and distribution. Ask accept, edit or reject through the available structured question tool.
6. On acceptance, write the skill, run [skill sync](../../../scripts/Sync-AgentSkills.ps1), [substrate audit](../../../scripts/Audit-Substrate.ps1) and [index rebuild](../../../scripts/Build-Index.ps1), then commit the accepted change. Keep unrelated check failures explicit.

## Tune existing skills

1. Run `python scripts/Collect-SkillSignals.py --ready`. The [collector](../../../scripts/Collect-SkillSignals.py) scans supported Claude transcripts for this AIOS. Three distinct sessions qualify a skill for evidence review. Signals are leads, not proof of a skill defect. If none qualify, report the watch list and stop.
2. Ask which skills to review and which model to use for this batch. Use this chat or an authorized connected model; choose no preset nightly or session-end model.
3. Read `python scripts/Collect-SkillSignals.py --show <skill>` and the skill itself. Check the original sessions. Discard corrections about the project, answers to interview questions and unsupported attribution. Find a repeated instruction-level failure.
4. Draft the smallest change: exact current lines, replacement lines and evidence from multiple sessions. Save `logs/skill-proposals/<date>-<skill>.md` with status `proposed`, drafting model, selected signal IDs and source sessions.
5. Ask accept or reject for each proposal. On acceptance, apply only the reviewed diff, verify it and commit it. On failed verification/application, leave the proposal and signals pending.
6. After successful acceptance or rejection, run `python scripts/Collect-SkillSignals.py --consume <skill> --ids <reviewed-id,reviewed-id>` and update proposal status. Consume only the evidence reviewed in this batch.

Claude SessionEnd collects signals without model calls. Other providers can run the collector manually against supported stored transcripts; Codex and app-owned transcript adapters are not implemented yet.

## Done when

- [ ] Every canonical skill change was accepted by the user and committed separately.
- [ ] Each proposal records the exact diff, model and evidence IDs.
- [ ] Only reviewed evidence is consumed after a successful decision.
- [ ] Verification results distinguish this change from unrelated repository failures.
