export type T3McpToolLogo = "t3-code";

export interface T3McpToolPresentation {
  readonly displayName: string;
  readonly logo: T3McpToolLogo;
}

export type T3McpToolSummaryAction =
  | "saved-item-list"
  | "saved-item-get"
  | "saved-item-create"
  | "saved-item-update"
  | "saved-item-transition"
  | "saved-item-import"
  | "saved-item-launch"
  | "saved-item-schedule"
  | "saved-item-task"
  | "capabilities"
  | "model-benchmarks"
  | "delegate"
  | "task-status"
  | "task-cancel"
  | "schedule-run"
  | "schedule-create"
  | "schedule-list"
  | "schedule-update"
  | "schedule-delete"
  | "thread-create"
  | "thread-list"
  | "thread-read"
  | "thread-send"
  | "thread-wait"
  | "thread-interrupt"
  | "workflow-stop"
  | "thread-configuration"
  | "thread-configure"
  | "thread-fork"
  | "thread-merge"
  | "thread-search"
  | "thread-transfers"
  | "thread-organize"
  | "thread-update"
  | "queue-list"
  | "queue-read"
  | "queue-edit"
  | "queue-cancel"
  | "queue-reorder"
  | "queue-steer"
  | "question-list"
  | "question-read"
  | "question-respond"
  | "secret-request"
  | "event-emit"
  | "worktree-handoff"
  | "worktree-list"
  | "worktree-status"
  | "project-list"
  | "project-read"
  | "project-create"
  | "project-update"
  | "project-delete"
  | "project-clone"
  | "environment-read"
  | "environment-update"
  | "attachment-prepare"
  | "attachment-discard"
  | "attachment-send"
  | "link-pr"
  | "unlink-pr"
  | "list-prs"
  | "watch-pr"
  | "unwatch-pr"
  | "browser"
  | "device"
  | "html-preview"
  | "html-render"
  | "board-task-list"
  | "board-task-get"
  | "board-task-update"
  | "board-task-create";

export interface T3McpToolDefinition {
  readonly displayName: string;
  readonly labels: readonly [action: string, running: string, completed: string, detail: string];
  readonly icon: "t3-code" | "browser" | "device" | "pull-request";
  readonly summaryAction: T3McpToolSummaryAction;
}

function tool(
  labels: T3McpToolDefinition["labels"],
  summaryAction: T3McpToolSummaryAction,
  icon: T3McpToolDefinition["icon"] = "t3-code",
  displayName = `${labels[0]} ${labels[3]}`,
): T3McpToolDefinition {
  return { displayName, labels, icon, summaryAction };
}

const T3_MCP_SERVER_ALIASES = new Set(["t3-code", "t3_code", "t3code"]);

