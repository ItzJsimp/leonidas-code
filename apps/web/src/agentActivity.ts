import type {
  OrchestrationV2PlanArtifact,
  OrchestrationV2TurnItem,
  RunId,
} from "@t3tools/contracts";
import { collectToolFilePaths } from "@t3tools/shared/toolActivity";
import * as DateTime from "effect/DateTime";

import {
  type AccessKind,
  type ActivityEvent,
  type ActivityKind,
  classifyAccessPath,
  classifyActivityItem,
  commandShell,
  firstThought,
  readableCommand,
} from "./agentActivityAccess";

export interface AccessedFile {
  readonly path: string;
  readonly name: string;
  readonly access: AccessKind;
  readonly count: number;
}

export interface AccessedAiosFile extends AccessedFile {
  /** Canon folder (`memory`, `tasks`, ...) or `root` for the top-level canon files. */
  readonly folder: string;
  readonly relative: string;
}

const MAX_EVENTS = 12;
const MAX_FILES = 20;
const MAX_AIOS = 40;

function fileName(path: string): string {
  return path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? path;
}

/** Counts uses per key in first-use order; a write upgrades a read of the same file. */
function tally<T extends { access: AccessKind; count: number }>(
  entries: Map<string, T>,
  key: string,
  access: AccessKind,
  create: () => T,
) {
  const existing = entries.get(key);
  entries.set(
    key,
    existing
      ? {
          ...existing,
          count: existing.count + 1,
          access: access === "write" ? "write" : existing.access,
        }
      : create(),
  );
}

export type WaitingKind = "shell" | "subagent" | "app" | "web";

/** One dependency the agent is blocked on. */
export interface WaitingOn {
  readonly id: string;
  readonly kind: WaitingKind;
  /** What it is: `PowerShell`, `Subagent`, an MCP server name, `Web`. */
  readonly source: string;
  /** The command, task or tool in question. */
  readonly detail: string | null;
  /** The whole command, unclipped, for hover text and the expanded list. */
  readonly full: string | null;
  /** ISO time the wait began, for the live elapsed clock. */
  readonly since: string | null;
}

/**
 * The agent is waiting, not working, when every live item is a tool call or a
 * subagent and nothing is thinking or writing. Short file reads and searches
 * return at once, so they never count as a wait.
 */
function deriveWaiting(items: readonly OrchestrationV2TurnItem[]): WaitingOn[] {
  const live = items.filter((item) => item.status === "running" || item.status === "pending");
  if (live.some((item) => item.type === "reasoning" || item.type === "assistant_message")) {
    return [];
  }
  const waiting: WaitingOn[] = [];
  for (const item of live) {
    const { event } = classifyActivityItem(item);
    if (!event?.running) continue;
    const since = item.startedAt ? DateTime.formatIso(item.startedAt) : null;
    const entry = {
      id: item.id,
      detail: event.target,
      full: item.type === "command_execution" ? readableCommand(item.input) : event.target,
      since,
    };
    if (item.type === "command_execution" && event.kind === "command") {
      waiting.push({ ...entry, kind: "shell", source: commandShell(item.input) });
    } else if (event.kind === "agent") {
      waiting.push({ ...entry, kind: "subagent", source: "Subagent" });
    } else if (event.kind === "web") {
      waiting.push({ ...entry, kind: "web", source: "Web" });
    } else if (event.kind === "tool") {
      const server = item.type === "dynamic_tool" ? item.toolName?.split("__")[1] : null;
      waiting.push({
        ...entry,
        kind: "app",
        source: server ? server.replace(/[-_]+/g, " ") : "App",
      });
    }
  }
  return waiting;
}

/**
 * What the agent is doing in the current run, for the composer's activity bar:
 * one sentence for now, a short feed of recent actions, and the skills, AIOS files
 * and project files it has used. Tool calls hang off the run's nodes beside the root,
 * so every item of the run counts, not just the root node's.
 */
/** What a run waits on before its agent sends anything. */
export type AgentStartPhase = "checkpoint" | "preparing" | "starting";

const START_PHASE_TEXT: Record<AgentStartPhase, string> = {
  checkpoint: "Saving the last turn's checkpoint",
  preparing: "Preparing the workspace",
  starting: "Starting the agent",
};

