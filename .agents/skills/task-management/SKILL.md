---
name: "task-management"
description: "Capture work as a gated task card in tasks/ and query, audit, archive or rebuild the task list. Use when work is deferred, a to-do appears, or the user asks about task status."
category: flow
scope: "structural"
distribution: template
license: MIT
---

# Task Management: Capture, Route, Keep Clean

Owns the front and back of the task lifecycle: every action the user names (dishes, a memory audit, a the peer AIOS invoice review) becomes a task file in seconds, gets a `lane:` from the Delegation Gate, and the substrate stays valid. Execution belongs to [`next-action`](../next-action/SKILL.md); multi-slice decomposition of a spec belongs to [`task-scoping`](../task-scoping/SKILL.md). Governing canon: [`standards/tasks-standard.md`](../../../standards/tasks-standard.md), [ADR-0065](../../../decisions/0065-task-lifecycle-consolidation-and-delegation-gate.md).

## 1. Capture (target: under 10 seconds)

| Input shape                           | Command                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Clear action, any domain              | `pwsh -NoProfile -File scripts/New-Task.ps1 -Name "<Verb-first title>" -Content "<why + Done when>"`       |
| Loose thought, routing unknown        | `pwsh -NoProfile -File scripts/Capture-Thought.ps1 -Content "<text>"` (add `-TriageToTask` to promote now) |
| A spec, brief, or multi-slice feature | Hand off to [`task-scoping`](../task-scoping/SKILL.md)                                                     |
| the peer AIOS action                  | Task lives in `the peer AIOS\tasks\` (Mode 03, write needs confirmation); never in this repo               |

Scoping rules applied at capture, every time:

1. **Verb-first title**, one outcome. An "and" in the title means two tasks.
2. **`## Done when`: 3 to 6 falsifiable claims**, each naming its probe (command, file, exit code, observable state). Physical tasks name an observable end state ("sink empty, dishes racked").
3. **`scope: personal`** for the user's life, hardware, money, health; `structural` for reusable AIOS tooling.
4. **Priority `Medium`** unless the user says now (`High`) or it blocks the system (tasks-standard §2). `Now`, `Next` and `Someday` are retired words.

`New-Task.ps1` runs the Delegation Gate on the new file and prints the lane plus any failing gate. Read that line; it decides the next move.