// Cards, activity rows, summaries, and provider identity recovery share this inventory.
const T3_MCP_TOOLS: Readonly<Record<string, T3McpToolDefinition>> = {
  saved_item_list: tool(
    ["List", "Listing", "Listed", "saved messages and notes"],
    "saved-item-list",
  ),
  saved_item_get: tool(["Read", "Reading", "Read", "a saved message"], "saved-item-get"),
  saved_item_create: tool(["Save", "Saving", "Saved", "a message or note"], "saved-item-create"),
  saved_item_update: tool(["Edit", "Editing", "Edited", "a saved message"], "saved-item-update"),
  saved_item_transition: tool(
    ["Update", "Updating", "Updated", "saved message status"],
    "saved-item-transition",
  ),
  saved_item_import: tool(
    ["Import", "Importing", "Imported", "a saved message"],
    "saved-item-import",
  ),
  saved_item_launch: tool(
    ["Launch", "Launching", "Launched", "a saved message"],
    "saved-item-launch",
  ),
  saved_item_schedule: tool(
    ["Schedule", "Scheduling", "Scheduled", "a saved message"],
    "saved-item-schedule",
  ),
  saved_item_save_task: tool(
    ["Move", "Moving", "Moved", "a saved message to Tasks"],
    "saved-item-task",
  ),
  link_pull_request: tool(
    ["Link", "Linking", "Linked", "a pull request"],
    "link-pr",
    "pull-request",
  ),
  unlink_pull_request: tool(
    ["Unlink", "Unlinking", "Unlinked", "a pull request"],
    "unlink-pr",
    "pull-request",
  ),
  list_thread_pull_requests: tool(
    ["Check", "Checking", "Checked", "linked pull requests"],
    "list-prs",
    "pull-request",
  ),
  watch_pull_request: tool(
    ["Watch", "Watching", "Watching", "a pull request"],
    "watch-pr",
    "pull-request",
  ),
  unwatch_pull_request: tool(
    ["Stop watching", "Stopping watching", "Stopped watching", "a pull request"],
    "unwatch-pr",
    "pull-request",
  ),
  orchestrator_capabilities: tool(["Get", "Getting", "Got", "teamwork options"], "capabilities"),
  model_benchmarks: tool(["Compare", "Comparing", "Compared", "model scores"], "model-benchmarks"),
  delegate_task: tool(["Start", "Starting", "Started", "a helper"], "delegate"),
  task_status: tool(["Get", "Getting", "Got", "helper status"], "task-status"),
  task_cancel: tool(["Stop", "Stopping", "Requested a stop of", "a helper"], "task-cancel"),
  schedule_task: tool(
    ["Schedule", "Scheduling", "Scheduled", "a recurring task"],
    "schedule-create",
  ),
  list_scheduled_tasks: tool(["List", "Listing", "Listed", "scheduled tasks"], "schedule-list"),
  update_scheduled_task: tool(
    ["Update", "Updating", "Updated", "a scheduled task"],
    "schedule-update",
  ),
  delete_scheduled_task: tool(
    ["Delete", "Deleting", "Requested deletion of", "a scheduled task"],
    "schedule-delete",
  ),
  board_task_list: tool(["List", "Listing", "Listed", "board tasks"], "board-task-list"),
  board_task_get: tool(["Read", "Reading", "Read", "a board task"], "board-task-get"),
  board_task_update: tool(["Update", "Updating", "Updated", "a board task"], "board-task-update"),
  board_task_create: tool(["Create", "Creating", "Created", "a board task"], "board-task-create"),
  focus_list: tool(["List", "Listing", "Listed", "focus notes"], "board-task-list"),
  focus_check: tool(["Tick", "Ticking", "Ticked", "a focus note"], "board-task-update"),
  request_secret: tool(["Ask for", "Asking for", "Asked for", "a secret"], "secret-request"),
  event_emit: tool(["Post", "Posting", "Posted", "a feed event"], "event-emit"),
  create_threads: tool(["Create", "Creating", "Created", "chats"], "thread-create"),
  t3_thread_start: tool(["Start", "Starting", "Started", "a chat"], "thread-create"),
  t3_thread_list: tool(["List", "Listing", "Listed", "chats"], "thread-list"),
  t3_thread_read: tool(["Read", "Reading", "Read", "a chat"], "thread-read"),
  t3_thread_send: tool(["Send", "Sending", "Sent", "to a chat"], "thread-send"),
  t3_thread_wait: tool(["Wait", "Waiting", "Waited", "for a chat"], "thread-wait"),
  t3_workflow_stop: tool(
    ["Stop", "Stopping", "Requested a stop for", "a helper group"],
    "workflow-stop",
  ),
  t3_thread_interrupt: tool(
    ["Stop", "Stopping", "Requested a stop of", "a chat"],
    "thread-interrupt",
  ),
  t3_worktree_handoff: tool(
    ["Hand off", "Handing off", "Handed off", "chat to a separate copy"],
    "worktree-handoff",
  ),
  t3_worktree_status: tool(["Get", "Getting", "Got", "separate copy status"], "worktree-status"),
  preview_status: tool(["Get", "Getting", "Got", "preview browser status"], "browser", "browser"),
  preview_open: tool(
    ["Open", "Opening", "Opened", "a page in the preview browser"],
    "browser",
    "browser",
  ),
  preview_navigate: tool(
    ["Navigate", "Navigating", "Navigated", "the preview browser"],
    "browser",
    "browser",
  ),
  preview_dialog: tool(
    ["Respond", "Responding", "Responded", "to a preview browser dialog"],
    "browser",
    "browser",
  ),
  preview_snapshot: tool(
    ["Take a snapshot of", "Taking a snapshot of", "Took a snapshot of", "the preview page"],
    "browser",
    "browser",
    "Look at the preview page",
  ),
  preview_act: tool(["Use", "Using", "Used", "the preview browser"], "browser", "browser"),
  preview_click: tool(
    ["Click", "Clicking", "Clicked", "in the preview browser"],
    "browser",
    "browser",
  ),
  preview_press: tool(
    ["Press", "Pressing", "Pressed", "a key in the preview browser"],
    "browser",
    "browser",
  ),
  preview_type: tool(["Type", "Typing", "Typed", "in the preview browser"], "browser", "browser"),
  preview_hover: tool(
    ["Hover", "Hovering", "Hovered", "in the preview browser"],
    "browser",
    "browser",
  ),
  preview_select: tool(
    ["Choose", "Choosing", "Chose", "an option in the preview browser"],
    "browser",
    "browser",
  ),
  preview_drag: tool(
    ["Drag", "Dragging", "Dragged", "in the preview browser"],
    "browser",
    "browser",
  ),
  preview_upload: tool(
    ["Upload", "Uploading", "Uploaded", "files to the preview browser"],
    "browser",
    "browser",
  ),
  preview_scroll: tool(
    ["Scroll", "Scrolling", "Scrolled", "the preview browser"],
    "browser",
    "browser",
  ),
  preview_resize: tool(
    ["Resize", "Resizing", "Resized", "the preview browser"],
    "browser",
    "browser",
  ),
  preview_evaluate: tool(
    ["Run", "Running", "Ran", "a script in the preview browser"],
    "browser",
    "browser",
  ),
  preview_wait_for: tool(
    ["Wait", "Waiting", "Waited", "for the preview page"],
    "browser",
    "browser",
  ),
  preview_set_appearance: tool(
    ["Set", "Setting", "Set", "preview browser appearance"],
    "browser",
    "browser",
  ),
  preview_recording_start: tool(
    ["Start", "Starting", "Started", "recording the preview browser"],
    "browser",
    "browser",
  ),
  preview_recording_stop: tool(
    ["Stop", "Stopping", "Stopped", "recording the preview browser"],
    "browser",
    "browser",
  ),
  device_list: tool(["List", "Listing", "Listed", "simulators and emulators"], "device", "device"),
  device_open: tool(
    ["Open", "Opening", "Opened", "a device in the Device panel"],
    "device",
    "device",
  ),
  device_screenshot: tool(
    ["Take a screenshot of", "Taking a screenshot of", "Took a screenshot of", "the device"],
    "device",
    "device",
  ),
  device_close: tool(["Close", "Closing", "Closed", "a device"], "device", "device"),
  run_scheduled_task_now: tool(
    ["Run", "Running", "Requested a run of", "a scheduled task"],
    "schedule-run",
  ),
  t3_queue: tool(["Manage", "Managing", "Managed", "waiting messages"], "queue-edit"),
  t3_pending_request: tool(
    ["Handle", "Handling", "Handled", "pending questions"],
    "question-respond",
  ),
  t3_queue_list: tool(["List", "Listing", "Listed", "waiting messages"], "queue-list"),
  t3_queue_read: tool(["Read", "Reading", "Read", "a waiting message"], "queue-read"),
  t3_queue_edit: tool(["Edit", "Editing", "Edited", "a waiting message"], "queue-edit"),
  t3_queue_cancel: tool(
    ["Stop", "Stopping", "Requested a stop of", "a waiting message"],
    "queue-cancel",
  ),
  t3_queue_reorder: tool(
    ["Reorder", "Reordering", "Reordered", "a waiting message"],
    "queue-reorder",
  ),
  t3_queue_promote_to_steer: tool(
    ["Send now", "Sending now", "Requested send now for", "a waiting message"],
    "queue-steer",
  ),
  t3_pending_request_list: tool(["List", "Listing", "Listed", "questions"], "question-list"),
  t3_pending_request_read: tool(["Read", "Reading", "Read", "questions"], "question-read"),
  t3_pending_request_respond: tool(
    ["Answer", "Answering", "Answered", "questions"],
    "question-respond",
  ),
  t3_thread_configuration: tool(
    ["Read", "Reading", "Read", "chat settings"],
    "thread-configuration",
  ),
  t3_thread_configure: tool(["Set", "Setting", "Set", "chat model"], "thread-configure"),
  t3_thread_transfer: tool(["Use", "Using", "Used", "chat transfers"], "thread-fork"),
  t3_thread_fork: tool(["Copy", "Copying", "Requested a copy of", "this chat"], "thread-fork"),
  t3_thread_merge_back: tool(
    ["Merge", "Merging", "Requested a merge of", "a copied chat"],
    "thread-merge",
  ),
  t3_thread_search: tool(["Search", "Searching", "Searched", "chat content"], "thread-search"),
  t3_thread_transfers: tool(["Read", "Reading", "Read", "chat transfers"], "thread-transfers"),
  t3_thread_organize: tool(["Organize", "Organizing", "Organized", "a chat"], "thread-organize"),
  t3_thread_update: tool(["Update", "Updating", "Updated", "chat details"], "thread-update"),
  t3_worktree_list: tool(["List", "Listing", "Listed", "separate copies"], "worktree-list"),
  t3_preview_list: tool(["List", "Listing", "Listed", "preview tabs"], "browser", "browser"),
  t3_preview_close: tool(["Close", "Closing", "Closed", "a preview tab"], "browser", "browser"),
  t3_environment_read: tool(["Read", "Reading", "Read", "computer settings"], "environment-read"),
  t3_environment_preferences_update: tool(
    ["Update", "Updating", "Updated", "computer settings"],
    "environment-update",
  ),
  t3_thread_launch: tool(
    ["Launch", "Launching", "Launched", "a chat for a project"],
    "thread-create",
  ),
  t3_project_list: tool(["List", "Listing", "Listed", "projects"], "project-list"),
  t3_project_read: tool(["Read", "Reading", "Read", "a project"], "project-read"),
  t3_project_create: tool(["Add", "Adding", "Added", "a project"], "project-create"),
  t3_project_update: tool(["Update", "Updating", "Updated", "a project"], "project-update"),
  t3_project_delete: tool(["Delete", "Deleting", "Deleted", "a project"], "project-delete"),
  t3_project_clone: tool(["Clone", "Cloning", "Cloned", "a project"], "project-clone"),
  t3_attachment_prepare_upload: tool(
    ["Prepare", "Preparing", "Prepared", "an attachment"],
    "attachment-prepare",
  ),
  t3_attachment_discard: tool(
    ["Discard", "Discarding", "Discarded", "an unsent attachment"],
    "attachment-discard",
  ),
  t3_thread_send_attachments: tool(["Send", "Sending", "Sent", "attachments"], "attachment-send"),
  html_preview: tool(["Preview", "Previewing", "Previewed", "an HTML page"], "html-preview"),
  html_render: tool(["Render", "Rendering", "Rendered", "an HTML page"], "html-render"),
  canvas: tool(["Build", "Building", "Built", "a canvas"], "html-render"),
};

