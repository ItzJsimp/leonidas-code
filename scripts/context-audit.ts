// Reports what an agent session loads before the first message: the CLAUDE.md
// @import chain, duplicated paragraphs across it, and skill descriptions.
// Usage: node scripts/context-audit.ts [CLAUDE.md] [--skills <dir>] [--budget <tokens>]
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export interface ContextFile {
  readonly path: string;
  readonly tokens: number;
}

export interface ContextReport {
  readonly files: ReadonlyArray<ContextFile>;
  readonly totalTokens: number;
  readonly overBudget: ReadonlyArray<ContextFile>;
  readonly missing: ReadonlyArray<string>;
  readonly duplicates: ReadonlyArray<{ text: string; paths: ReadonlyArray<string> }>;
  readonly skills: ReadonlyArray<{ name: string; tokens: number }>;
}

interface AuditOptions {
  readonly fileBudgetTokens?: number;
  readonly skillsDir?: string;
}

// An import is an `@path` token at the start of a line; `\ ` escapes a space.
const IMPORT_LINE = /^@((?:\\ |\S)+)\s*$/;
const MIN_DUPLICATE_CHARS = 60;

export async function auditContext(
  rootFile: string,
  options: AuditOptions = {},
): Promise<ContextReport> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const readSkills = function* (dir: string) {
        if (!(yield* fs.exists(dir))) return [];
        const entries = yield* fs.readDirectory(dir);
        const skills = yield* Effect.forEach(entries, (name) =>
          Effect.gen(function* () {
            const entry = path.join(dir, name);
            // stat follows links, while the original directory-entry check skipped them.
            const linked = yield* fs.readLink(entry).pipe(
              Effect.map(() => true),
              Effect.catch((error) => {
                const cause = error.reason.cause;
                return typeof cause === "object" &&
                  cause !== null &&
                  "code" in cause &&
                  cause.code === "EINVAL"
                  ? Effect.succeed(false)
                  : Effect.fail(error);
              }),
            );
            if (linked || (yield* fs.stat(entry)).type !== "Directory") return [];
            const file = path.join(dir, name, "SKILL.md");
            if (!(yield* fs.exists(file))) return [];
            const description =
              /^description:\s*(.+)$/m.exec(yield* fs.readFileString(file))?.[1] ?? "";
            return [{ name, tokens: estimateTokens(name + description) }];
          }),
        );
        return skills.flat().toSorted((a, b) => b.tokens - a.tokens);
      };
      const seen = new Map<string, string>();
      const missing: string[] = [];
      const visit = (file: string): Effect.Effect<void, PlatformError.PlatformError> =>
        Effect.gen(function* () {
          const key = path.resolve(file);
          if (seen.has(key)) return;
          const text = yield* fs.readFileString(key);
          seen.set(key, text);
          for (const line of text.split(/\r?\n/)) {
            const target = IMPORT_LINE.exec(line)?.[1]?.replaceAll("\\ ", " ");
            if (!target) continue;
            const resolved = path.resolve(path.dirname(key), target);
            if (yield* fs.exists(resolved)) yield* visit(resolved);
            else missing.push(target);
          }
        });
      yield* visit(rootFile);

      const files = [...seen].map(([file, text]) => ({ path: file, tokens: estimateTokens(text) }));
      const budget = options.fileBudgetTokens ?? 3000;
      const paragraphs = new Map<string, Set<string>>();
      for (const [file, text] of seen) {
        for (const raw of text.split(/\r?\n\s*\r?\n/)) {
          const paragraph = raw.trim();
          if (paragraph.length < MIN_DUPLICATE_CHARS || IMPORT_LINE.test(paragraph)) continue;
          paragraphs.set(paragraph, (paragraphs.get(paragraph) ?? new Set()).add(file));
        }
      }
      return {
        files,
        totalTokens: files.reduce((sum, file) => sum + file.tokens, 0),
        overBudget: files.filter((file) => file.tokens > budget),
        missing,
        duplicates: [...paragraphs]
          .filter(([, paths]) => paths.size > 1)
          .map(([text, paths]) => ({ text, paths: [...paths] })),
        skills: options.skillsDir ? yield* readSkills(options.skillsDir) : [],
      };
    }).pipe(Effect.provide(NodeServices.layer)),
  );
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args.splice(i, 2)[1];
  };
  const skillsDir = flag("--skills");
  const budget = flag("--budget");
  Effect.gen(function* () {
    const report = yield* Effect.promise(() =>
      auditContext(args[0] ?? "CLAUDE.md", {
        ...(skillsDir ? { skillsDir } : {}),
        ...(budget ? { fileBudgetTokens: Number(budget) } : {}),
      }),
    );
    const rows = report.files.toSorted((a, b) => b.tokens - a.tokens);
    yield* Console.log(`Instruction chain: ~${report.totalTokens} tokens in ${rows.length} files`);
    for (const file of rows)
      yield* Console.log(`  ${String(file.tokens).padStart(6)}  ${file.path}`);
    for (const file of report.overBudget)
      yield* Console.log(`OVER BUDGET  ${file.tokens}  ${file.path}`);
    for (const item of report.missing) yield* Console.log(`MISSING IMPORT  ${item}`);
    for (const duplicate of report.duplicates)
      yield* Console.log(
        `DUPLICATE (${duplicate.paths.length} files): ${duplicate.text.slice(0, 80).replaceAll(/\s+/g, " ")}...`,
      );
    if (report.skills.length > 0) {
      const total = report.skills.reduce((sum, skill) => sum + skill.tokens, 0);
      yield* Console.log(
        `Skill descriptions: ~${total} tokens in ${report.skills.length} skills; top 5:`,
      );
      for (const skill of report.skills.slice(0, 5))
        yield* Console.log(`  ${String(skill.tokens).padStart(6)}  ${skill.name}`);
    }
  }).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
