import { describe, expect, it } from "vitest";
import { readAiosMemorySummary } from "./aiosMemory.ts";

describe("readAiosMemorySummary", () => {
  it("returns not_detected when root is null", () => {
    const summary = readAiosMemorySummary(null);
    expect(summary.status).toBe("not_detected");
    expect(summary.docCount).toBe(0);
    expect(summary.identity).toBeNull();
  });

  it("reads live AIOS memory summary when given D:/Leonidas AIOS", () => {
    const summary = readAiosMemorySummary("D:/Leonidas AIOS");
    expect(summary.status).toBe("ready");
    expect(summary.docCount).toBeGreaterThan(100);
    expect(summary.identity?.name).toBe("Jake");
    expect(summary.decisionsCount).toBeGreaterThan(50);
    expect(summary.checks.correctionPropagation).toBe(true);
    expect(summary.checks.boundaryIsolation).toBe(true);
  });
});