/**
 * The T3 orchestration tool inventory, used to gate loose name matching on
 * both the server (ACP MCP identity recovery) and the client (logo branding).
 */
export const T3_MCP_TOOL_NAMES: ReadonlySet<string> = new Set(Object.keys(T3_MCP_TOOLS));

function normalizeT3McpToolLabel(value: string): string {
  return value.replace(/\s+(?:complete|completed)\s*$/i, "").trim();
}

/**
 * ACP agents disagree on how the injected T3 server prefixes its tools:
 * `mcp__t3-code__x` (Claude/Cursor), `t3-code.x` (Codex), plus single
 * underscore, colon, slash, dash, and space separators seen from registry
 * agents. The prefix match is deliberately loose because the display-name
 * inventory is the real gate; unknown tools stay on the generic renderer.
 */
function resolveT3McpToolName(value: string): string | null {
  const label = normalizeT3McpToolLabel(value);
  const mcpMatch = /^mcp__(?<server>.+?)__(?<tool>.+)$/i.exec(label);
  if (mcpMatch?.groups) {
    const { server, tool } = mcpMatch.groups;
    return server !== undefined &&
      tool !== undefined &&
      T3_MCP_SERVER_ALIASES.has(server.toLowerCase())
      ? tool
      : null;
  }

  const namespaceMatch = /^(?<server>t3-code|t3_code|t3code)(?:[.:/]|\s*·\s*)(?<tool>.+)$/i.exec(
    label,
  );
  if (namespaceMatch?.groups) {
    return namespaceMatch.groups.tool ?? null;
  }

  const prefixed = /^(?:mcp[-_]{1,2})?t3[-_ ]?code(?:__|[-_.:/ ])(?<tool>.+)$/i.exec(label);
  const candidate = prefixed?.groups?.tool ?? label;
  if (Object.hasOwn(T3_MCP_TOOLS, candidate)) return candidate;
  // OpenCode 2 registers one server per thread, `t3-code-<thread>`, and joins
  // it to the tool with `_`. Thread ids can hold `_` too, so take the longest
  // known tool name that ends the label.
  if (!/^t3-code-/i.test(label)) return null;
  let longest: string | null = null;
  for (const tool of Object.keys(T3_MCP_TOOLS)) {
    if (label.endsWith(`_${tool}`) && tool.length > (longest?.length ?? 0)) longest = tool;
  }
  return longest;
}

