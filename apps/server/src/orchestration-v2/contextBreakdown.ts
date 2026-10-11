import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type {
  OrchestrationV2ProviderThread,
  OrchestrationV2ProviderTurn,
  OrchestrationV2TurnItem,
  ThreadContextBreakdown,
  ThreadContextBreakdownCategory,
  ThreadContextBreakdownFile,
  ThreadContextBreakdownToolCall,
  ThreadId,
} from "@t3tools/contracts";
import { ThreadContextBreakdownError } from "@t3tools/contracts";
import type { ProviderAdapterV2ContextReport } from "@t3tools/provider-core/server/ProviderAdapter";
import type { ThreadManagementServiceShape } from "./ThreadManagementService.ts";
import type { ProviderSessionManagerV2Shape } from "./ProviderSessionManager.ts";
import type { ProviderRegistry } from "../provider/ProviderRegistry.ts";

/**
 * Pure context-breakdown math: no I/O, no Effect. The service feeds it the
 * thread's stored turn items plus, when a live Claude query answered, the
 * provider's own report. Providers do not report tokens per tool call, so every
 * per-call and per-file figure here is an estimate (about 4 UTF-8 bytes per
 * token) and is flagged `estimated`.
 */

export type ContextBreakdownBody = Omit<
  ThreadContextBreakdown,
  "threadId" | "driver" | "model" | "capturedAt"
>;

/** What the composer's context meter shows for the thread (see contextWindow.ts in the web app). */
export interface ContextMeterReading {
  readonly usedTokens: number;
  readonly maxTokens: number | null;
}

const OTHER_CATEGORY = "Other / unattributed";
const MESSAGES_CATEGORY = "Messages";
const TOOL_CALLS_CATEGORY = "Tool calls";
const SUMMARY_CATEGORY = "Compacted summary";
const FREE_CATEGORY = "Free space";

/** Strings past this length skip the UTF-8 pass; length / 4 is the same heuristic. */
const ENCODE_LENGTH_LIMIT = 1_000_000;
const MAX_SEARCH_FILES_PER_CALL = 50;
const TARGET_MAX_CHARS = 240;

const utf8 = new TextEncoder();

/** Approximate tokens of a string. Lone surrogates encode as U+FFFD, so odd text never throws. */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  if (text.length > ENCODE_LENGTH_LIMIT) return Math.ceil(text.length / 4);
  return Math.ceil(utf8.encode(text).length / 4);
}

function textOf(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    // Circular structures and BigInt values cannot be serialized; size them by their string form.
    return String(value);
  }
}

function clip(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const trimmed = firstLine.trim();
  return trimmed.length > TARGET_MAX_CHARS
    ? `${trimmed.slice(0, TARGET_MAX_CHARS - 1)}...`
    : trimmed;
}

const PATH_FIELDS = ["file_path", "filePath", "path", "filename", "fileName", "notebook_path"];
const TARGET_FIELDS = ["command", "cmd", "pattern", "query", "url", "prompt", "description"];
const READ_TOOLS = /^(read|view|cat|open_?file|read_?file|notebook_?read|view_?image)$/i;
const EDIT_TOOLS =
  /^(edit|write|multi_?edit|notebook_?edit|apply_?patch|str_?replace\w*|create_?file|write_?file)$/i;

