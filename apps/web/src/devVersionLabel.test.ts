import { describe, expect, it } from "@effect/vitest";

import { formatDevVersionLabel } from "./devVersionLabel";

describe("formatDevVersionLabel", () => {
  it("shows the nearest release plus how many changes came after it", () => {
    expect(formatDevVersionLabel("v0.12.0-17-gb5aae7f018")).toBe("0.12.0+17");
  });

  it("shows the plain release when the checkout is exactly on it", () => {
    expect(formatDevVersionLabel("v0.12.0-0-gb5aae7f018\n")).toBe("0.12.0");
  });

  it("gives up on anything that is not a long describe", () => {
    expect(formatDevVersionLabel("b5aae7f018")).toBeNull();
    expect(formatDevVersionLabel("")).toBeNull();
  });
});
