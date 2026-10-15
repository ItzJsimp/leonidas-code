---
name: output-style-builder
description: "Author, audit, and calibrate Claude Code output styles for tone, density, and formatting rules."
category: agents
scope: structural
distribution: core
disable-model-invocation: true
---

An output style rewrites Claude Code's system prompt. That makes it the
strongest lever in the harness and the easiest one to break something with,
because a style that omits one frontmatter field silently deletes Claude Code's
entire software engineering instruction set.

Platform facts, version gates, and troubleshooting live in
[`MECHANICS.md`](./MECHANICS.md). Read it before authoring, and whenever a
style does not appear or does not take effect.

## The placement decision, first

Before writing a style, confirm a style is the right home. Wrong-surface
placement is the most common failure, and no amount of good prose fixes it.

| The behaviour is                                  | Home                                      | Reason                                    |
| ------------------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| How Claude sounds and shapes every response       | **Output style**                          | System-prompt level, applies every turn   |
| Facts about this repo, its conventions, its paths | **`CLAUDE.md` / canon**                   | Styles are voice, never project knowledge |
| Needed by Antigravity too                         | **Canon** (`memory/soul.md`, `AGENTS.md`) | Styles are Claude Code only               |
| A repeatable workflow with steps                  | **Skill**                                 | Loaded on invocation, not every turn      |
| Needed by subagents                               | **The agent definition**                  | Styles never reach subagents              |

Two consequences worth stating plainly, because both surprise people:

- **Styles do not reach subagents.** Each subagent runs its own system prompt.
  A `fork` is the single exception, since it inherits the parent's prompt.
- **Styles are Claude Code only.** Anything that must hold on Antigravity goes
  in canon. A style may reinforce canon; it may not be canon's only home.

## Authoring sequence

1. **Name the one behaviour** the style changes. A style with two unrelated
   goals is two styles. Write the goal as a single sentence before any prose.
2. **Set `keep-coding-instructions: true`** unless the style genuinely does no
   engineering. See the strip test below.
3. **Write mechanical rules, never adjectives.** This is the highest-leverage
   authoring move and the one most styles get wrong.
4. **Name what the style overrides.** A style that changes response shape
   collides with the base contract in canon. State which parts it suspends, so
   the collision is a decision instead of a coin flip.
5. **Add the honesty floor.** See false brevity below.
6. **Validate**, then activate. Both procedures are in
   [`MECHANICS.md`](./MECHANICS.md).

## Mechanical rules beat adjectives

An output style is followed in proportion to how checkable its rules are. "Be
concise" is an adjective the model grades itself against, so adherence drifts.
"One line per point, no preamble sentence" is mechanical: the model can tell
whether it complied.

Convert every adjective into a countable or observable rule:

| Adjective      | Mechanical rule                                                          |
| -------------- | ------------------------------------------------------------------------ |
| Be concise     | One line per point. No preamble sentence.                                |
| Be direct      | Lead with the conclusion. State the recommendation before the reasoning. |
| Be thorough    | Every modified file accounted for in the summary.                        |
| Show your work | Every claim carries the command or `file:line` that proves it.           |
| Be visual      | Open with a Mermaid diagram under 15 nodes.                              |

The test: could a reader diff a response against the rule and agree on whether
it passed? If two careful readers would disagree, the rule is an adjective
wearing a costume, and it needs rewriting.

## The strip test

`keep-coding-instructions` defaults to `false`, which means a custom style
**replaces** Claude Code's built-in engineering instructions: how to scope a
change, how to verify work, how to handle edits safely.

Set it `true` when the style does any engineering at all. Omit it only when the
style genuinely does none, such as a pure writing, journaling, or analysis
persona that never touches code.

Degraded scoping or skipped verification after a style change is the signature
of a missing `keep-coding-instructions: true`. Check the frontmatter first.

## False brevity

A terse style that also drops failures, caveats, and unverified numbers has not
become concise, it has become dishonest. Brevity is a word-count constraint,
never a truth constraint.

Every style that compresses output carries an explicit honesty floor naming
what survives compression at full length:

- Failures and errors, stated plainly, never softened into progress.
- Skipped or unfinished steps, named as skipped.
- Numbers that were not verified, marked as unverified.
- Destructive-action confirmations and security warnings, complete.

Write the floor as its own heading in the style. A compression rule without one
will eventually hide a real failure behind a short sentence.

## Prompt the positive

State the target behaviour rather than banning its opposite. A prohibition
drags the forbidden behaviour into context and makes it more available, so a
ban half-reads as an instruction.

Write "lead with the conclusion" over "don't bury the lede." Reserve
prohibitions for hard guardrails that resist positive phrasing (the em-dash ban
is one), and pair each with its positive target so attention lands on the
action rather than the elephant.

## Auditing a roster

When asked what styles are missing or whether the current set is right, work
these four checks in order:

1. **Overlap.** Two styles whose rules mostly agree are one style with a
   toggle. Merge them; a picker full of near-duplicates is decision fatigue,
   and the style that never gets picked is dead weight.
2. **Coverage.** Map styles against actual recurring work. A style with no
   recurring situation behind it will never be selected.
3. **Collision.** Read each style against the base contract in canon. Every
   contradiction is either an explicit override or a bug.
4. **Strip audit.** Any style missing `keep-coding-instructions: true` that
   does engineering is silently degrading the agent. This check is mechanical,
   so run it every time.

## Done when

1. Frontmatter parses, and `name` matches what will be written to `outputStyle`
   exactly, including case.
2. `keep-coding-instructions` is set deliberately, with the strip test applied.
3. Every rule is mechanical, and no adjective survives ungrounded.
4. Any compression rule carries an honesty floor.
5. Overrides against canon are named explicitly in the style body.
6. The style appears in the picker, verified by the procedure in
   [`MECHANICS.md`](./MECHANICS.md).