function stringField(input: unknown, fields: ReadonlyArray<string>): string | null {
  if (typeof input !== "object" || input === null) return null;
  const record = input as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

type FileRole = "read" | "edit" | "other";

interface ToolRow {
  readonly id: string;
  readonly name: string;
  readonly target: string | null;
  readonly tokens: number;
  readonly status: ThreadContextBreakdownToolCall["status"];
  readonly turnIndex: number | null;
  readonly files: ReadonlyArray<{
    readonly path: string;
    readonly role: FileRole;
    readonly tokens: number;
  }>;
}

function statusOf(item: OrchestrationV2TurnItem, failed = false): ToolRow["status"] {
  if (failed || item.status === "failed") return "error";
  if (item.status === "completed") return "ok";
  return "unknown";
}

/** Claude names an unnamed edit target "<Tool> result"; that is a label, not a path. */
function isPathLike(value: string): boolean {
  return !/^\w+ result$/.test(value);
}

function toolRowOf(item: OrchestrationV2TurnItem, turnIndex: number | null): ToolRow | null {
  const base = { id: item.id, turnIndex } as const;
  switch (item.type) {
    case "command_execution": {
      const failed =
        item.outputIndicatesFailure === true ||
        (item.exitCode !== undefined && item.exitCode !== 0);
      return {
        ...base,
        name: "Command",
        target: clip(item.input) || null,
        tokens: estimateTokens(item.input) + estimateTokens(item.output ?? ""),
        status: statusOf(item, failed),
        files: [],
      };
    }
    case "file_change": {
      const body = item.diffStr ?? `${item.oldStr ?? ""}${item.newStr ?? ""}`;
      const tokens = estimateTokens(body.length > 0 ? body : textOf(item.changes));
      return {
        ...base,
        name: "Edit",
        target: item.fileName,
        tokens,
        status: statusOf(item),
        files: isPathLike(item.fileName) ? [{ path: item.fileName, role: "edit", tokens }] : [],
      };
    }
    case "file_search": {
      const results = item.results ?? [];
      const files = results.slice(0, MAX_SEARCH_FILES_PER_CALL).map((result) => ({
        path: result.fileName,
        role: "other" as const,
        tokens: estimateTokens(`${result.fileName}${result.preview ?? ""}`),
      }));
      const resultTokens = results.reduce(
        (sum, result) => sum + estimateTokens(`${result.fileName}${result.preview ?? ""}`),
        0,
      );
      return {
        ...base,
        name: "Search",
        target: item.pattern === undefined ? null : clip(item.pattern) || null,
        tokens: estimateTokens(item.pattern ?? "") + resultTokens,
        status: statusOf(item),
        files,
      };
    }
    case "web_search": {
      const patterns = item.patterns ?? [];
      return {
        ...base,
        name: "WebSearch",
        target: patterns[0] === undefined ? null : clip(patterns[0]) || null,
        tokens: estimateTokens(textOf(patterns)) + estimateTokens(textOf(item.results)),
        status: statusOf(item),
        files: [],
      };
    }
    case "dynamic_tool": {
      const name = item.toolName ?? "Tool";
      const path = stringField(item.input, PATH_FIELDS);
      const target = path ?? stringField(item.input, TARGET_FIELDS);
      const tokens = estimateTokens(textOf(item.input)) + estimateTokens(textOf(item.output));
      const role: FileRole | null = READ_TOOLS.test(name)
        ? "read"
        : EDIT_TOOLS.test(name)
          ? "edit"
          : null;
      return {
        ...base,
        name,
        target: target === null ? null : clip(target) || null,
        tokens,
        status: statusOf(item),
        files: path !== null && role !== null && isPathLike(path) ? [{ path, role, tokens }] : [],
      };
    }
    case "subagent":
      return {
        ...base,
        name: "Agent",
        target: clip(item.prompt) || null,
        tokens:
          estimateTokens(item.prompt) +
          estimateTokens(item.progress ?? "") +
          estimateTokens(item.result ?? ""),
        status: statusOf(item),
        files: [],
      };
    default:
      return null;
  }
}

export interface TranscriptEstimate {
  readonly toolCalls: ReadonlyArray<ThreadContextBreakdownToolCall>;
  readonly files: ReadonlyArray<ThreadContextBreakdownFile>;
  /** Tokens of user and assistant text still in context. */
  readonly messageTokens: number;
  /** Tokens of the latest compaction summary, or null when the thread never compacted. */
  readonly summaryTokens: number | null;
  readonly hasReasoning: boolean;
  readonly compacted: boolean;
}

const compareItems = (left: OrchestrationV2TurnItem, right: OrchestrationV2TurnItem): number =>
  left.ordinal - right.ordinal;

/**
 * Walks the thread's stored items and sizes what they put into context.
 * Items before the latest compaction are no longer in context, so they are
 * left out and the compaction's own summary is sized instead.
 */
export function estimateTranscript(input: {
  readonly items: ReadonlyArray<OrchestrationV2TurnItem>;
  /** Run id to its 1-based ordinal, used as the turn index. */
  readonly runTurnIndex: ReadonlyMap<string, number>;
}): TranscriptEstimate {
  const ordered = input.items.toSorted(compareItems);
  let start = 0;
  let summaryTokens: number | null = null;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const item = ordered[index];
    if (item?.type === "compaction" && item.status === "completed") {
      start = index + 1;
      summaryTokens = item.afterTokenCount ?? estimateTokens(item.summary ?? "");
      break;
    }
  }

  const toolCalls: ThreadContextBreakdownToolCall[] = [];
  const fileMap = new Map<
    string,
    {
      path: string;
      tokens: number;
      readCount: number;
      lastTurnIndex: number | null;
      edited: boolean;
      read: boolean;
    }
  >();
  let messageTokens = 0;
  let hasReasoning = false;

  for (const item of ordered.slice(start)) {
    if (item.type === "user_message" || item.type === "assistant_message") {
      messageTokens += estimateTokens(item.text);
      continue;
    }
    if (item.type === "reasoning") {
      hasReasoning = true;
      continue;
    }
    const turnIndex = item.runId === null ? null : (input.runTurnIndex.get(item.runId) ?? null);
    const row = toolRowOf(item, turnIndex);
    if (row === null) continue;
    toolCalls.push({
      id: row.id,
      name: row.name,
      target: row.target,
      tokens: row.tokens,
      estimated: true,
      turnIndex: row.turnIndex,
      status: row.status,
    });
    for (const file of row.files) {
      const key = file.path.replaceAll("\\", "/");
      const entry = fileMap.get(key) ?? {
        path: file.path,
        tokens: 0,
        readCount: 0,
        lastTurnIndex: null,
        edited: false,
        read: false,
      };
      entry.tokens += file.tokens;
      if (file.role === "read") {
        entry.readCount += 1;
        entry.read = true;
      }
      if (file.role === "edit") entry.edited = true;
      if (row.turnIndex !== null) {
        entry.lastTurnIndex = Math.max(entry.lastTurnIndex ?? 0, row.turnIndex);
      }
      fileMap.set(key, entry);
    }
  }

  const files = [...fileMap.values()]
    .map((entry) => ({
      path: entry.path,
      tokens: entry.tokens,
      estimated: true,
      readCount: entry.readCount,
      lastTurnIndex: entry.lastTurnIndex,
      origin: entry.edited
        ? ("edit" as const)
        : entry.read
          ? ("read" as const)
          : ("other" as const),
    }))
    .toSorted((left, right) => right.tokens - left.tokens);

  return {
    toolCalls,
    files,
    messageTokens,
    summaryTokens,
    hasReasoning,
    compacted: summaryTokens !== null,
  };
}

