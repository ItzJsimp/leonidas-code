import { describe, expect, it } from "vite-plus/test";
import { isCompactChatHeader, resolveRenameCommit } from "./ChatHeader";

describe("resolveRenameCommit", () => {
  it("commits a trimmed changed title", () => {
    expect(resolveRenameCommit({ title: "  New title ", originalTitle: "Old" })).toEqual({
      action: "commit",
      title: "New title",
    });
  });

  it("rejects empty and whitespace-only titles", () => {
    expect(resolveRenameCommit({ title: "   ", originalTitle: "Old" })).toEqual({
      action: "reject-empty",
    });
  });

  it("no-ops when the trimmed title is unchanged", () => {
    expect(resolveRenameCommit({ title: " Old ", originalTitle: "Old" })).toEqual({
      action: "noop",
    });
  });
});

describe("isCompactChatHeader", () => {
  it("is compact only below 728 px", () => {
    expect(isCompactChatHeader(390)).toBe(true);
    expect(isCompactChatHeader(727)).toBe(true);
    expect(isCompactChatHeader(728)).toBe(false);
  });

  it("is not compact before the width is known", () => {
    expect(isCompactChatHeader(null)).toBe(false);
  });
});
