import { assert, describe, it } from "@effect/vitest";
import { DOCK_HEADINGS } from "@t3tools/shared/outputDock";

import {
  LEONIDAS_OUTPUT_STANDARD,
  LEONIDAS_RENDER_CONTRACT,
  LEONIDAS_REPLY_STYLE,
} from "./outputStandard.ts";

describe("render contract and Leonidas reply style", () => {
  it("names every answer block type the chat can render", () => {
    for (const type of ["choices", "checklist", "table", "chart"]) {
      assert.include(LEONIDAS_RENDER_CONTRACT, `leo:${type}`);
    }
  });

  it("names every Dock heading the client parses", () => {
    for (const heading of Object.keys(DOCK_HEADINGS)) {
      assert.include(LEONIDAS_RENDER_CONTRACT, `\`${heading}\``);
    }
  });

  it("keeps the shipped Leonidas style inside the preset cap, without the zone lock", () => {
    assert.isAtMost(LEONIDAS_REPLY_STYLE.length, 4_000);
    assert.notInclude(LEONIDAS_OUTPUT_STANDARD, "may not remove, reorder or rename");
  });

  // Ratchet: every turn pays for this text. 5,198 was the single standard before the split.
  it("costs no more than the single standard it replaced", () => {
    assert.isAtMost(LEONIDAS_OUTPUT_STANDARD.length, 5_198);
  });
});
