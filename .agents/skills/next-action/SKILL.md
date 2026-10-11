---
name: next-action
description: "Pick the best next task from the user's or project's task folder, matched to energy and time. Use for next action, what should I work on, or current action."
category: flow
scope: structural
distribution: core
---

# Next Action

Find the real task store, match the user's capacity, and recommend one concrete next step. Works in any AIOS or standalone project, without a particular provider, owner, task script, or worker fleet.

## Find tasks once

Run the bundled [folder resolver](./scripts/resolve_tasks.py) with the current project or AIOS workspace:

```text
python <skill-folder>/scripts/resolve_tasks.py --workspace <workspace>
```

It checks the workspace's saved location first, then nearby task folders without recursively scanning the drive. On first discovery it saves a relative path in the workspace's `.agents/next-action.json`. Subsequent calls validate the saved directory directly. A moved or deleted folder triggers discovery again; an unreadable store is reported rather than treated as empty. The cache is local machine state and is excluded from Git by a generated adjacent ignore rule.

For an explicitly supplied folder, use `--tasks-dir <folder>` to replace the saved location. If discovery returns `not_found`, read the current workspace instructions for an explicit task-store pointer, or ask for the folder once, then save it with that option. Do not search other users' AIOS directories. If Python is unavailable, follow the same bounded lookup and JSON cache convention with the available filesystem tools.

The result includes `tasks_dir`, `store_root`, and `project`. When `project` is present, select only cards whose `project:` matches that slug, `project-<slug>`, or `projects/<slug>/...`. Generated project task views are resolved to the canonical AIOS store. Standalone project tasks need no project field. Honor a user request for AIOS-wide work with `--all-projects`; it changes the filter, not the saved folder.

Read the store's task index or task-list helper if present, then only the candidate cards needed to decide. Otherwise list task files once and read their status, priority, deadline, dependencies, effort, and acceptance gates. Follow this store's schema and lifecycle. A generated index is a view, never the write path.

## Optional quick intake

Use energy, time, and work type already supplied in the prompt. For missing preferences, ask one short optional question:

> Energy: low, medium, or high? Any time limit or kind of work? Say "skip" and I'll pick.

With an asynchronous question tool, continue reading and ranking tasks while the answer is pending. If the user says skip, pick for me, just choose, or supplies a direct action request, do not stop for intake. With no answer available, use medium energy and a 30-minute first step, state that assumption briefly, and recommend immediately. Energy is session context, not a permanent cached preference.

## Choose the next action

Exclude completed, retired, dormant, and blocked tasks unless the user asks to revisit them. Dependencies must be satisfied before execution; a useful unblock step can be its own recommendation. Rank by urgent deadlines and explicit priority, then impact or work unlocked, fit to time and energy, and ongoing momentum. Avoid inventing estimates or certainty: label estimates.

- Low energy: small reviews, admin, chores, or clear bounded fixes.
- Medium energy: a focused implementation slice, documentation, or refactor.
- High energy: the most valuable ready deep-work task, with a finishable first slice.
- Review backlog: favor review when unaccepted work is the bottleneck.

If lanes exist, respect them: agent-ready work can be executed within current authorization; human-only work gets a short checklist; drafts and external dispatch keep their existing approval gates. A missing lane is not permission to act. Use local task helpers only when present, from `store_root`, and verify their supported arguments. Optional [proof guidance](./references/proof-gates.md) and [worker verification](./references/hermes-plate-verify.md) apply when executing work.

Return one recommendation: task title and link, one sentence explaining why now, and the smallest concrete first action with an estimated time. Offer at most two alternatives only when a real tradeoff helps. If no ready tasks exist, say so and suggest one unblock or capture step grounded in the actual store.

## Execute when requested

A request to pick work authorizes a recommendation. A request to do it authorizes execution within the user's normal task permissions. Update the chosen card before starting, carry out the work, run its acceptance checks, and save evidence and remaining blockers. Keep tasks awaiting approval in the store's review state. Mark done only when its lifecycle allows it. Do not create recurring work, dispatch workers, or send messages merely because this skill was invoked.

Done means the task location is saved (or a write restriction is disclosed), the optional intake is answered or defaults stated, and one ready task has a concrete first step. Executed work also has verified evidence and an accurate task status.
