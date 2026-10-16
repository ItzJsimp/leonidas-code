READ-ONLY audit of task cards in git repo `<repo root>`. Never edit, create, stage, or commit anything inside the repo. The ONLY file you write is your result file (outside the repo), via Bash.
Finish in one pass. Run no background or detached commands: every late completion notice costs the parent chat a full context re-read. Use the Grep tool for repo-wide search, not `grep -r` in Bash.

Input: task paths (repo-relative, one per line) in `%TEMP%/taskaudit/chunkN.txt` (N given in your prompt). All currently Not started / In progress / Blocked / Awaiting Review.

For EACH task:

1. Read the card (frontmatter + `## Done when`).
2. Verify against reality: `git log --oneline --since=2026-08-01 -i --grep "<distinctive keyword>"`, `git log --oneline -- <path>` for files the gates name, existence of named files/scripts/functions/config keys (Glob/Grep), any `## Resolution`, superseding task or ADR (grep `decisions/` and `tasks/`). Max ~4 tool calls per task; batch git greps for several tasks in one Bash call.
3. Classify: DONE (every gate demonstrably holds, cite evidence) | PARTIAL (name gates that hold + evidence) | SUPERSEDED (cite what made it moot) | OPEN. Personal/physical tasks you cannot verify: OPEN, note "jake-verify".
4. Scope: OK if 3-6 falsifiable Done-when claims each naming a probe. Else VAGUE or NO-GATES with proposed gates (max 3, semicolon-separated).

Checkpoint: after every ~10 tasks, append completed rows to `%TEMP%/taskaudit/resultN.md` via Bash heredoc (append, never overwrite), so progress survives interruption. On start, if resultN.md already exists, skip slugs already in it.

Final file format (and also return it, under 1200 words):

## Status changes

| slug | verdict | evidence | gates now true | (DONE/PARTIAL/SUPERSEDED only)

## Scope fixes

| slug | defect | proposed gates | (non-OK only)

## OK-OPEN

comma-separated slugs.
Be conservative: unsure means PARTIAL or OPEN.
