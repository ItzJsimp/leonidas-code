import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import {
  TaskBoardCardCreateInput,
  TaskBoardCardUpdateInput,
  TaskBoardDueDate,
} from "./taskBoard.ts";
import {
  OrchestratorMcpBoardTaskCreateInput,
  OrchestratorMcpBoardTaskUpdateInput,
} from "./orchestratorMcp.ts";

const decodeDue = Schema.decodeSync(TaskBoardDueDate);
const decodeCreate = Schema.decodeSync(TaskBoardCardCreateInput);
const decodeUpdate = Schema.decodeSync(TaskBoardCardUpdateInput);
const decodeAgentCreate = Schema.decodeSync(OrchestratorMcpBoardTaskCreateInput);
const decodeAgentUpdate = Schema.decodeSync(OrchestratorMcpBoardTaskUpdateInput);

describe("task due dates", () => {
  it.each(["2026-10-12", "2028-02-29", "2000-02-29"])("accepts %s", (due) => {
    expect(decodeDue(due)).toBe(due);
  });
  it.each([
    "2026-02-29",
    "2100-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-00-01",
    "2026-10-00",
    "tomorrow",
    "2026-10-12T00:00:00Z",
    "",
  ])("rejects %s", (due) => {
    expect(() => decodeDue(due)).toThrow();
  });
  it("preserves optional and cleared dates across user and agent inputs", () => {
    expect(decodeCreate({ title: "Plan", actor: "Jake", due: "2026-10-12" }).due).toBe(
      "2026-10-12",
    );
    expect(decodeUpdate({ taskId: "task-plan", actor: "Jake", due: null }).due).toBeNull();
    expect(decodeAgentCreate({ title: "Plan", due: "2026-10-12" }).due).toBe("2026-10-12");
    expect(decodeAgentUpdate({ taskId: "task-plan", due: null }).due).toBeNull();
    expect(decodeCreate({ title: "Plan", actor: "Jake" }).due).toBeUndefined();
  });
});
