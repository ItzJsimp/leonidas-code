import { describe, expect, it } from "vite-plus/test";
import { measureOutputCompliance, canvasRequired } from "./outputCompliance.ts";
const top = "🎯 **Focus:** `Code` · **Step:** `Review`\n\n";
const dock = "\n---\n### 🎯 TL;DR\n- Ready\n";
describe("output compliance measurement", () => {
  it("exempts short answers while measuring substantive shape", () => {
    expect(measureOutputCompliance("Yes.", false).eligible).toBe(false);
    expect(measureOutputCompliance(top + "Done." + dock, false)).toMatchObject({
      eligible: true,
      top: true,
      dock: true,
      canvasRequired: false,
      canvas: true,
    });
    expect(measureOutputCompliance("word ".repeat(401), false)).toMatchObject({
      eligible: true,
      top: false,
      dock: false,
      canvas: false,
    });
  });
  it("checks body length without counting the Dock", () => {
    expect(canvasRequired("word ".repeat(400))).toBe(false);
    expect(canvasRequired("word ".repeat(401))).toBe(true);
    expect(
      measureOutputCompliance(top + "Done" + dock + "word ".repeat(401), false).canvasRequired,
    ).toBe(false);
  });
  it.each(["Specification", "Architecture", "Deep research", "Roadmap", "Audit"])(
    "requires canvas for a %s heading",
    (kind) => {
      expect(canvasRequired(`### 🔍 ${kind}\nA substantive result`)).toBe(true);
      expect(measureOutputCompliance(top + `### ${kind}\nResult` + dock, true).canvas).toBe(true);
    },
  );
  it("does not treat a fenced example or mention as the output category", () => {
    expect(canvasRequired("Use an architecture diagram later.")).toBe(false);
    expect(canvasRequired("```md\n### Architecture\n```\nDone")).toBe(false);
    expect(canvasRequired("````md\n" + "word ".repeat(401) + "\n`````\nDone")).toBe(false);
  });
});
