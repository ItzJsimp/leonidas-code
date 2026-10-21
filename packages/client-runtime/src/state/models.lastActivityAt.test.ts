import { EnvironmentId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { presentThreadShell } from "./models.ts";
import { v2ThreadShell } from "./orchestrationV2TestFixtures.ts";

const environmentId = EnvironmentId.make("environment-v2");

describe("presentThreadShell lastActivityAt", () => {
  it("leaves the key out when the shell does not carry it", () => {
    const { lastActivityAt: _omitted, ...withoutKey } = v2ThreadShell;
    const shell = presentThreadShell(environmentId, withoutKey);
    expect("lastActivityAt" in shell).toBe(false);
  });

  it("keeps an explicit null", () => {
    const shell = presentThreadShell(environmentId, { ...v2ThreadShell, lastActivityAt: null });
    expect(shell.lastActivityAt).toBeNull();
  });

  it("presents a DateTime as an ISO string", () => {
    const shell = presentThreadShell(environmentId, {
      ...v2ThreadShell,
      lastActivityAt: DateTime.makeUnsafe("2026-06-20T02:03:04.000Z"),
    });
    expect(shell.lastActivityAt).toBe("2026-06-20T02:03:04.000Z");
  });
});
