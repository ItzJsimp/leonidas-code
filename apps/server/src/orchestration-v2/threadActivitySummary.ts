import type {
  OrchestrationV2ActivitySummary,
  OrchestrationV2TurnItem,
  RunId,
  NodeId,
  ProviderThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

/** Only the current root plan counts; steering retires it until a replacement arrives. */
export function summarizeThreadActivity(input: {
  runId: RunId;
  rootNodeId: NodeId | null;
  providerThreadId: ProviderThreadId | null;
  items: readonly OrchestrationV2TurnItem[];
}): OrchestrationV2ActivitySummary | null {
  const items = input.items.filter(
    (item) =>
      item.runId === input.runId &&
      (item.nodeId === input.rootNodeId ||
        (input.providerThreadId !== null && item.providerThreadId === input.providerThreadId)),
  );
  const steerAt = items.reduce(
    (latest, item) =>
      item.type === "user_message" &&
      item.nodeId === input.rootNodeId &&
      (item.inputIntent === "steer" || item.inputIntent === "promoted_queued_to_steer")
        ? Math.max(latest, DateTime.toEpochMillis(item.updatedAt))
        : latest,
    -1,
  );
  const newestFirst = (a: OrchestrationV2TurnItem, b: OrchestrationV2TurnItem) =>
    DateTime.toEpochMillis(b.updatedAt) - DateTime.toEpochMillis(a.updatedAt) ||
    b.ordinal - a.ordinal ||
    b.id.localeCompare(a.id);
  const liveTool = items
    .filter(
      (item) =>
        item.status === "running" &&
        ["dynamic_tool", "command_execution", "file_search", "web_search", "file_change"].includes(
          item.type,
        ) &&
        DateTime.toEpochMillis(item.updatedAt) > steerAt,
    )
    .toSorted(newestFirst)[0];
  const toolSummary = liveTool
    ? {
        text: Array.from(liveTool.title || "Using a tool")
          .slice(0, 160)
          .join("")
          .replace(/\s+/g, " ")
          .trim(),
        completedSteps: 0,
        totalSteps: 0,
        currentStep: null,
      }
    : null;
  const plan = items.filter((item) => item.type === "todo_list").toSorted(newestFirst)[0];
  if (plan?.type !== "todo_list" || DateTime.toEpochMillis(plan.updatedAt) <= steerAt)
    return toolSummary;
  const current = plan.steps.findIndex((step) => step.status === "running");
  if (current < 0) return toolSummary;
  return {
    text: Array.from(plan.steps[current]!.text).slice(0, 160).join("").replace(/\s+/g, " ").trim(),
    completedSteps: plan.steps.filter((step) => step.status === "completed").length,
    totalSteps: plan.steps.length,
    currentStep: current + 1,
  };
}
