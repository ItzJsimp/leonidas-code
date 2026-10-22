---
name: pc-incident-forensics
description: "Investigate PC crashes, BSODs, freezes, and app faults via Event Viewer, minidumps, and system logs."
category: pc
scope: personal
distribution: private
disable-model-invocation: true
license: MIT
---

<!-- package: skip (code-only) -->

**Last updated:** 2026-08-15

# PC incident & crash forensics

Evidence-first. Read logs and dumps before forming an opinion. Report a confidence level with every conclusion.

Read [`skills/_shared/pc-machines.md`](../_shared/pc-machines.md) first.

**Route away:** routine health scoring → [`pc-systems-engineer`](../pc-systems-engineer/SKILL.md). Low FPS or stutter with no crash → [`game-optimization`](../game-optimization/SKILL.md). Stream-only glitches → [`remote-streaming-sync`](../remote-streaming-sync/SKILL.md).

**Open incidents are live state, never cached here.** Read the hub's Pending Review and Known Standing Issues before starting, a new crash may share a root cause with something already open. A previous version of this exact skill hardcoded "C: at ~4% free" as a standing cause; it went stale the moment the real number changed and nobody updated the skill file. Don't repeat that, always re-read live.

## Procedure

# ## Phase 1 : Fix the timeline

Get the approximate incident time and what was running. Without a timestamp you are reading noise. An unexpected shutdown always leaves an Event 41, pull it if Jake doesn't know the time, and **read its properties, not just that it fired**: a non-zero `BugcheckCode` means a blue screen with a dump to read; zero code with `PowerButton = False` points at power, thermal, or a hard hang, a different investigation entirely.

# ## Phase 2 : Pull the evidence (read-only, 🟢)

Critical/error events either side of the incident window, application faults (Event 1000/1001/1002), storage reliability counters, minidumps in `C:\Windows\Minidump`, and WHEA-Logger hardware errors. Exact commands live in the Toolkit.

# ## Phase 3 : Read the signal, in priority order

| Evidence                     | Meaning                                            | Confidence                 |
| ---------------------------- | -------------------------------------------------- | -------------------------- |
| WHEA-Logger error            | Genuine hardware fault, names the component        | Very high                  |
| Minidump with a driver name  | That driver, or what it talks to                   | High                       |
| Event 41, bugcheck 0         | Hard power event, PSU, thermal, or a dumpless hang | Medium, cause unknown      |
| Climbing wear or read errors | Failing storage                                    | High                       |
| Event 1000 naming a module   | App-level fault                                    | Medium                     |
| Nothing in any log           | Almost always power, thermal, or a hard hang       | Low, needs live monitoring |

# ## Phase 4 : Rank causes honestly

At most three candidates, each with the specific evidence line, a confidence level (Likely / Possible / Unlikely), and the single cheapest test that would confirm or eliminate it. Never present one cause as certain unless a WHEA error or a clean minidump names it. "The logs do not tell us" is a valid conclusion.

# ## Phase 5 : Write the incident report

One file per incident: `D:\2-Life\Ongoing Areas\PC Audit\Incidents\<YYYY-MM-DD>-<slug>.md`

```markdown
# Incident: <what happened> : <date>

**Machine:** <hostname>
**Time:** <timestamp>
**Running at the time:** <apps/games>
**Symptom:** <what Jake observed>

## Evidence

- <event id / dump / counter, with the actual value>

## Candidate causes

| Cause | Confidence | Supporting evidence | Test to confirm |

## Verdict

<one paragraph>

## Action taken

<what changed, or "none, monitoring">

## Status

Open / Monitoring / Resolved <date>
```

Stays **Open** until a repeat is observed or ruled out over a defined period. Never mark resolved because a change was made, only because the symptom stopped.

## The common traps

- Event 41 is not a cause, it only means Windows was not shut down cleanly.
- Correlation is not attribution, a driver in a dump is often the victim, especially graphics drivers.
- Do not run a memory test first, it takes hours and is usually negative. Run it when WHEA or a bugcheck pattern points at memory, and note the desktop's mixed RAM kit is a legitimate above-baseline suspect.
- A nearly-full `C:` causes weird failures, rule it in or out early, checking the live figure, never a remembered one.
- One change at a time, or you learn nothing from the outcome.

## Output

1. **What happened**: one line, plain language.
2. **What the evidence says**: the two or three log lines that matter, quoted with real values.
3. **Ranked causes**: max three, each with a confidence level.
4. **Next test**: exactly one, the cheapest that discriminates between the top two.
5. **Report path**: where the incident file was written.

## Quality rules

1. Never name a cause without quoting the evidence for it.
2. Never say "resolved" without a clean observation period.
3. Never recommend a reinstall, BIOS flash, or hardware purchase as a first response.
4. Never batch diagnostic changes.
5. If the logs are silent, say so, an honest "unknown, here's how we catch it next time" beats a confident wrong answer.
