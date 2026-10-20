import { describe, expect, it } from "vitest";

import { PRIVACY_POLICY_URL } from "./legalLinks";

describe("legalLinks", () => {
  it("points the privacy link at Leonidas, not upstream T3", () => {
    expect(PRIVACY_POLICY_URL).not.toContain("t3.codes");
    expect(PRIVACY_POLICY_URL).toContain("ItzJsimp/leonidas-code");
  });
});
