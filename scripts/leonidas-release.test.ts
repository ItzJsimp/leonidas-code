import { describe, expect, it } from "vite-plus/test";
import { classifyRelease, nextReleaseVersion, releaseNotes } from "./leonidas-release.ts";

describe("Leonidas release policy", () => {
  it("reserves 1.0.0 for an explicit public launch", () => {
    expect(nextReleaseVersion("0.1.2", "patch", true)).toBe("0.1.3");
    expect(nextReleaseVersion("0.1.2", "minor", true)).toBe("0.2.0");
    expect(nextReleaseVersion("0.1.2", "major", true)).toBe("0.2.0");
    expect(nextReleaseVersion("0.2.0", "launch", true)).toBe("1.0.0");
    expect(() => nextReleaseVersion("1.0.16", "patch", true)).toThrow();
  });
  it("selects the highest change category and handles breaking trailers", () => {
    expect(
      classifyRelease([
        { subject: "fix: counter", body: "" },
        { subject: "feat: history", body: "" },
      ]),
    ).toBe("minor");
    expect(classifyRelease([{ subject: "Build: Add history", body: "" }])).toBe("minor");
    expect(classifyRelease([{ subject: "fix!: format", body: "" }])).toBe("major");
    expect(classifyRelease([{ subject: "fix: format", body: "BREAKING CHANGE: new format" }])).toBe(
      "major",
    );
    expect(nextReleaseVersion("1.2.3", "major", false)).toBe("2.0.0");
    expect(() => nextReleaseVersion("1.2.3", "launch", false)).toThrow();
    expect(() => nextReleaseVersion("01.2.3", "patch", false)).toThrow();
  });
  it("groups all patch notes and uses human-readable release trailers", () => {
    const notes = releaseNotes(
      [
        {
          subject: "feat: internal implementation",
          body: "Release-Note: Browse past updates\nRelease-Note: See live tokens",
        },
        { subject: "fix: missing counter", body: "" },
        { subject: "ci: cache Rust", body: "" },
        { subject: "docs: status", body: "" },
      ],
      "0.2.0",
      true,
    );
    expect(notes).toContain("0.2.0 · Development");
    expect(notes).toContain("## New\n- Browse past updates\n- See live tokens");
    expect(notes).toContain("## Fixed\n- missing counter");
    expect(notes).toContain("## Improved\n- cache Rust");
    expect(notes).not.toContain("internal implementation");
    expect(notes).not.toContain("status");
  });
});
