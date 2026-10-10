import type {
  NodeId,
  OrchestrationV2PlanArtifact,
  OrchestrationV2TurnItem,
  RunId,
} from "@t3tools/contracts";
import { collectToolFilePaths } from "@t3tools/shared/toolActivity";
import * as DateTime from "effect/DateTime";

export function deriveAgentActivity(input: {
  runId: RunId;
  rootNodeId: NodeId | null;
  items: readonly OrchestrationV2TurnItem[];
  plan: Extract<OrchestrationV2PlanArtifact, { kind: "todo_list" }> | null;
}) {
  const items = input.items.filter(
    (item) => item.runId === input.runId && item.nodeId === input.rootNodeId,
  );
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
  const tools = recentItems.filter((item) =>
    ["dynamic_tool", "command_execution", "file_change", "file_search", "web_search"].includes(
      item.type,
    ),
  );
  const tool =
    tools.findLast((item) => item.status === "running" || item.status === "pending") ??
    tools.at(-1);
  const toolLabel =
    tool?.title ??
    (tool?.type === "dynamic_tool" ? tool.toolName : tool?.type.replaceAll("_", " ")) ??
    null;
  const files = [
    ...new Set(
      tools.flatMap((item) => {
        if (item.type === "file_change")
          return [item.fileName, ...(item.changes?.map((change) => change.path) ?? [])];
        if (item.type === "file_search")
          return item.results?.map((result) => result.fileName) ?? [];
        return item.type === "dynamic_tool" ? collectToolFilePaths(item.input) : [];
      }),
    ),
  ].slice(-20);
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
    step: current?.step ?? (steer && !plan ? "Updating plan" : (toolLabel ?? "Working")),
    steps,
    completedSteps: steps.filter((step) => step.status === "completed").length,
    totalSteps: steps.length,
    currentStep: currentIndex >= 0 ? currentIndex + 1 : null,
    remaining: steps.filter((step) => step.status !== "completed").length,
    finishing: currentIndex >= 0 && currentIndex === steps.length - 1,
    tool: toolLabel,
    files,
    explanation: plan?.explanation ?? null,
    notes,
  };
}
