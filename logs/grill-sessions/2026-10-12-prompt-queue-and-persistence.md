# Grill session: Prompt queue and persistence

- **Topic:** Prompt queue, task and note capture from the chat composer, with portable markdown export/import
- **Date:** 2026-10-12
- **Goal:** One-click "save for later" of an unsent draft as a queued prompt, a task, or a note, exportable as clean markdown another Leonidas instance or external agent can ingest.

## Pre-Round Facts

- The existing "queue" is the mid-turn follow-up queue (`followUpBehavior: "queue" | "steer"`, `queuedMessageEdit.ts`, MCP `t3_queue_*` tools). It holds messages for a thread that already exists and is running. It is not a store of unsent prompts.
- Tasks already exist: `packages/contracts/src/taskBoard.ts` (`TaskBoardTask`, create/update/claim/complete inputs, sources board/github_issue/aios_card, description max 20,000 chars) and MCP `board_task_*` tools.
- No notes entity exists anywhere in contracts or server.
- Composer drafts persist client-side (`composerDraftStore`, `ChatComposer.tsx`).
- Scheduled tasks (`scheduledTask.ts`) already run prompts later on a schedule.

## Rounds

### Round 1

- **Q1 Data model:** user answer verbatim: "1 a" -> A: one `SavedItem` with `kind: prompt | task | note`; a task save also creates a linked board task.
- **Q2 Where it lives:** "2 a" -> A: server, event-sourced, reachable by all clients and MCP.
- **Q3 Markdown format:** "3 a" -> A: YAML frontmatter (kind, title, tags, format version) plus body.
- **Q4 Later execution:** "4 b+c" -> B and C combined: manual launch into a new thread, an MCP tool for agents to list and pick up queued prompts, and a "run at <time>" built on scheduled tasks.

**Settled:** unified server-side SavedItem; frontmatter markdown; manual + agent-pull + scheduled execution.

### Round 2

- **Q5 Save controls:** "5 a" -> A: split button; main click queues, chevron offers Prompt, Task, Note.
- **Q6 Other entry points:** "6 b" -> B: composer button only for the first release; command palette and keybinding deferred.
- **Q7 Browsing and import:** "7 a+b" -> A and B combined: Saved panel with paste-to-import offer, plus an explicit Import button and paste dialog.
- **Q8 Lifecycle:** "8 a" -> A: Queued, Launched, Done, plus Archived; archive/restore instead of delete; launched items link their thread and can be re-queued.

**Settled:** split-button composer save; panel with both paste-detect and explicit import; full reversible lifecycle. Palette/keybinding deferred (note: project rules list these as part of "hit every surface", so record as a known follow-up).

### Round 3

- **Q9 Scope:** "9 a" -> A: project-scoped by default with a "no project" bucket.
- **Q10 Agent access:** "10 b" -> B: agents get full control, including launch and schedule.
- **Q11 Task save:** "11 b" -> B: create the board task, then the item moves to the board and leaves the Saved panel (no sync).
- **Q12 Scheduling:** "12 a" -> A: "Run at" creates a scheduled task linked back to the item.

## Synthesis

### Settled Architecture

- **Entity:** one server-side, event-sourced `SavedItem` (`kind: prompt | note`, plus `task` only transiently, see Q11), project-scoped with an optional "no project" bucket. Statuses: Queued, Launched, Done, Archived; archive/restore replace delete; launched items keep a thread link and can be re-queued.
- **Task kind:** saving as a task creates a `TaskBoardTask` (prompt text as description) and moves the item to the board; no ongoing sync.
- **Composer:** split button on the composer. Main click queues the current draft; chevron offers Prompt, Task, Note. Draft clears after save. Command palette and keybinding are a recorded follow-up.
- **Panel and import:** a Saved panel listing items by kind and status. Import via paste detection (offer "Import as ...") and an explicit Import button with a paste dialog.
- **Export:** markdown with YAML frontmatter (`kind`, title, tags, `format` version) and the prompt as the body; import parses the frontmatter exactly.
- **Execution:** manual launch into a new thread; MCP tools for agents (create, list, update, archive, launch, schedule); "Run at" creates a linked scheduled task.
- **Layers:** contracts in `packages/contracts`, one service with thin `ws.ts` and MCP handlers, client commands via `createEnvironmentRpcCommand` with guarded scopes, shared logic in `packages/client-runtime`.

### Accepted Tradeoffs

- Agents can launch and schedule, so a prompt can start work unattended. Guards to build in: guarded RPC scope for launch, a visible "launched by agent" mark on the item, and a cap or loop check so an agent cannot launch items that enqueue more launches without limit.
- Task saves lose the Saved panel history (no sync) in exchange for no two-way sync code.
- No palette command or keybinding in v1, so the feature is reachable from only one entry point at first. The project rules call this out as a gap to close.
- Notes have no existing home, so this adds a new content type with no prior UX to copy.

### Next Action

- Slice 1: contracts for `SavedItem` plus the markdown render/parse functions in `packages/shared`, test-first (round trip of export then import for each kind). Slice 2: server service, event, projection and MCP tools. Slice 3: composer split button, Saved panel and import.
