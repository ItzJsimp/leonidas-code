// @effect-diagnostics nodeBuiltinImport:off - Bounded tail reads require a positioned file handle.
import * as NodeFSP from "node:fs/promises";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { buildPromptCandidates, type PromptCandidate } from "@t3tools/shared/promptPrediction";

const MAX_BYTES = 512 * 1024;
const REFRESH_MS = 30_000;

export class PromptPrediction extends Context.Service<
  PromptPrediction,
  {
    readonly candidates: (cwd: string) => Effect.Effect<readonly PromptCandidate[]>;
  }
>()("t3/workspace/PromptPrediction") {}

const make = Effect.gen(function* () {
  const path = yield* Path.Path;
  const home = yield* HostProcess.HomeDirectory;
  const env = yield* HostProcess.Environment;
  const cache = new Map<
    string,
    { checked: number; version: string; candidates: readonly PromptCandidate[] }
  >();
  const pending = new Map<string, Promise<readonly PromptCandidate[]>>();

  const load = async (file: string, now: number): Promise<readonly PromptCandidate[]> => {
    const previous = cache.get(file);
    if (previous && now - previous.checked < REFRESH_MS) return previous.candidates;
    let candidates: readonly PromptCandidate[] = [];
    let version = "missing";
    try {
      const handle = await NodeFSP.open(file, "r");
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) return [];
        version = `${stat.mtimeMs}:${stat.size}`;
        if (previous?.version === version) candidates = previous.candidates;
        else {
          const start = Math.max(0, stat.size - MAX_BYTES);
          const buffer = Buffer.alloc(Math.min(stat.size, MAX_BYTES));
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
          let text = buffer.subarray(0, bytesRead).toString("utf8");
          if (start > 0) text = text.slice(text.indexOf("\n") + 1);
          candidates = buildPromptCandidates(text);
        }
      } finally {
        await handle.close();
      }
    } catch {
      // Scribe is optional; missing, locked or unreadable history never blocks typing.
    }
    if (cache.size >= 32 && !cache.has(file)) cache.delete(cache.keys().next().value!);
    cache.set(file, { checked: now, version, candidates });
    return candidates;
  };
  const loadShared = (file: string, now: number) => {
    const existing = pending.get(file);
    if (existing) return existing;
    const request = load(file, now).finally(() => pending.delete(file));
    pending.set(file, request);
    return request;
  };
  return PromptPrediction.of({
    candidates: Effect.fn("PromptPrediction.candidates")(function* (cwd: string) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.promise(async () => {
        const files: string[] = [];
        if (env.LEONIDAS_SCRIBE_HISTORY) files.push(env.LEONIDAS_SCRIBE_HISTORY);
        else {
          let ancestor = cwd;
          for (let depth = 0; depth < 7; depth++) {
            files.push(
              path.join(ancestor, "LeonidasAI", "history.jsonl"),
              path.join(ancestor, "leonidas-scribe", "history.jsonl"),
            );
            const parent = path.dirname(ancestor);
            if (parent === ancestor) break;
            ancestor = parent;
          }
          files.push(path.join(home, "leonidas-scribe", "history.jsonl"));
        }
        for (const file of [...new Set(files)]) {
          const candidates = await loadShared(file, now);
          if (candidates.length > 0) return candidates;
        }
        return [];
      });
    }),
  });
});

export const layer = Layer.effect(PromptPrediction, make);
