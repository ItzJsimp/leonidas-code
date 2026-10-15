import { describe, expect, it } from "vite-plus/test";

import { friendlyErrorDetails, friendlyErrorMessage } from "./friendlyError";

describe("friendlyErrorMessage", () => {
  it("maps known causes to a plain sentence", () => {
    expect(friendlyErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1:1"))).toContain(
      "network",
    );
    expect(friendlyErrorMessage(new Error("EACCES: permission denied"))).toContain("permission");
    expect(friendlyErrorMessage(new Error("ENOENT: no such file"))).toContain("find");
  });
  it("keeps an unknown message and replaces an empty one", () => {
    expect(friendlyErrorMessage(new Error("Branch is locked"))).toBe("Branch is locked");
    expect(friendlyErrorMessage(undefined)).toBe(
      "Something went wrong. Copy the details and try again.",
    );
  });
  it("keeps the raw text for Copy details", () => {
    expect(friendlyErrorDetails("boom")).toBe("boom");
    expect(friendlyErrorDetails(new Error("boom"))).toContain("boom");
  });
});