export function deriveAgentActivity(input: {
  runId: RunId;
  items: readonly OrchestrationV2TurnItem[];
  plan: Extract<OrchestrationV2PlanArtifact, { kind: "todo_list" }> | null;
  startPhase?: AgentStartPhase | null;
}) {
  const items = input.items.filter((item) => item.runId === input.runId);
  const steer = items.findLast(
    (item) =>
      item.type === "user_message" &&
      (item.inputIntent === "steer" || item.inputIntent === "promoted_queued_to_steer"),
  );
  const planItem = items.findLast(
    (item) => item.type === "todo_list" && item.planId === input.plan?.id,
  );
  // Steering invalidates the previous plan until the agent publishes a replacement.
  const plan =
    input.plan?.runId === input.runId &&
    (!steer ||
      (planItem &&
        DateTime.toEpochMillis(planItem.updatedAt) > DateTime.toEpochMillis(steer.updatedAt)))
      ? input.plan
      : null;
  const steps =
    plan?.steps.map(({ text, status, durationMs }) => ({
      step: text,
      status: status === "running" ? ("inProgress" as const) : status,
      ...(durationMs === undefined ? {} : { durationMs }),
    })) ?? [];
  const currentIndex = steps.findIndex((step) => step.status === "inProgress");
  const current = steps[currentIndex] ?? steps.find((step) => step.status === "pending");
  const recentItems = steer
    ? items.filter(
        (item) => DateTime.toEpochMillis(item.updatedAt) > DateTime.toEpochMillis(steer.updatedAt),
      )
    : items;

  const events: ActivityEvent[] = [];
  for (const item of recentItems) {
    const { event } = classifyActivityItem(item);
    if (event) events.push(event);
  }

  // Context the agent used across the whole run, not only since the last steer.
  const skills = new Map<string, { name: string; count: number }>();
  const aios = new Map<string, AccessedAiosFile>();
  const project = new Map<string, AccessedFile>();
  const tools = new Map<string, { name: string; count: number }>();
  const paths: string[] = [];
  for (const item of items) {
    const classified = classifyActivityItem(item);
    for (const name of classified.skills) {
      const existing = skills.get(name);
      skills.set(name, { name, count: (existing?.count ?? 0) + 1 });
    }
    if (classified.tool) {
      const existing = tools.get(classified.tool);
      tools.set(classified.tool, { name: classified.tool, count: (existing?.count ?? 0) + 1 });
    }
    for (const { path, access } of classified.access) {
      paths.push(path);
      const found = classifyAccessPath(path);
      if (found.area === "aios") {
        tally(aios, path, access, () => ({
          path,
          name: fileName(path),
          access,
          count: 1,
          folder: found.folder,
          relative: found.relative,
        }));
      } else if (found.area === "file") {
        tally(project, path, access, () => ({ path, name: fileName(path), access, count: 1 }));
      }
    }
    // Other tools carry paths in their input that the classifier does not model.
    if (item.type === "dynamic_tool" && classified.access.length === 0) {
      for (const path of collectToolFilePaths(item.input)) paths.push(path);
    }
  }

  const running = events.findLast((event) => event.running);
  const thoughtItem = recentItems.findLast((item) => item.type === "reasoning");
  const thought = thoughtItem?.type === "reasoning" ? firstThought(thoughtItem.text) : null;
  const saidItem = recentItems.findLast((item) => item.type === "assistant_message");
  const said = saidItem?.type === "assistant_message" ? firstThought(saidItem.text, 180) : null;
  // The newest of reasoning and tool work is what the agent is doing right now.
  const lastWork = recentItems.findLast(
    (item) => item.type === "reasoning" || classifyActivityItem(item).event !== null,
  );
  const lastEvent = events.at(-1);
  const now: {
    readonly text: string;
    readonly kind: ActivityKind | "think" | "idle";
    readonly running: boolean;
  } = running
    ? {
        text: `${running.label} ${running.target ?? ""}`.trim(),
        kind: running.kind,
        running: true,
      }
    : lastWork?.type === "reasoning"
      ? { text: thought ? `Thinking: ${thought}` : "Thinking", kind: "think", running: true }
      : lastEvent
        ? {
            text: `${lastEvent.label} ${lastEvent.target ?? ""}`.trim(),
            kind: lastEvent.kind,
            running: false,
          }
        : {
            text:
              steer && !plan
                ? "Updating plan"
                : input.startPhase
                  ? START_PHASE_TEXT[input.startPhase]
                  : "Getting started",
            kind: "idle",
            running: false,
          };

  const notes = recentItems
    .flatMap((item) => {
      if (item.type !== "dynamic_tool" || !item.input || typeof item.input !== "object") return [];
      const data = item.input as Record<string, unknown>;
      const why = data.justification ?? data.description;
      return typeof why === "string" && why.trim()
        ? [`${item.title ?? item.toolName ?? "Tool"}: ${why.slice(0, 500)}`]
        : [];
    })
    .slice(-5);
  return {
    step: current?.step ?? now.text,
    now,
    thought,
    said,
    events: events.slice(-MAX_EVENTS),
    steps,
    completedSteps: steps.filter((step) => step.status === "completed").length,
    totalSteps: steps.length,
    currentStep: currentIndex >= 0 ? currentIndex + 1 : null,
    remaining: steps.filter((step) => step.status !== "completed").length,
    finishing: currentIndex >= 0 && currentIndex === steps.length - 1,
    skills: [...skills.values()],
    aios: [...aios.values()].slice(-MAX_AIOS),
    project: [...project.values()].slice(-MAX_FILES),
    tools: [...tools.values()],
    actionCount: events.length,
    // Ordered by most recent touch, so a re-read file moves to the end.
    files: [...new Set(paths.toReversed())].toReversed().slice(-MAX_FILES),
    explanation: plan?.explanation ?? null,
    notes,
    waiting: deriveWaiting(items),
  };
}

export type AgentActivity = ReturnType<typeof deriveAgentActivity>;