/** The bare T3 tool name (`html_render`) for any provider's spelling of it. */
export function resolveT3McpToolId(toolName: string | null | undefined): string | null {
  const name = toolName == null ? null : resolveT3McpToolName(toolName);
  return name !== null && Object.hasOwn(T3_MCP_TOOLS, name) ? name : null;
}

type SummaryInput = Readonly<Record<string, unknown>>;

const asSummaryInput = (input: unknown): SummaryInput | undefined =>
  typeof input === "object" && input !== null ? (input as SummaryInput) : undefined;

/** Action tools present each call as the single-purpose tool its action replaced. */
const ACTION_TOOLS: Readonly<Record<string, (action: string) => string | undefined>> = {
  preview_act: (action) => `preview_${action}`,
  t3_queue: (action) => `t3_queue_${action}`,
  t3_pending_request: (action) => `t3_pending_request_${action}`,
  t3_thread_transfer: (action) =>
    ({ fork: "t3_thread_fork", merge_back: "t3_thread_merge_back", status: "t3_thread_transfers" })[
      action
    ],
};

/** Pass the call's input so an action tool resolves to the labels and summary of its action. */
export function resolveT3McpToolDefinition(
  toolName: string | null | undefined,
  input?: unknown,
): T3McpToolDefinition | null {
  const name = toolName == null ? null : resolveT3McpToolName(toolName);
  if (name === null || !Object.hasOwn(T3_MCP_TOOLS, name)) return null;
  const action = asSummaryInput(input)?.action;
  const actionTool = typeof action === "string" ? ACTION_TOOLS[name]?.(action) : undefined;
  return actionTool !== undefined && Object.hasOwn(T3_MCP_TOOLS, actionTool)
    ? T3_MCP_TOOLS[actionTool]!
    : T3_MCP_TOOLS[name]!;
}