**Same-turn status sync (the user's standing rule):** Before doing work, check `tasks/` for the matching card (store cascade step 2). The turn that completes, supersedes, or re-scopes work updates that card in the same turn: Done via `scripts/Complete-Task.ps1 -TaskFile <slug> -Resolution "..."`, superseded via `status: Retired` plus a `## Resolution` block, scope change via edited `## Done when` gates. A finished item still reading `Not started` is a defect; the user never asks for status updates.

## 2. Route: the Delegation Gate

The gate stands in for "Leonidas matches or beats the user's quality with 90%+ confidence". Five checks, each can fail; definitions and heuristics in [`standards/tasks-standard.md`](../../../standards/tasks-standard.md) §9 and [`scripts/Test-TaskGate.ps1`](../../../scripts/Test-TaskGate.ps1).

| Lane       | Meaning                                                     | Immediate move                                                     |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `hermes`   | All gates pass; small, mechanical or read-heavy             | Queued for the next Hermes batch in `/next-action`                 |
| `leonidas` | All gates pass; multi-file or canon work                    | Eligible for the session-start execution loop                      |
| `grill`    | Done when or quality bar unclear (G1/G2)                    | Offer a `/grill-me` capped at 3 questions on the failing gate only |
| `draft`    | Needs permission per [`INTENT.md`](../../../INTENT.md) (G3) | Leonidas prepares everything; the user approves                    |
| `human`    | Physical or human-only (G4)                                 | Timed checklist, batched with nearby chores                        |

Check or re-check one task: `pwsh -NoProfile -File scripts/Test-TaskGate.ps1 -TaskFile <slug>.md`. Override with `-Lane` on `New-Task.ps1` only when the user says so.

**Grill protocol (lane `grill`).** Ask at most 3 questions, each aimed at the failing gate ("what proves this is done?", "whose standard judges it?"), using the [grilling](../grilling/SKILL.md) option format. Write the answers into the task's `## Done when`, re-run the gate, and continue with the new lane. If the user is away, the task keeps `lane: grill` and surfaces in the next `/next-action` grill batch.

## 3. Query

```powershell
pwsh -NoProfile -File scripts/skills/task-management/Invoke-TaskManagement.ps1 -Action NextAction
pwsh -NoProfile -File scripts/Get-Tasks.ps1 -Priority Critical
pwsh -NoProfile -File scripts/Get-Tasks.ps1 -Status 'Awaiting Review'
```

## 4. Hygiene (absorbs the retired task-auditor)

**Full health sweep (the one command to run):** `python scripts/task-health-sweep.py`. It writes `audits/<date>-task-health.md` and exits 0 only when the substrate is clean. Work the buckets in this order:

1. **Finished but not closed:** re-run the task's probes; if they hold, `Complete-Task.ps1`.
2. **Duplicate candidates:** merge the newer into the older (move its unique claims), then retire the newer to `archive/` per the deletion ladder.
3. **Retire candidates** (Not started 30+ days, or `due:` passed): ask the user in one batch: keep, or retire.
4. **Scoping defects:** rewrite `## Done when` to 3 to 6 probe-named claims; if the claim can't be written, set `lane: grill`.
5. **Needs the user** (grill, draft, human lanes, Blocked, stale Awaiting Review): group them into one `/grill-me` round (at most 3 questions) and one approvals list.

Then re-run the sweep until it reports `CLEAN` or every item left is waiting on the user.

**End-to-end pipeline** (intake, scope, gate, delegate, close; the repeatable path for high-volume card work): [`workflows/task-pipeline.md`](../../../workflows/task-pipeline.md).

**Whole-list burndown** ("take my tasks to zero", "delegate my tasks across engines"): follow [`references/burndown.md`](./references/burndown.md) (truth pass, one grill, engine routing, themed session prompts).

| Need                                                      | Command                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Schema, enum, link, cycle, staleness, aging-capture audit | `pwsh -NoProfile -File scripts/Audit-Tasks.ps1`                              |
| Re-gate every open task (dry run; add `-Apply` to write)  | `pwsh -NoProfile -File scripts/Test-TaskGate.ps1 -All`                       |
| Send-back rate per lane (demotes types above 10%)         | `pwsh -NoProfile -File scripts/Test-TaskGate.ps1 -Report`                    |
| Archive Done tasks older than 14 days                     | `pwsh -NoProfile -File scripts/Archive-CompletedTasks.ps1 -DaysOld 14 -Live` |
| Rebuild `tasks-index.md` and `TASKS.md`                   | `pwsh -NoProfile -File scripts/Build-TasksIndex.ps1`                         |
| Review gate results the script could not decide           | `tasks/_staged/review-queue.md`                                              |

Remediation: broken `project:`/`blocked_by` path, fix the relative path; circular block, cut the downstream edge; aging capture, triage with `Capture-Thought.ps1 -TriageToTask`.

## Done when

- [ ] Every new task came from `New-Task.ps1` (or `task-scoping`) and carries a `lane:` value.
- [ ] Every new task has 3 to 6 probe-named `Done when` claims, or `lane: grill` explaining why not.
- [ ] `python scripts/task-health-sweep.py` reports `CLEAN`, or only the user-owned items remain.
- [ ] Every card completed or superseded this session was updated in the same turn (`Complete-Task.ps1` / `Retired` + `## Resolution`), never left as `Not started`.
- [ ] Index rebuilt and the change committed with a `Task:` prefix.
