import { describe, expect, it } from "@effect/vitest";

import { personaEngineSupport } from "./personaEngines.ts";

const ask = (driver: string) =>
  personaEngineSupport({ driver, subagent: "explorer", engineName: "Antigravity" });

describe("personaEngineSupport", () => {
  it("starts a Claude child lean", () => {
    expect(ask("claudeAgent")).toEqual({ kind: "lean" });
  });

  it("warns that a Codex child starts larger", () => {
    const support = ask("codex");
    expect(support.kind).toBe("larger");
  });

  it("refuses an engine that ignores the persona, and says which", () => {
    const support = ask("antigravity");
    expect(support.kind).toBe("unsupported");
    if (support.kind === "unsupported") {
      expect(support.message).toContain('"explorer"');
      expect(support.message).toContain("Antigravity");
    }
  });
});
