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
  firstThought,
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

/** What the agent is doing right now, for the composer's live bar. */
export interface ActivityNow {
  /** `Running vp test run a.test.ts`: label and target joined. */
  readonly text: string;
  /** The verb: `Running`, `Read`, `Thinking`. */
  readonly label: string;
  readonly target: string | null;
  readonly kind: ActivityKind | "think" | "idle";
  readonly running: boolean;
  readonly failed: boolean;
  /** The turn item the bar reveals in the chat, when the action is a tool call. */
  readonly itemId: string | null;
  /** The whole command as the agent sent it, unclipped, for hover text. */
  readonly full: string | null;
  /** ISO time the action began, for the live clock. */
  readonly since: string | null;
  /** Other tool calls still running beside this one. */
  readonly alsoRunning: number;
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
  checkpoint: "Saving a save point for the last reply",
  preparing: "Getting the project ready",
  starting: "Starting the AI",
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

  const runningEvents = events.filter((event) => event.running);
  const running = runningEvents.at(-1);
  const thoughtItem = recentItems.findLast((item) => item.type === "reasoning");
  const thought = thoughtItem?.type === "reasoning" ? firstThought(thoughtItem.text) : null;
  const saidItem = recentItems.findLast((item) => item.type === "assistant_message");
  const said = saidItem?.type === "assistant_message" ? firstThought(saidItem.text, 180) : null;
  // The newest of reasoning and tool work is what the agent is doing right now.
  const lastWork = recentItems.findLast(
    (item) => item.type === "reasoning" || classifyActivityItem(item).event !== null,
  );
  const lastEvent = events.at(-1);
  const fromEvent = (event: ActivityEvent): ActivityNow => {
    const item = recentItems.find((candidate) => candidate.id === event.id);
    return {
      text: `${event.label} ${event.target ?? ""}`.trim(),
      label: event.label,
      target: event.target,
      kind: event.kind,
      running: event.running,
      failed: event.failed,
      itemId: event.id,
      full: item?.type === "command_execution" ? item.input : event.target,
      since: item?.startedAt ? DateTime.formatIso(item.startedAt) : null,
      alsoRunning: event.running ? runningEvents.length - 1 : 0,
    };
  };
  const quiet = (label: string, kind: "think" | "idle", target: string | null = null) => ({
    text: target ? `${label}: ${target}` : label,
    label,
    target,
    kind,
    running: kind === "think",
    failed: false,
    itemId: null,
    full: target,
    since:
      kind === "think" && thoughtItem?.startedAt ? DateTime.formatIso(thoughtItem.startedAt) : null,
    alsoRunning: 0,
  });
  const now: ActivityNow = running
    ? fromEvent(running)
    : lastWork?.type === "reasoning"
      ? quiet("Thinking", "think", thought)
      : lastEvent
        ? fromEvent(lastEvent)
        : quiet(
            steer && !plan
              ? "Updating plan"
              : input.startPhase
                ? START_PHASE_TEXT[input.startPhase]
                : "Getting started",
            "idle",
          );

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
  };
}

export type AgentActivity = ReturnType<typeof deriveAgentActivity>;
