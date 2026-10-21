import { describe, expect, it } from "@effect/vitest";

import { decodeFeedEventLine, makeFeedEventId } from "./events.ts";

const valid = {
  v: 1,
  id: "evt_01JB7Q2M4K",
  ts: "2026-10-20T21:14:03-07:00",
  level: "needs_you",
  type: "agent.needs_input",
  title: "Leonidas needs your answer to continue",
  actor: { kind: "agent", name: "Leonidas" },
  target: { thread: "thr_8f2c" },
  actions: [{ label: "Open chat", kind: "open_thread", ref: "thr_8f2c" }],
};
const line = (patch: Record<string, unknown>) => JSON.stringify({ ...valid, ...patch });

describe("decodeFeedEventLine", () => {
  it("accepts every example in the schema doc", () => {
    const examples = [
      valid,
      {
        ...valid,
        level: "failed",
        type: "script.failed",
        body: "`Backup-AIOS.ps1`: disk D: not found.",
        actor: { kind: "script", name: "Backup-AIOS.ps1" },
        target: { files: ["logs/backup.log"] },
        actions: undefined,
        dedupe: "script.failed:Backup-AIOS.ps1",
      },
      {
        ...valid,
        level: "info",
        type: "watcher.post",
        actor: { kind: "watcher", name: "x-simplygersi" },
        target: { url: "https://x.com/simplygersi/status/123" },
        for: ["jake"],
      },
    ];
    for (const example of examples) {
      const result = decodeFeedEventLine(JSON.stringify(example));
      expect(result.ok, JSON.stringify(result)).toBe(true);
    }
  });

  it.each(["v", "id", "ts", "level", "type", "title", "actor"])("rejects a missing %s", (field) => {
    expect(decodeFeedEventLine(line({ [field]: undefined })).ok).toBe(false);
  });

  it.each([
    ["not JSON", "{oops"],
    ["a wrong version", line({ v: 2 })],
    ["an id without the evt_ prefix", line({ id: "01JB7Q2M4K" })],
    ["a time without an offset", line({ ts: "2026-10-20T21:14:03" })],
    ["an unknown level", line({ level: "urgent" })],
    ["an undotted type", line({ type: "finished" })],
    ["a title over 80 characters", line({ title: "x".repeat(81) })],
    ["a body over 500 characters", line({ body: "x".repeat(501) })],
    ["an unknown actor kind", line({ actor: { kind: "robot", name: "r" } })],
    ["more than 2 actions", line({ actions: Array(3).fill(valid.actions[0]) })],
    ["an action that runs a command", line({ actions: [{ label: "Run", kind: "run", ref: "x" }] })],
    [
      "an open_url action that is not http",
      line({ actions: [{ label: "Go", kind: "open_url", ref: "javascript:alert(1)" }] }),
    ],
    ["a target url that is not http", line({ target: { url: "file:///C:/x" } })],
  ])("rejects %s", (_name, input) => {
    const result = decodeFeedEventLine(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });
});

describe("makeFeedEventId", () => {
  it("makes an evt_ ULID that sorts by time", () => {
    const first = makeFeedEventId(1_700_000_000_000);
    const second = makeFeedEventId(1_700_000_000_001);
    expect(first).toMatch(/^evt_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(first < second).toBe(true);
    expect(decodeFeedEventLine(line({ id: first })).ok).toBe(true);
  });

  it("does not repeat inside one millisecond", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => makeFeedEventId(1_700_000_000_000)));
    expect(ids.size).toBe(1000);
  });
});
