import { describe, expect, it } from "@effect/vitest";

import { taskPresence } from "./taskPresence.ts";

const shell = (id: string, activityRunStatus: string | null | undefined) =>
  [
    id,
    {
      id,
      title: `Chat ${id}`,
      modelSelection: { instanceId: "claudeAgent", model: "claude-sonnet-5-5" },
      activityRunStatus,
    },
  ] as const;

const shells = (...entries: ReadonlyArray<ReturnType<typeof shell>>) =>
  new Map(entries) as unknown as Parameters<typeof taskPresence>[1];

describe("taskPresence", () => {
  it("lists only linked chats whose run is running or waiting", () => {
    const result = taskPresence(
      { threadIds: ["a", "b", "c", "d", "e"] } as never,
      shells(
        shell("a", "running"),
        shell("b", "waiting"),
        shell("c", null),
        shell("d", undefined),
        shell("e", "preparing"),
        shell("other", "running"),
      ),
    );
    expect(result.map((chat) => [chat.threadId, chat.status])).toEqual([
      ["a", "running"],
      ["b", "waiting"],
    ]);
    expect(result[0]).toMatchObject({
      title: "Chat a",
      agent: "claudeAgent",
      model: "claude-sonnet-5-5",
    });
  });

  it("drops a chat the moment its run stops", () => {
    const task = { threadIds: ["a"] } as never;
    expect(taskPresence(task, shells(shell("a", "running")))).toHaveLength(1);
    expect(taskPresence(task, shells(shell("a", null)))).toHaveLength(0);
  });

  it("reads the old single claim, skips a thread twice, and ignores unknown chats", () => {
    const task = { threadIds: ["a"], claimedAgent: { threadId: "a" } } as never;
    expect(taskPresence(task, shells(shell("a", "running")))).toHaveLength(1);
    expect(
      taskPresence({ claimedAgent: { threadId: "old" } } as never, shells(shell("old", "waiting"))),
    ).toHaveLength(1);
    expect(taskPresence({ threadIds: ["gone"] } as never, shells())).toEqual([]);
  });
});