/**
 * The reading the composer meter shows (apps/web/src/lib/contextWindow.ts):
 * the newest provider turn with a usage report, else the active provider
 * thread's snapshot, else the latest compaction's after-count with no window.
 */
export function readContextMeter(input: {
  readonly providerTurns: ReadonlyArray<Pick<OrchestrationV2ProviderTurn, "tokenUsage">>;
  readonly activeProviderThread: Pick<OrchestrationV2ProviderThread, "contextUsage"> | null;
  readonly items: ReadonlyArray<OrchestrationV2TurnItem>;
}): ContextMeterReading | null {
  for (let index = input.providerTurns.length - 1; index >= 0; index -= 1) {
    const usage = input.providerTurns[index]?.tokenUsage;
    if (usage !== undefined) {
      return { usedTokens: Math.max(0, usage.usedTokens), maxTokens: usage.maxTokens ?? null };
    }
  }
  const snapshot = input.activeProviderThread?.contextUsage;
  if (snapshot !== null && snapshot !== undefined) {
    return { usedTokens: snapshot.usedTokens, maxTokens: snapshot.maxTokens ?? null };
  }
  const ordered = input.items.toSorted(compareItems);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const item = ordered[index];
    if (item?.type === "compaction" && item.afterTokenCount !== undefined) {
      return { usedTokens: item.afterTokenCount, maxTokens: null };
    }
  }
  return null;
}

const scaleTokens = (value: number, factor: number): number => Math.floor(value * factor);

function scaleRows(
  estimate: Pick<TranscriptEstimate, "toolCalls" | "files">,
  factor: number,
): Pick<TranscriptEstimate, "toolCalls" | "files"> {
  if (factor >= 1) return estimate;
  return {
    toolCalls: estimate.toolCalls.map((call) => ({
      ...call,
      tokens: scaleTokens(call.tokens, factor),
    })),
    files: estimate.files.map((file) => ({ ...file, tokens: scaleTokens(file.tokens, factor) })),
  };
}

const percent = (factor: number): string => `${Math.round(factor * 100)}%`;

