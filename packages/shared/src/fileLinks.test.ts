import { describe, expect, it } from "vite-plus/test";
import { parseFileUrlHref, splitFilePathPosition, resolvePathLinkTarget } from "./fileLinks.ts";

describe("parseFileUrlHref", () => {
  it.each([
    ["file:///Users/julius/project/src/main.ts#L42", "/Users/julius/project/src/main.ts", "#L42"],
    [
      "file:///D:/Programme/t3code/OpenInPicker.tsx#L69",
      "D:/Programme/t3code/OpenInPicker.tsx",
      "#L69",
    ],
    ["file://server/share/workspace-image.svg", "\\\\server\\share\\workspace-image.svg", ""],
    ["file://localhost/home/me/notes.md", "/home/me/notes.md", ""],
  ])("parses %s", (href, path, hash) => {
    expect(parseFileUrlHref(href)).toEqual({ path, hash });
  });

  it("keeps percent-encoding so the caller decodes once", () => {
    expect(parseFileUrlHref("file:///Users/julius/project/file%2520name.md")?.path).toBe(
      "/Users/julius/project/file%2520name.md",
    );
    expect(parseFileUrlHref("file:///c%3A/Users/x/shot.png")?.path).toBe("/c%3A/Users/x/shot.png");
  });

  it.each(["https://example.com/a.ts", "file://%", "/Users/julius/a.ts"])("rejects %s", (href) => {
    expect(parseFileUrlHref(href)).toBeNull();
  });
});

describe("splitFilePathPosition", () => {
  it.each([
    ["src/main.ts", "", { path: "src/main.ts" }],
    ["src/main.ts:12", "", { path: "src/main.ts", line: 12 }],
    ["src/main.ts:12:5", "", { path: "src/main.ts", line: 12, column: 5 }],
    ["src/main.ts", "#L18C2", { path: "src/main.ts", line: 18, column: 2 }],
    ["src/main.ts:3", "#L18C2", { path: "src/main.ts", line: 3 }],
    ["src/main.ts:0", "", { path: "src/main.ts" }],
    ["src/main.ts", "#section", { path: "src/main.ts" }],
  ])("splits %s%s", (path, hash, expected) => {
    expect(splitFilePathPosition(path, hash)).toEqual(expected);
  });
});

describe("resolvePathLinkTarget", () => {
  it("resolves relative paths against cwd", () => {
    expect(
      resolvePathLinkTarget(
        "src/components/ThreadTerminalDrawer.tsx:42:7",
        "/Users/julius/project",
      ),
    ).toBe("/Users/julius/project/src/components/ThreadTerminalDrawer.tsx:42:7");
  });

  it("collapses .. segments so a link out of the project becomes an absolute path", () => {
    expect(
      resolvePathLinkTarget(
        "../../handoff-docs/note.md:3",
        "D:\\Leonidas AIOS\\projects\\leonidas-code",
      ),
    ).toBe("D:\\Leonidas AIOS\\handoff-docs\\note.md:3");
    expect(resolvePathLinkTarget("../notes/a.md", "/Users/julius/project")).toBe(
      "/Users/julius/notes/a.md",
    );
  });

  it("collapses . segments and keeps a link that stays inside the project", () => {
    expect(resolvePathLinkTarget("./src/../src/a.ts", "/Users/julius/project")).toBe(
      "/Users/julius/project/src/a.ts",
    );
  });

  it("never climbs above the filesystem root", () => {
    expect(resolvePathLinkTarget("../../../../x.md", "/Users/julius")).toBe("/x.md");
    expect(resolvePathLinkTarget("..\\..\\..\\x.md", "C:\\Users\\julius")).toBe("C:\\x.md");
  });

  it("keeps absolute paths unchanged", () => {
    expect(
      resolvePathLinkTarget("/Users/julius/project/src/main.ts:12", "/Users/julius/project"),
    ).toBe("/Users/julius/project/src/main.ts:12");
  });

  it("keeps Windows absolute paths with forward slashes unchanged", () => {
    expect(
      resolvePathLinkTarget("C:/Users/julius/project/src/main.ts:12", "C:\\Users\\julius\\project"),
    ).toBe("C:/Users/julius/project/src/main.ts:12");
  });

  it.each([
    ["C:\\Users\\julius\\project", "C:\\Users\\julius\\notes.md:3"],
    ["C:/Users/julius/project", "C:/Users/julius\\notes.md:3"],
  ])("resolves home paths against the Windows cwd %s", (cwd, expected) => {
    expect(resolvePathLinkTarget("~/notes.md:3", cwd)).toBe(expected);
  });
});
