import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { expect } from "vite-plus/test";

import { auditContext, estimateTokens } from "./context-audit.ts";

it.layer(NodeServices.layer)("context-audit", (it) => {
  const write = Effect.fn("test.write")(function* (dir: string, name: string, body: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = path.join(dir, name);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, body);
    return file;
  });

  it("estimates roughly one token per four characters", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
    expect(estimateTokens("")).toBe(0);
  });

  it.effect("follows @imports once, counts each file once and totals the chain", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "ctx audit " });
      yield* write(dir, "a.md", "x".repeat(400));
      yield* write(dir, "b.md", "y".repeat(800));
      const root = yield* write(dir, "CLAUDE.md", "@a.md\n@b.md\n@a.md\n");
      const report = yield* Effect.promise(() => auditContext(root));
      expect(report.files.map((f) => path.basename(f.path)).toSorted()).toEqual([
        "CLAUDE.md",
        "a.md",
        "b.md",
      ]);
      expect(report.totalTokens).toBe(report.files.reduce((sum, f) => sum + f.tokens, 0));
      expect(report.files.find((f) => f.path.endsWith("b.md"))?.tokens).toBe(200);
    }),
  );

  it.effect("flags files over the budget and missing imports", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "ctx audit " });
      yield* write(dir, "big.md", "z".repeat(40_000));
      const root = yield* write(dir, "CLAUDE.md", "@big.md\n@gone.md\n");
      const report = yield* Effect.promise(() => auditContext(root, { fileBudgetTokens: 2000 }));
      expect(report.overBudget.map((f) => path.basename(f.path))).toEqual(["big.md"]);
      expect(report.missing).toEqual(["gone.md"]);
    }),
  );

  it.effect("flags duplicated paragraphs across files", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "ctx audit " });
      const para = "This exact paragraph is repeated in two instruction files for no reason.";
      yield* write(dir, "a.md", `${para}\n\nunique a`);
      const root = yield* write(dir, "CLAUDE.md", `@a.md\n\n${para}\n\nunique root`);
      const report = yield* Effect.promise(() => auditContext(root));
      expect(report.duplicates).toHaveLength(1);
      expect(report.duplicates[0]?.text).toContain("exact paragraph");
    }),
  );

  it.effect("sizes skill descriptions that are loaded every session", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "ctx audit " });
      yield* write(
        dir,
        "skills/one/SKILL.md",
        "---\nname: one\ndescription: " + "d".repeat(400) + "\n---\nbody",
      );
      const root = yield* write(dir, "CLAUDE.md", "hello");
      const report = yield* Effect.promise(() =>
        auditContext(root, { skillsDir: path.join(dir, "skills") }),
      );
      expect(report.skills).toEqual([
        { name: "one", tokens: estimateTokens("one" + "d".repeat(400)) },
      ]);
    }),
  );

  it.effect("skips linked skill folders", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "ctx audit " });
      yield* write(dir, "skills/one/SKILL.md", "description: original");
      yield* fs.symlink(path.join(dir, "skills/one"), path.join(dir, "skills/linked"));
      const root = yield* write(dir, "CLAUDE.md", "hello");
      const report = yield* Effect.promise(() =>
        auditContext(root, { skillsDir: path.join(dir, "skills") }),
      );
      expect(report.skills.map((skill) => skill.name)).toEqual(["one"]);
    }),
  );
});
