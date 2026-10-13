import { describe, expect, it } from "vite-plus/test";

import { countActiveAgentsByAccount, resolveAccountKey } from "./activeAgentCounts.ts";

const provider = (instanceId: string, extra: Record<string, unknown> = {}) =>
  ({ instanceId, driver: "claudeAgent", ...extra }) as never;
const thread = (instanceId: string, status: string, archivedAt: string | null = null) =>
  ({
    modelSelection: { instanceId },
    runtime: { status, providerInstanceId: instanceId },
    archivedAt,
  }) as never;

describe("countActiveAgentsByAccount", () => {
  it("counts running and waiting threads and ignores idle, queued and archived", () => {
    const counts = countActiveAgentsByAccount({
      providers: [provider("a")],
      threads: [
        thread("a", "running"),
        thread("a", "waiting"),
        thread("a", "idle"),
        thread("a", "queued"),
        thread("a", "running", "2026-01-01"),
      ],
    });
    expect(counts.get(resolveAccountKey(provider("a")))).toBe(2);
  });

  it("merges instances that share an email on the same driver", () => {
    const auth = { email: "Me@x.com" };
    const providers = [provider("a", { auth }), provider("b", { auth })];
    const counts = countActiveAgentsByAccount({
      providers,
      threads: [thread("a", "running"), thread("b", "running")],
    });
    expect([...counts.values()]).toEqual([2]);
  });

  it("keeps separate accounts apart and handles unknown instances", () => {
    const counts = countActiveAgentsByAccount({
      providers: [
        provider("a", { auth: { email: "a@x" } }),
        provider("b", { auth: { email: "b@x" } }),
      ],
      threads: [thread("a", "running"), thread("b", "running"), thread("zz", "running")],
    });
    expect(counts.size).toBe(3);
  });
});
