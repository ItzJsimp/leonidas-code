import { describe, expect, it } from "vite-plus/test";

import { splitTourMarker } from "./tourTargets";

describe("splitTourMarker", () => {
  it("strips a known marker and returns its target", () => {
    expect(splitTourMarker("Added a Command Center page {tour:command-center}")).toEqual({
      text: "Added a Command Center page",
      targetId: "command-center",
    });
  });

  it("strips an unknown marker without offering a tour", () => {
    expect(splitTourMarker("Fixed a crash {tour:does-not-exist}")).toEqual({
      text: "Fixed a crash",
      targetId: null,
    });
  });

  it("leaves bullets without a marker alone", () => {
    expect(splitTourMarker("Fixed a crash")).toEqual({ text: "Fixed a crash", targetId: null });
  });
});
