import { describe, expect, it } from "vite-plus/test";

import { roleWords } from "./team.logic";

describe("roleWords", () => {
  it("says what a role can do in plain words", () => {
    expect(roleWords({ write: "none", approve: "none", manage: "none" })).toBe("Can read only");
    expect(roleWords({ write: "files", approve: "none", manage: "none" })).toBe("Edits files");
    expect(roleWords({ write: "all", approve: "area", manage: "area" })).toBe(
      "Edits anything, approves in its area, manages its area",
    );
    expect(roleWords({ write: "all", approve: "wall", manage: "org" })).toBe(
      "Edits anything, approves everywhere, manages the whole business",
    );
  });
});
