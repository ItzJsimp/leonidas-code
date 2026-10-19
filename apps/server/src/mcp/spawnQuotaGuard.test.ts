import { describe, expect, it } from "@effect/vitest";
import type { ServerProvider } from "@t3tools/contracts";

import { spawnQuotaBlock } from "./spawnQuotaGuard.ts";

const NOW = Date.parse("2026-10-17T12:00:00.000Z");

const provider = (
  instanceId: string,
  windows: ReadonlyArray<{ readonly usedPercent: number; readonly resetsAt?: string }>,
  extra: Partial<ServerProvider> = {},
): ServerProvider =>
  ({
    instanceId,
    displayName: instanceId,
    auth: { status: "authenticated" },
    models: [{ slug: "model", name: "model", isCustom: false, capabilities: null }],
    usageLimits: {
      checkedAt: "2026-10-17T11:00:00.000Z",
      windows: windows.map((window, index) => ({
        id: `w${index}`,
        kind: index === 0 ? "session" : "weekly",
        label: index === 0 ? "5-hour" : "Weekly",
        ...window,
      })),
    },
    ...extra,
  }) as unknown as ServerProvider;

const check = (target: ServerProvider | undefined, providers: ReadonlyArray<ServerProvider>) =>
  spawnQuotaBlock({ target, providers, blockPercent: 90, nowMs: NOW, isRunnable: () => true });

describe("spawnQuotaBlock", () => {
  it("passes an account under the limit, with no data, or with no target", () => {
    const fine = provider("codex", [{ usedPercent: 40 }, { usedPercent: 89 }]);
    const unknown = { ...provider("claude", []), usageLimits: undefined } as ServerProvider;
    expect(check(fine, [fine])).toBeNull();
    expect(check(unknown, [unknown])).toBeNull();
    expect(check(undefined, [fine])).toBeNull();
  });

  it("ignores a window that has already reset", () => {
    const reset = provider("codex", [{ usedPercent: 99, resetsAt: "2026-10-17T11:59:00.000Z" }]);
    expect(check(reset, [reset])).toBeNull();
  });

  it("blocks at the threshold and ranks the accounts with room by headroom", () => {
    const codex = provider("codex", [
      { usedPercent: 12 },
      { usedPercent: 98, resetsAt: "2026-10-20T00:00:00.000Z" },
    ]);
    const claude = provider("claude", [{ usedPercent: 60 }]);
    const gemini = provider("gemini", [{ usedPercent: 5 }]);
    const full = provider("codex-team", [{ usedPercent: 95 }]);
    const message = check(codex, [codex, claude, gemini, full]);
    expect(message).toContain("codex has used 98% of its Weekly limit (resets 2026-10-20");
    expect(message).toContain(
      "Accounts with room: gemini (gemini, highest window 5%); claude (claude, highest window 60%).",
    );
    expect(message).not.toContain("codex-team");
  });

  it("blocks an account the provider marks as out of quota and says when none has room", () => {
    const codex = provider("codex", [], { connectionIssue: "quota_reached" });
    expect(check(codex, [codex])).toBe(
      "codex has reached its usage limit, so a child there would stop at the limit and lose its work. Do not spawn on this account. No other account has room. Do the work yourself or ask the user.",
    );
  });
});
