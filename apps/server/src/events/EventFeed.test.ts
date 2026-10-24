// @effect-diagnostics nodeBuiltinImport:off - tests write real feed files in a temp folder.
// @effect-diagnostics globalTimers:off - waits for the fake debounce.
import { completeFeedEvent, type FeedEvent, type FeedUpdate } from "@t3tools/contracts";
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { makeEventFeed } from "./EventFeed.ts";
import { appendFeedEvent } from "./feedFile.ts";

const roots: string[] = [];
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  for (const root of roots.splice(0)) NodeFS.rmSync(root, { recursive: true, force: true });
});

const tempRoot = () => {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "feed-svc-"));
  roots.push(root);
  return root;
};

const AT = Date.UTC(2026, 9, 20, 12);
const event = (title: string, at = AT, dedupe?: string): FeedEvent =>
  completeFeedEvent(
    {
      level: "failed",
      type: "script.failed",
      title,
      actor: { kind: "script", name: "t.ps1" },
      ...(dedupe === undefined ? {} : { dedupe }),
    },
    at,
  );

/** A fake watcher: `fire()` stands in for a file system change. */
function fakeWatch() {
  const listeners = new Set<() => void>();
  return {
    fire: () => {
      for (const listener of listeners) listener();
    },
    watch: (_dir: string, onChange: () => void) => {
      listeners.add(onChange);
      const watcher = { close: () => listeners.delete(onChange), on: () => watcher };
      return watcher as unknown as NodeFS.FSWatcher;
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function subscribe(root: string, fake: ReturnType<typeof fakeWatch>) {
  const feed = makeEventFeed({ watch: fake.watch, debounceMs: 0 });
  const updates: FeedUpdate[] = [];
  const close = feed.subscribe(root, (update) => updates.push(update));
  cleanups.push(close, feed.close);
  return updates;
}

describe("event feed service", () => {
  it("keeps only the newest 1000 waiters on the first scan and later scans", async () => {
    const root = tempRoot();
    const file = appendFeedEvent(root, event("wait 0"));
    NodeFS.appendFileSync(
      file,
      Array.from({ length: 1000 }, (_, i) =>
        JSON.stringify(event(`wait ${i + 1}`, AT + i + 1)),
      ).join("\n") + "\n",
    );
    const fake = fakeWatch();
    const feed = makeEventFeed({ watch: fake.watch, debounceMs: 0 });
    cleanups.push(feed.close);
    const snapshots: FeedUpdate[] = [];
    cleanups.push(feed.subscribe(root, (update) => snapshots.push(update)));
    expect(snapshots[0]!.events).toHaveLength(1000);
    expect(snapshots[0]!.events[0]!.title).toBe("wait 1");
    appendFeedEvent(root, event("new wait", AT + 2000));
    fake.fire();
    await settle();
    const later: FeedUpdate[] = [];
    cleanups.push(feed.subscribe(root, (update) => later.push(update)));
    expect(later[0]!.events).toHaveLength(1000);
    expect(later[0]!.events[0]!.title).toBe("wait 2");
  });
  it("sends lines written while the app was closed in the first snapshot", () => {
    const root = tempRoot();
    appendFeedEvent(root, event("old month", Date.UTC(2026, 8, 10)));
    appendFeedEvent(root, event("written while closed"));
    NodeFS.appendFileSync(NodePath.join(root, "events", "2026-10.jsonl"), "not json\n");
    const updates = subscribe(root, fakeWatch());
    expect(updates).toHaveLength(1);
    expect(updates[0]!.kind).toBe("snapshot");
    expect(updates[0]!.events.map((e) => e.title)).toEqual(["old month", "written while closed"]);
    expect(updates[0]!.bad).toHaveLength(1);
  });

  it("pushes only the new event after a change", async () => {
    const root = tempRoot();
    appendFeedEvent(root, event("one"));
    const fake = fakeWatch();
    const updates = subscribe(root, fake);
    appendFeedEvent(root, event("two", AT + 1));
    fake.fire();
    await settle();
    expect(updates.at(-1)).toMatchObject({ kind: "upsert", events: [{ title: "two", count: 1 }] });
  });

  it("sends a repeat inside the dedupe window as an update of the first event", async () => {
    const root = tempRoot();
    const first = event("backup failed", AT, "backup");
    appendFeedEvent(root, first);
    const fake = fakeWatch();
    const updates = subscribe(root, fake);
    appendFeedEvent(root, event("backup failed again", AT + 60_000, "backup"));
    fake.fire();
    await settle();
    expect(updates.at(-1)!.events).toMatchObject([{ id: first.id, count: 2 }]);
  });

  it("keeps an older event that needs the user when 1,000 newer events push it past the cap", () => {
    const root = tempRoot();
    appendFeedEvent(root, event("backup failed, waits for you"));
    const lines = Array.from({ length: 1_000 }, (_, index) =>
      JSON.stringify(
        completeFeedEvent(
          {
            level: "info",
            type: "fixture.note",
            title: `note ${index}`,
            actor: { kind: "script", name: "t.ps1" },
          },
          AT + 1_000 + index,
        ),
      ),
    );
    NodeFS.appendFileSync(NodePath.join(root, "events", "2026-10.jsonl"), `${lines.join("\n")}\n`);
    const titles = subscribe(root, fakeWatch())[0]!.events.map((e) => e.title);
    expect(titles).toContain("backup failed, waits for you");
    expect(titles).toHaveLength(1_001);
  });

  it("starts with an empty snapshot when the folder does not exist yet", () => {
    const updates = subscribe(tempRoot(), fakeWatch());
    expect(updates).toEqual([{ kind: "snapshot", events: [], bad: [] }]);
  });
});

describe("event feed bad-line cap", () => {
  it("reports at most 50 unreadable lines per update", () => {
    const root = tempRoot();
    const file = appendFeedEvent(root, event("one"));
    NodeFS.appendFileSync(file, "garbage\n".repeat(200));
    const updates = subscribe(root, fakeWatch());
    expect(updates[0]!.bad).toHaveLength(50);
    expect(updates[0]!.events).toHaveLength(1);
  });
});
