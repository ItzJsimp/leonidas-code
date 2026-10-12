---
name: next-action
description: "Recommend up to five ready tasks from the current project or AIOS, matched to the operator, energy, time, and focus. Use for next action or what should I work on."
category: flow
scope: structural
distribution: core
---

# Next Action

Discover the current project's real tasks, offer a quick optional intake, and present up to five grounded choices with an execution recommendation. Recommendation alone does not authorize starting work or launching agents.

## Resolve scope first

Use the active thread workspace, not the skill installation directory. Read its instructions and project brief. Identify the operator from the active user's canon or explicit message; OS and Git usernames are hints, not identity proof. Pass a confirmed operator with `--user`.

Run the [resolver](./scripts/resolve_tasks.py):

```sh
python <skill-folder>/scripts/resolve_tasks.py --workspace <active-workspace> --rank --user <operator>
```

It checks the workspace and bounded ancestors for a task store and validates its relative cache. In an AIOS project it scopes the parent store to that project. Project views are read paths; update the canonical card. Use `--tasks-dir` for an explicitly configured external store, `--project` for a confirmed project slug, and `--all-projects` only when the user chooses broader scope. A missing store or zero matching tasks is a discovery result, never permission to substitute another project's backlog.

For a standalone checkout, inspect the project instructions for its configured task source. If the project uses shared GitHub Issues, read open issues from the declared repository with the available connector or `gh issue list`, then inspect candidate issue bodies for readiness and assignment. Report access errors accurately. Do not scan another user's private AIOS to fill gaps. If Python is unavailable, inspect the local cache and workspace/ancestor task folders directly, apply the same project and status filters, and disclose the fallback.

## Quick intake

Preserve preferences already supplied; ask only missing questions. Explicit skip means no intake. Otherwise ask sequentially with the active provider's available interactive question tool (`ask_question`, `request_user_input_async`, or equivalent), using its actual schema. If unavailable, show one compact numbered choice in chat. Await each answer before asking the next question; a preselected option or elapsed time is not an answer.

Ask two to four short questions, normally energy, time, and focus. Add execution preference only when it would change the recommendations. On the first question put **Skip all: recommend for me** first; choosing it ends all remaining intake. Each later question starts with **Recommend for me**, preserving earlier answers.

- Energy: Skip all / Low: quick wins / Medium: focused slice / High: deep work.
- Time: Recommend / 15 minutes / 45 minutes / 90+ minutes.
- Focus: Recommend within current project / two real areas found in its tasks / choose another project or domain. In an AIOS root, use actual projects or domains rather than assuming code work.
- Execution, when useful: Recommend / Work here / Prepare fresh-chat prompt / Consider delegation.

Prefer the tool's supported option limit. If only three options are supported, combine medium/high as a focused-work choice and accept free text. Do not invent tool fields or display all questions together, which breaks skip-all.

## Rank and verify

Re-run the resolver with the same scope and selected `--energy` and `--focus` (`code`, `arch`, `review`, or `all`). Its score is a candidate ordering, not proof of readiness. Inspect each shortlisted card or issue, including acceptance gates, dependencies, current status, assignment, and relevant project state. Exclude Done, Retired, Dormant, Blocked, unknown-status, and explicitly other-owner work. A person's name in a title is not ownership. Agent lanes describe execution responsibility, not personal identity.

Use time as a fit constraint after reading the gates; label estimates as estimates, and propose one bounded slice when a whole task exceeds the time available. Unknown effort stays unknown. Priority and unblocking value lead; operator fit, energy, time, focus, and continuation of existing work break ties. Use the user's known preferences only from their own canon. Deduplicate canonical cards and views. If fewer than five qualify, show fewer and explain why. If none qualify, state the discovery or readiness gap and offer one concrete resolution.

Present the scope, operator, capacity, and task source once, then a numbered list of at most five choices. For each: clickable source, outcome, why now, estimated effort if supported, first action under two minutes, and recommended route. Use the active harness's link format, never fabricate `file:` URLs. Keep each item compact; identify the recommended first pick and what would change it.

## Continue the selected task

End with simple choices: `1` to work here, `Prompt 2` for a focused handoff, or `Delegate 3,4` to delegate specified work. Keep the displayed task IDs and paths in conversation; re-read those exact tasks when selected, rather than re-ranking an index that may now name a different task.

- **Work here:** best for a bounded slice with enough current context. Re-check status and permissions, update the canonical task state, execute the smallest meaningful checks, and record completion evidence. Read [proof gates](./references/proof-gates.md) when closing work.
- **Fresh-chat prompt:** best when substantial unrelated context or a large distinct problem warrants a fresh session. Load the locally available prompt-composer skill and include workspace, exact task source, goal, file ownership, acceptance gates, and verification commands. Provide the prompt in chat. Save reusable prompts only with the user's confirmation; launch a top-level chat only when requested. If prompt-composer is unavailable, compose a concise handoff and disclose that fallback.
- **Delegation candidate:** require clear file ownership, independent boundaries, available tools, and observable gates. An autonomous flag or a title containing audit/test is insufficient. Ask before spawning unless this session already authorizes it. Check live model capabilities and costs, use app-owned child delegation when available, retain task IDs, and integrate and verify results. Do not launch ordinary top-level chats as subagents. Concurrent workers must know they share a codebase and preserve others' edits. Serialized or overlapping tasks stay in one worker or this chat.

The Command Center surface is the existing Tasks view plus chat question cards and the ranked reply. Use that surface; any new task controls that spend or launch agents require authorization.
