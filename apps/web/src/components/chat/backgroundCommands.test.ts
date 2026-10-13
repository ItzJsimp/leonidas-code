import { describe, expect, it } from "vite-plus/test";

import { liveBackgroundCommandIds } from "./backgroundCommands";

const backgrounded = (id: string) => ({
  id,
  type: "command_execution",
  output: "Command running in background with ID: abc",
});

describe("liveBackgroundCommandIds", () => {
  it("gives live command slots to the most recently backgrounded items", () => {
    const items = [
      backgrounded("old"),
      { id: "ls", type: "command_execution", output: "file.txt" },
      backgrounded("new"),
    ];
    expect(liveBackgroundCommandIds(items, [{ kind: "command" }])).toEqual(["new"]);
    expect(liveBackgroundCommandIds(items, [{ kind: "command" }, { kind: "command" }])).toEqual([
      "new",
      "old",
    ]);
  });

  it("marks nothing once the provider lists no live command", () => {
    expect(liveBackgroundCommandIds([backgrounded("a")], [])).toEqual([]);
    expect(liveBackgroundCommandIds([backgrounded("a")], [{ kind: "monitor" }])).toEqual([]);
  });
});
