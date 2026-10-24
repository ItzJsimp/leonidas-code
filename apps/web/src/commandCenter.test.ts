import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId, ProviderInstanceId, RunId, ThreadId } from "@t3tools/contracts";
import { makeThreadFixture } from "./test-fixtures";
import { countOpenChats, groupCommandCenterThreads } from "./commandCenter";

const runtime = (status: "running" | "failed" | "idle") => ({
  status,
  activeRunId: status === "running" ? RunId.make("run") : null,
  providerInstanceId: ProviderInstanceId.make("codex"),
  providerName: "Codex",
  lastError: null,
  updatedAt: "2026-10-10T12:00:00Z",
});

describe("Command Center live thread grouping", () => {
  it.each(["preparing", "queued", "starting", "running", "waiting"] as const)(
    "includes %s turns as active work",
    (status) => {
      const thread = makeThreadFixture({ runtime: { ...runtime("running"), status } });
      expect(groupCommandCenterThreads([thread]).running[0]?.status).toBe("working");
    },
  );

  it("prioritizes a pending approval over input and a prior limit error", () => {
    const thread = makeThreadFixture({
      hasPendingApprovals: true,
      hasPendingUserInput: true,
      runtime: { ...runtime("failed"), lastErrorClass: "usage_limit" },
    });
    const groups = groupCommandCenterThreads([thread]);
    expect(groups.attention[0]?.status).toBe("approval");
    expect(groups.limited).toHaveLength(0);
  });

  it("groups approvals, user questions, subscription limits and active work", () => {
    const approval = makeThreadFixture({
      id: ThreadId.make("approval"),
      hasPendingApprovals: true,
      runtime: runtime("running"),
    });
    const input = makeThreadFixture({ id: ThreadId.make("input"), hasPendingUserInput: true });
    const limited = makeThreadFixture({
      id: ThreadId.make("limited"),
      runtime: { ...runtime("failed"), lastErrorClass: "usage_limit" },
    });
    const running = makeThreadFixture({
      id: ThreadId.make("running"),
      runtime: runtime("running"),
    });
    const groups = groupCommandCenterThreads([approval, input, limited, running]);
    expect(groups.attention.map((row) => row.status)).toEqual(["approval", "input"]);
    expect(groups.limited.map((row) => row.thread.id)).toEqual([limited.id]);
    expect(groups.running.map((row) => row.thread.id)).toEqual([running.id]);
  });

  it("excludes archived, deleted, ready and unrelated failures", () => {
    const threads = [
      makeThreadFixture(),
      makeThreadFixture({ runtime: runtime("failed") }),
      makeThreadFixture({ archivedAt: "2026-10-10T12:00:00Z", hasPendingApprovals: true }),
      makeThreadFixture({ deletedAt: "2026-10-10T12:00:00Z", runtime: runtime("running") }),
    ];
    expect(groupCommandCenterThreads(threads)).toEqual({ attention: [], limited: [], running: [] });
  });

  it("keeps background waiting work visible and sorts each group newest first", () => {
    const older = makeThreadFixture({
      id: ThreadId.make("older"),
      runtime: runtime("running"),
      updatedAt: "2026-10-10T11:00:00Z",
    });
    const newer = makeThreadFixture({
      id: ThreadId.make("newer"),
      runtime: runtime("idle"),
      pendingBackgroundTasks: [{ kind: "background_task", taskId: "bash-1" }],
      updatedAt: "2026-10-10T12:00:00Z",
    });
    expect(
      groupCommandCenterThreads([older, newer]).running.map((row) => [row.thread.id, row.status]),
    ).toEqual([
      [newer.id, "waiting"],
      [older.id, "working"],
    ]);
  });

  it("does not count an idle chat with no background work as running", () => {
    const idle = makeThreadFixture({ runtime: runtime("idle") });
    expect(groupCommandCenterThreads([idle]).running).toEqual([]);
  });

  it("counts open chats, not archived or deleted ones", () => {
    expect(
      countOpenChats([
        makeThreadFixture({ id: ThreadId.make("a") }),
        makeThreadFixture({ id: ThreadId.make("b"), runtime: runtime("idle") }),
        makeThreadFixture({ id: ThreadId.make("c"), archivedAt: "2026-10-10T12:00:00Z" }),
        makeThreadFixture({ id: ThreadId.make("d"), deletedAt: "2026-10-10T12:00:00Z" }),
      ]),
    ).toBe(2);
  });

  it("moves a thread between groups when the live shell changes without mutating input", () => {
    const running = makeThreadFixture({ runtime: runtime("running") });
    expect(groupCommandCenterThreads([running]).running).toHaveLength(1);
    const limited = {
      ...running,
      runtime: { ...runtime("failed"), lastErrorClass: "usage_limit" as const },
    };
    expect(groupCommandCenterThreads([limited]).limited).toHaveLength(1);
    expect(groupCommandCenterThreads([running]).running).toHaveLength(1);
    expect(groupCommandCenterThreads([{ ...limited, runtime: null }]).limited).toHaveLength(0);
  });

  it("preserves environment identities for equal thread ids on different machines", () => {
    const a = makeThreadFixture({
      environmentId: EnvironmentId.make("a"),
      runtime: runtime("running"),
    });
    const b = makeThreadFixture({
      environmentId: EnvironmentId.make("b"),
      runtime: runtime("running"),
    });
    expect(
      groupCommandCenterThreads([a, b]).running.map((row) => row.thread.environmentId),
    ).toEqual([a.environmentId, b.environmentId]);
  });
});
