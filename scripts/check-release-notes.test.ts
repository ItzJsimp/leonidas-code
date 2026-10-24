// @effect-diagnostics nodeBuiltinImport:off - Tests exercise the dependency-free release notes check.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { checkReleaseNotes, noteProblems } from "./check-release-notes.ts";

const GOOD = "Release-Note: Added a reply style menu, so you can change how the AI answers.";
const STORY = [
  "# Choose how the AI answers",
  "",
  "You can now pick a reply style for each chat.",
  "",
  "![The reply style menu next to the model picker](menu.webp)",
  "",
  "## Pick a style",
  "Open the menu and choose a style.",
  "",
  "## Make your own",
  "Duplicate a style and edit its instructions.",
].join("\n");

let root = "";
function project(files: Record<string, string | number>): string {
  root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "release-notes-"));
  for (const [file, content] of Object.entries(files)) {
    const path = NodePath.join(root, file);
    NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true });
    NodeFS.writeFileSync(path, typeof content === "number" ? Buffer.alloc(content) : content);
  }
  return root;
}
afterEach(() => {
  if (root) NodeFS.rmSync(root, { recursive: true, force: true });
  root = "";
});

describe("release notes check", () => {
  it("passes an internal-only range with no notes and says it is internal", () => {
    const result = checkReleaseNotes({
      commits: [
        { subject: "ci: cache the store", body: "" },
        { subject: "docs: explain the ladder", body: "" },
        { subject: "fix(ci): pin the runner", body: "" },
        { subject: "refactor(web): split a file", body: "" },
      ],
      kind: "patch",
      root: project({}),
    });
    expect(result).toEqual({ ok: true, internalOnly: true, reasons: [] });
  });

  it("fails a user-visible feat or fix range with no Release-Note trailer", () => {
    for (const subject of ["feat(web): add a menu", "fix: stop a crash", "Build: Add history"]) {
      const result = checkReleaseNotes({
        commits: [{ subject, body: "" }],
        kind: "patch",
        root: project({}),
      });
      expect(result.ok).toBe(false);
      expect(result.internalOnly).toBe(false);
      expect(result.reasons.join("\n")).toMatch(/no Release-Note/);
    }
  });

  it("ignores a Release-Note of none", () => {
    const result = checkReleaseNotes({
      commits: [
        { subject: "docs: note", body: "Release-Note: none" },
        { subject: "fix(web): fix a menu", body: GOOD },
      ],
      kind: "patch",
      root: project({}),
    });
    expect(result).toEqual({ ok: true, internalOnly: false, reasons: [] });
  });

  it("passes when one commit in the range carries a good trailer", () => {
    const result = checkReleaseNotes({
      commits: [
        { subject: "feat(web): add a menu", body: "" },
        { subject: "docs: release notes for the menu", body: GOOD },
      ],
      kind: "patch",
      root: project({}),
    });
    expect(result).toEqual({ ok: true, internalOnly: false, reasons: [] });
  });

  it("fails weak trailers and names each problem", () => {
    const result = checkReleaseNotes({
      commits: [
        {
          subject: "feat: things",
          body: [
            "Release-Note: add a menu for reply styles in the composer footer area",
            "Release-Note: Added a menu.",
            "Release-Note: Fixed the RPC contract so the projection stops dropping rows in the list view",
            "Release-Note: Behind-the-scenes reliability improvements",
          ].join("\n"),
        },
      ],
      kind: "patch",
      root: project({}),
    });
    expect(result.ok).toBe(false);
    expect(result.reasons).toHaveLength(4);
  });

  it("explains why one trailer is weak", () => {
    expect(noteProblems("Added a reply style menu, so you can change how the AI answers.")).toEqual(
      [],
    );
    expect(noteProblems("add a reply style menu so you can change how answers look")).toContain(
      "start with Added, Improved, Fixed, Changed or Removed",
    );
    expect(noteProblems("Fixed a crash.")).toContain("use 8 to 18 words (now 3)");
    expect(
      noteProblems(
        "Improved the reply style button so it is now a small icon next to effort and your model and effort controls stay in view.",
      ),
    ).toContain("use 8 to 18 words (now 24)");
    expect(
      noteProblems("Fixed releaseHistory.ts parsing so old updates show again (#42) in history."),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/internal term/)]));
    expect(
      noteProblems("Improved behind-the-scenes reliability for everyone who uses the app daily."),
    ).toContain("say what the user sees, not a general reliability claim");
  });

  it("requires a story with a title, intro, real screenshot and two sections for a MINOR release", () => {
    const missing = checkReleaseNotes({
      commits: [{ subject: "feat: big", body: `${GOOD}\nRelease-Size: big` }],
      kind: "minor",
      root: project({}),
    });
    expect(missing.ok).toBe(false);
    expect(missing.reasons.join("\n")).toMatch(/needs a Release-Post story/);

    const good = checkReleaseNotes({
      commits: [
        {
          subject: "feat: big",
          body: `${GOOD}\nRelease-Post: release-posts/styles.md\nRelease-Size: big`,
        },
      ],
      kind: "minor",
      root: project({ "release-posts/styles.md": STORY, "release-posts/menu.webp": 1000 }),
    });
    expect(good).toEqual({ ok: true, internalOnly: false, reasons: [] });
  });

  it("names each story defect", () => {
    const cases: Array<[Record<string, string | number>, RegExp]> = [
      [
        {
          "release-posts/styles.md": STORY.replace("menu.webp", "menu.png"),
          "release-posts/menu.png": 10,
        },
        /WebP or AVIF/,
      ],
      [{ "release-posts/styles.md": STORY, "release-posts/menu.webp": 2_000_001 }, /2 MB/],
      [{ "release-posts/styles.md": STORY }, /not found/],
      [
        {
          "release-posts/styles.md": STORY.replace(
            "The reply style menu next to the model picker",
            "",
          ),
          "release-posts/menu.webp": 10,
        },
        /alt text/,
      ],
      [
        {
          "release-posts/styles.md": STORY.replace("## Make your own", "Make your own"),
          "release-posts/menu.webp": 10,
        },
        /2 or more feature sections/,
      ],
      [
        { "release-posts/styles.md": STORY.replace(/!\[.*\n/, ""), "release-posts/menu.webp": 10 },
        /at least 1 screenshot/,
      ],
      [
        {
          "release-posts/styles.md": STORY.replace("# Choose how the AI answers\n\n", ""),
          "release-posts/menu.webp": 10,
        },
        /title and an introduction/,
      ],
    ];
    for (const [files, reason] of cases) {
      const result = checkReleaseNotes({
        commits: [{ subject: "feat: big", body: `${GOOD}\nRelease-Post: release-posts/styles.md` }],
        kind: "minor",
        root: project(files),
      });
      expect(result.ok, String(reason)).toBe(false);
      expect(result.reasons.join("\n")).toMatch(reason);
      NodeFS.rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a story path outside release-posts", () => {
    const result = checkReleaseNotes({
      commits: [{ subject: "feat: big", body: `${GOOD}\nRelease-Post: ../secret.md` }],
      kind: "minor",
      root: project({}),
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.join("\n")).toMatch(/inside release-posts/);
  });
});
