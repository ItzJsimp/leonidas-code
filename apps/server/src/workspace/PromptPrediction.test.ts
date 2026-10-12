import * as NodeServices from "@effect/platform-node/NodeServices";
import { it, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as TestClock from "effect/testing/TestClock";
import * as PromptPrediction from "./PromptPrediction.ts";

const testLayer = PromptPrediction.layer.pipe(Layer.provideMerge(NodeServices.layer));
it.layer(testLayer)("PromptPrediction", (it) => {
  it.effect("discovers sibling history and returns agent prompts without raw records", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const service = yield* PromptPrediction.PromptPrediction;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.makeDirectory(path.join(root, "LeonidasAI"));
      const file = path.join(root, "LeonidasAI", "history.jsonl");
      yield* fs.writeFileString(
        file,
        JSON.stringify({
          app: "claude.exe",
          mode: "dictation",
          cleaned_text: "Run the tests",
          raw_text: "never return raw text",
        }),
      );
      const first = yield* service.candidates(path.join(root, "code"));
      expect(first).toEqual([{ text: "Run the tests", count: 1, lastSeen: 1 }]);
      yield* fs.writeFileString(file, "{broken");
      expect(yield* service.candidates(path.join(root, "code"))).toBe(first);
      yield* TestClock.adjust("31 seconds");
      yield* fs.writeFileString(
        file,
        JSON.stringify({ app: "claude.exe", mode: "hands-free", cleaned_text: "Check the diff" }),
      );
      expect((yield* service.candidates(path.join(root, "code"))).map((c) => c.text)).toEqual([
        "Check the diff",
      ]);
    }),
  );
  it.effect("bounds tail reads and ignores a cut record", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const service = yield* PromptPrediction.PromptPrediction;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.makeDirectory(path.join(root, "LeonidasAI"));
      yield* fs.writeFileString(
        path.join(root, "LeonidasAI", "history.jsonl"),
        "x".repeat(600_000) +
          "\n" +
          JSON.stringify({ app: "codex.exe", mode: "dictation", cleaned_text: "Fix the test" }) +
          "\n{unfinished",
      );
      expect((yield* service.candidates(path.join(root, "code"))).map((c) => c.text)).toEqual([
        "Fix the test",
      ]);
    }),
  );
  it.effect("finds Scribe history from a nested git worktree and project path", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const service = yield* PromptPrediction.PromptPrediction;
      const root = yield* fs.makeTempDirectoryScoped();
      const historyDir = path.join(root, "LeonidasAI");
      const nested = path.join(
        root,
        "projects",
        "leonidas-code",
        ".worktrees",
        "feature",
        "apps",
        "server",
      );
      yield* fs.makeDirectory(historyDir, { recursive: true });
      yield* fs.makeDirectory(nested, { recursive: true });
      yield* fs.writeFileString(
        path.join(historyDir, "history.jsonl"),
        JSON.stringify({
          app: "codex.exe",
          mode: "dictation",
          cleaned_text: "Review the auth refresh",
        }),
      );
      expect((yield* service.candidates(nested)).map((candidate) => candidate.text)).toEqual([
        "Review the auth refresh",
      ]);
    }),
  );
});
