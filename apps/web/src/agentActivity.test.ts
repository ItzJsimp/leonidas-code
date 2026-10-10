import {
  NodeId,
  PlanId,
  RunId,
  ThreadId,
  TurnItemId,
  MessageId,
  type OrchestrationV2PlanArtifact,
  type OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";
import { deriveAgentActivity } from "./agentActivity";

const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2026-01-01T00:01:00Z");
const base = {
  id: TurnItemId.make("item"),
  threadId: ThreadId.make("thread"),
  runId: RunId.make("run"),
  nodeId: NodeId.make("root"),
  providerThreadId: null,
  providerTurnId: null,
  nativeItemRef: null,
  parentItemId: null,
  ordinal: 1,
  status: "running" as const,
  title: null,
  startedAt: now,
  completedAt: null,
  updatedAt: now,
};
function plan(count: number): Extract<OrchestrationV2PlanArtifact, { kind: "todo_list" }> {
  return {
    id: PlanId.make("plan"),
    threadId: base.threadId,
    runId: base.runId,
    nodeId: base.nodeId,
    kind: "todo_list",
    status: "active",
    explanation: "Published plan explanation",
    steps: Array.from({ length: count }, (_, i) => ({
      id: String(i),
      text: `New step ${i}`,
      status: i === 0 ? "running" : "pending",
    })),
  };
}
const derive = (items: OrchestrationV2TurnItem[], nextPlan = plan(6)) =>
  deriveAgentActivity({
    runId: base.runId,
    rootNodeId: base.nodeId,
    items,
    plan: nextPlan,
  });

describe("agent activity", () => {
  it("replaces six steps with five in one projection without retaining completed steps", () => {
    const oldPlan = {
      ...plan(6),
      steps: plan(6).steps.map((step, index) =>
        index === 0 ? { ...step, status: "completed" as const } : step,
      ),
    };
    expect(derive([], oldPlan).completedSteps).toBe(1);
    const next = derive([], plan(5));
    expect(next.totalSteps).toBe(5);
    expect(next.completedSteps).toBe(0);
    expect(next.steps).toEqual(
      plan(5).steps.map((step) => ({
        step: step.text,
        status: step.status === "running" ? "inProgress" : step.status,
      })),
    );
  });
  it("hides the obsolete plan during steering, then accepts the replacement", () => {
    const todo: OrchestrationV2TurnItem = {
      ...base,
      type: "todo_list",
      planId: PlanId.make("plan"),
      steps: plan(6).steps,
    };
    const steer: OrchestrationV2TurnItem = {
      ...base,
      id: TurnItemId.make("steer"),
      ordinal: 2,
      updatedAt: later,
      type: "user_message",
      messageId: MessageId.make("steer"),
      text: "Change direction",
      inputIntent: "steer",
      attachments: [],
      createdBy: "user",
      creationSource: "web",
    };
    expect(derive([todo, steer]).steps).toEqual([]);
    expect(derive([todo, steer]).step).toBe("Updating plan");
    const replacement = {
      ...todo,
      steps: plan(5).steps,
      updatedAt: DateTime.makeUnsafe("2026-01-01T00:02:00Z"),
    };
    expect(derive([replacement, steer], plan(5)).totalSteps).toBe(5);
  });
  it("uses only root tools and published explanations, omitting model reasoning", () => {
    const activity = derive([
      { ...base, type: "reasoning", text: "private deliberation", streaming: false },
      {
        ...base,
        type: "dynamic_tool",
        toolName: "Read",
        input: { file_path: "src/app.ts", justification: "Check the current implementation" },
      },
      { ...base, nodeId: NodeId.make("child"), type: "file_change", fileName: "child.txt" },
      { ...base, runId: RunId.make("old"), type: "file_change", fileName: "old.txt" },
    ]);
    expect(activity.files).toEqual(["src/app.ts"]);
    expect(activity.notes).toEqual(["Read: Check the current implementation"]);
    expect(JSON.stringify(activity)).not.toContain("private deliberation");
  });
  it("shows remaining steps and finishing without inventing an ETA", () => {
    const last = plan(1);
    const activity = derive([], last);
    expect(activity.remaining).toBe(1);
    expect(activity.finishing).toBe(true);
    expect(activity.currentStep).toBe(1);
  });
});
