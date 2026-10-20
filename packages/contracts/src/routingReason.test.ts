import * as Schema from "effect/Schema";
import { expect, it } from "vite-plus/test";
import { OrchestrationV2Command } from "./orchestrationV2.ts";
const decodeCommand = Schema.decodeSync(OrchestrationV2Command);

it("keeps the routing reason in a delegated task command", () => {
  const command = decodeCommand({
    type: "delegated_task.request",
    createdBy: "agent",
    creationSource: "mcp",
    commandId: "route-test",
    parentThreadId: "parent",
    parentRunId: "run",
    parentNodeId: "node",
    task: "Fix the typo",
    modelSelection: { instanceId: "codex", model: "gpt-6-luna" },
    runtimeMode: "full-access",
    interactionMode: "default",
    routingReason: "Light task, lowest cost",
  });
  expect(command).toHaveProperty("routingReason", "Light task, lowest cost");
});