/**
 * Combines the transcript estimate with the provider's report and the meter
 * into one breakdown that never claims more than the window or the total the
 * provider reported. Overflow scales the estimated rows down (and says so);
 * a shortfall becomes an "Other / unattributed" category.
 */
export function buildContextBreakdown(input: {
  readonly estimate: TranscriptEstimate;
  readonly meter: ContextMeterReading | null;
  readonly report: ProviderAdapterV2ContextReport | null;
}): ContextBreakdownBody {
  const { estimate, meter, report } = input;
  const notes: string[] = [];
  const maxTokens = meter?.maxTokens ?? report?.maxTokens ?? null;

  if (estimate.compacted) {
    notes.push("Earlier turns were compacted; only items after the latest compaction are counted.");
  }
  if (estimate.hasReasoning) {
    notes.push("Reasoning text is not counted: providers usually drop it from later turns.");
  }

  if (report !== null) {
    const messages = report.categories.find(
      (category) => category.kind === "used" && category.name.toLowerCase().startsWith("messages"),
    );
    const cap = messages?.tokens ?? report.totalTokens;
    const toolSum = estimate.toolCalls.reduce((sum, call) => sum + call.tokens, 0);
    const factor = toolSum > cap && toolSum > 0 ? cap / toolSum : 1;
    const scaled = scaleRows(estimate, factor);
    if (factor < 1) {
      notes.push(
        `Estimated tool-call sizes exceeded the provider's message total and were scaled to ${percent(factor)}.`,
      );
    }
    if (scaled.toolCalls.length > 0 || scaled.files.length > 0) {
      notes.push("Per-file and per-call sizes are estimated from tool input and output.");
    }
    if (
      meter?.maxTokens != null &&
      report.maxTokens !== null &&
      meter.maxTokens !== report.maxTokens
    ) {
      notes.push(
        `Provider categories were measured against a ${report.maxTokens.toLocaleString("en-US")} token window; the context meter shows ${meter.maxTokens.toLocaleString("en-US")}.`,
      );
    }
    const memoryFiles: ThreadContextBreakdownFile[] = report.memoryFiles.map((file) => ({
      path: file.path,
      tokens: file.tokens,
      estimated: false,
      readCount: 1,
      lastTurnIndex: null,
      origin: "memory",
    }));
    const hasEstimatedRows = scaled.toolCalls.length > 0 || scaled.files.length > 0;
    return {
      source: hasEstimatedRows ? "mixed" : "provider",
      totalTokens: report.totalTokens,
      maxTokens,
      categories: report.categories.map((category) => ({ ...category, estimated: false })),
      files: [...memoryFiles, ...scaled.files],
      toolCalls: scaled.toolCalls,
      mcpTools: report.mcpTools,
      skills: report.skills,
      agents: report.agents,
      notes,
    };
  }

  const toolSum = estimate.toolCalls.reduce((sum, call) => sum + call.tokens, 0);
  const summary = estimate.summaryTokens ?? 0;
  const estimated = estimate.messageTokens + toolSum + summary;
  const reported = meter?.usedTokens ?? null;
  let factor = 1;
  if (reported !== null && estimated > reported && estimated > 0) {
    factor = reported / estimated;
    notes.push(
      `Estimated sizes exceeded the ${reported.toLocaleString("en-US")} tokens the provider reported and were scaled to ${percent(factor)}.`,
    );
  }
  const scaled = scaleRows(estimate, factor);
  const parts: ThreadContextBreakdownCategory[] = [];
  const pushUsed = (name: string, tokens: number) => {
    if (tokens > 0) parts.push({ name, kind: "used", tokens, estimated: true });
  };
  pushUsed(MESSAGES_CATEGORY, scaleTokens(estimate.messageTokens, factor));
  pushUsed(
    TOOL_CALLS_CATEGORY,
    scaled.toolCalls.reduce((sum, call) => sum + call.tokens, 0),
  );
  pushUsed(SUMMARY_CATEGORY, scaleTokens(summary, factor));
  const attributed = parts.reduce((sum, part) => sum + part.tokens, 0);
  const totalTokens = reported ?? attributed;
  if (reported !== null && reported > attributed) {
    pushUsed(OTHER_CATEGORY, reported - attributed);
    notes.push(
      "Other / unattributed covers system prompt, tool definitions and anything not in the transcript.",
    );
  }
  if (maxTokens !== null && maxTokens > totalTokens) {
    parts.push({
      name: FREE_CATEGORY,
      kind: "free",
      tokens: maxTokens - totalTokens,
      estimated: true,
    });
  }
  if (reported === null) {
    notes.push(
      "The provider has not reported context usage yet, so the total is the transcript estimate.",
    );
  }
  if (scaled.toolCalls.length > 0 || scaled.files.length > 0) {
    notes.push("Per-file and per-call sizes are estimated from tool input and output.");
  }
  return {
    source: "estimated",
    totalTokens,
    maxTokens,
    categories: parts,
    files: scaled.files,
    toolCalls: scaled.toolCalls,
    mcpTools: [],
    skills: [],
    agents: [],
    notes,
  };
}

