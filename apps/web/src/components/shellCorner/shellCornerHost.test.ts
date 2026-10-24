import { describe, expect, it } from "vite-plus/test";

import { claimShellCorner, isShellCornerClaimed } from "./shellCornerHost";

describe("shell corner claims", () => {
  it("stays claimed until every claim is released", () => {
    expect(isShellCornerClaimed()).toBe(false);
    const first = claimShellCorner();
    const second = claimShellCorner();
    first();
    expect(isShellCornerClaimed()).toBe(true);
    second();
    expect(isShellCornerClaimed()).toBe(false);
  });

  it("ignores a second release of the same claim", () => {
    const first = claimShellCorner();
    const second = claimShellCorner();
    first();
    first();
    expect(isShellCornerClaimed()).toBe(true);
    second();
    expect(isShellCornerClaimed()).toBe(false);
  });
});
