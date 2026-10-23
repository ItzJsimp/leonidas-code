import { describe, expect, it } from "vitest";

import { limitFill, limitText } from "./useLimitView";

describe("limitFill", () => {
  it("fills by the part used in the used view", () => {
    expect(limitFill(14, "used")).toBe(14);
    expect(limitText(14, "used")).toBe("14% used");
  });
  it("fills by the part left in the left view", () => {
    expect(limitFill(14, "left")).toBe(86);
    expect(limitText(14, "left")).toBe("86% left");
  });
  it("clamps out of range values", () => {
    expect(limitFill(140, "used")).toBe(100);
    expect(limitFill(-5, "left")).toBe(100);
  });
});