/** Tools whose summary depends on which fields a call sets. */
const ACTION_SUMMARIES: Readonly<
  Record<string, (input: SummaryInput) => T3McpToolSummaryAction | undefined>
> = {
  t3_thread_configure: ({ modelSelection }) =>
    modelSelection === undefined ? "thread-configuration" : "thread-configure",
  schedule_task: ({ scheduledTaskId }) =>
    scheduledTaskId === undefined ? "schedule-create" : "schedule-update",
};

export function resolveT3McpSummaryAction(
  toolName: string | null | undefined,
  input: unknown,
): T3McpToolSummaryAction | null {
  const definition = resolveT3McpToolDefinition(toolName, input);
  if (definition === null) return null;
  const summarize = ACTION_SUMMARIES[resolveT3McpToolName(toolName!) ?? ""];
  const fields = asSummaryInput(input);
  return (fields && summarize?.(fields)) ?? definition.summaryAction;
}

export function resolveT3McpToolPresentation(
  toolName: string | null | undefined,
  input?: unknown,
): T3McpToolPresentation | null {
  const definition = resolveT3McpToolDefinition(toolName, input);
  return definition === null ? null : { displayName: definition.displayName, logo: "t3-code" };
}

export function resolveT3McpToolSummaryAction(
  toolName: string | null | undefined,
): T3McpToolSummaryAction | null {
  return resolveT3McpToolDefinition(toolName)?.summaryAction ?? null;
}