export interface QueryThreadContextBreakdownInput {
  readonly threadId: ThreadId;
  readonly threadManagement: Pick<ThreadManagementServiceShape, "getThreadRecords">;
  readonly providerSessions: Pick<ProviderSessionManagerV2Shape, "get">;
  readonly providerRegistry?: Pick<ProviderRegistry["Service"], "getProviders">;
}

export const queryThreadContextBreakdown = Effect.fn("orchestrationV2.queryThreadContextBreakdown")(
  function* (input: QueryThreadContextBreakdownInput) {
    const projection = yield* input.threadManagement
      .getThreadRecords(input.threadId, [
        "runs",
        "turnItems",
        "providerTurns",
        "providerThreads",
        "providerSessions",
      ])
      .pipe(
        Effect.mapError(
          (cause) =>
            new ThreadContextBreakdownError({
              threadId: input.threadId,
              reason: "thread-not-found",
              retryable: false,
              message: `Thread ${input.threadId} not found`,
              cause,
            }),
        ),
      );

    if (!projection || !projection.thread || projection.thread.deletedAt !== null) {
      return yield* Effect.fail(
        new ThreadContextBreakdownError({
          threadId: input.threadId,
          reason: "thread-not-found",
          retryable: false,
          message: `Thread ${input.threadId} not found`,
        }),
      );
    }

    const providerThread =
      projection.providerThreads.find(
        (candidate) => candidate.id === projection.thread.activeProviderThreadId,
      ) ??
      projection.providerThreads.at(-1) ??
      null;

    let report: ProviderAdapterV2ContextReport | null = null;
    if (providerThread !== null && providerThread.providerSessionId !== null) {
      const maybeRuntime = yield* input.providerSessions.get(providerThread.providerSessionId).pipe(
        Effect.mapError(
          (cause) =>
            new ThreadContextBreakdownError({
              threadId: input.threadId,
              reason: "unavailable",
              retryable: true,
              message: `Provider session ${providerThread.providerSessionId} could not be accessed`,
              cause,
            }),
        ),
      );
      const runtime = Option.getOrNull(maybeRuntime);
      if (runtime !== null && runtime.getContextReport !== undefined) {
        report = yield* runtime.getContextReport({ providerThread }).pipe(
          Effect.mapError(
            (cause) =>
              new ThreadContextBreakdownError({
                threadId: input.threadId,
                reason: "provider-failed",
                retryable: true,
                message: `Provider failed to report context usage for thread ${input.threadId}`,
                cause,
              }),
          ),
        );
      }
    }

    const runTurnIndex = new Map(projection.runs.map((r) => [r.id, r.ordinal]));
    const estimate = estimateTranscript({
      items: projection.turnItems,
      runTurnIndex,
    });

    const meter = readContextMeter({
      providerTurns: projection.providerTurns,
      activeProviderThread: providerThread,
      items: projection.turnItems,
    });

    const body = buildContextBreakdown({
      estimate,
      meter,
      report,
    });

    let driver = providerThread?.driver;
    if (!driver && input.providerRegistry) {
      const providers = yield* input.providerRegistry.getProviders.pipe(
        Effect.catchAll(() => Effect.succeed([])),
      );
      const found = providers.find((p) => p.instanceId === projection.thread.providerInstanceId);
      if (found) driver = found.driver;
    }
    if (!driver) {
      driver = "claudeAgent";
    }

    const model =
      report?.model ??
      (typeof projection.thread.modelSelection.model === "string"
        ? projection.thread.modelSelection.model
        : null);

    const now = yield* DateTime.now;
    const capturedAt = DateTime.formatIso(now);

    return {
      threadId: input.threadId,
      driver,
      model,
      capturedAt,
      ...body,
    } satisfies ThreadContextBreakdown;
  },
);
