// @effect-diagnostics globalDate:off globalDateInEffect:off -- Local calendar cutoffs and fixtures use the operating system time zone.
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import {
  DEFAULT_SERVER_SETTINGS,
  IsoDateTime,
  type ScribeHistoryItem,
  type ServerProvider,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as TestClock from "effect/testing/TestClock";
import * as ServerConfig from "../config.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as ProjectService from "../project/ProjectService.ts";
import * as TaskBoardService from "../taskBoard/TaskBoardService.ts";
import * as TextGeneration from "../textGeneration/TextGeneration.ts";
import * as ScribeEngine from "./ScribeEngine.ts";
import * as VoiceLogMemory from "./VoiceLogMemory.ts";

it.effect("skips all work without Yes, persists a draft, and writes only approved lines", () =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* TestClock.setTime(new Date(2026, 9, 20, 4).getTime());
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "voice-log-memory-" });
      const aios = path.join(temp, "AIOS with spaces");
      const target = path.join(aios, "memory", "observed", "voice-log.md");
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFileString(target, "# Existing memories\n");
      let enabled = false;
      let historyCalls = 0;
      const sent: string[][] = [];
      const take = (patch: Partial<ScribeHistoryItem> = {}) =>
        ({
          at: new Date(2026, 9, 19, 12).toISOString(),
          private: false,
          app: "Code.exe",
          cleanedText: "I prefer short replies.",
          ...patch,
        }) as ScribeHistoryItem;
      const provider = {
        instanceId: "codex",
        driver: "codex",
        auth: { status: "authenticated" },
        models: [{ slug: "gpt-6-luna", name: "Luna" }],
      } as unknown as ServerProvider;
      const dependencies = Layer.mergeAll(
        ServerConfig.layerTest(temp, path.join(temp, "app")),
        Layer.mock(ServerSettings.ServerSettingsService)({
          getSettings: Effect.sync(() => ({
            ...DEFAULT_SERVER_SETTINGS,
            voiceLogMemory: { enabled, skipApps: ["bitwarden"] },
          })),
        }),
        Layer.mock(ProviderRegistry.ProviderRegistry)({ getProviders: Effect.succeed([provider]) }),
        Layer.mock(ProjectService.ProjectService)({
          snapshot: Effect.succeed({
            projects: [],
            updatedAt: IsoDateTime.make("2026-10-20T00:00:00Z"),
          }),
        }),
        Layer.mock(TaskBoardService.TaskBoardService)({ aiosRoot: () => Effect.succeed(aios) }),
        Layer.mock(ScribeEngine.ScribeEngine)({
          listPublicHistory: () =>
            Effect.sync(() => {
              historyCalls++;
              return {
                items: [
                  take({ private: true, cleanedText: "private secret" }),
                  take({ private: undefined, cleanedText: "old secret" }),
                  take({ app: "Bitwarden.exe", cleanedText: "password" }),
                  take(),
                ],
                next: null,
              };
            }),
        }),
        Layer.mock(TextGeneration.TextGeneration)({
          generateVoiceLogDraft: (input) =>
            Effect.sync(() => {
              sent.push([...input.texts]);
              return { lines: ["Unselected line", "Approved preference"] };
            }),
        }),
      );
      yield* Effect.gen(function* () {
        const service = yield* VoiceLogMemory.make;
        yield* service.tick;
        expect(historyCalls).toBe(0);
        expect(sent).toEqual([]);
        enabled = true;
        yield* service.tick;
        yield* service.tick;
        expect(historyCalls).toBe(1);
        expect(sent).toEqual([["I prefer short replies."]]);
        expect(yield* fs.readFileString(target)).toBe("# Existing memories\n");
        const restarted = yield* VoiceLogMemory.make;
        const review = yield* restarted.review;
        expect(review.draft?.lines).toEqual(["Unselected line", "Approved preference"]);
        yield* restarted.approve({ draftId: review.draft!.id, selected: [1] });
        const saved = yield* fs.readFileString(target);
        expect(saved).toContain("# Existing memories");
        expect(saved).toContain("Approved preference");
        expect(saved).not.toContain("Unselected line");
        expect((yield* restarted.review).draft).toBeNull();
        yield* restarted.tick;
        expect(sent).toHaveLength(1);
      }).pipe(Effect.provide(dependencies));
    }),
  ).pipe(Effect.provide(NodeServices.layer)),
);
