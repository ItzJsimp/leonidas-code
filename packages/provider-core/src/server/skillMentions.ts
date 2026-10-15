// @effect-diagnostics nodeBuiltinImport:off
import * as NodePath from "node:path";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { expandSkills, mayMentionSkill } from "@t3tools/shared/skillExpansion";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

/** A `$name` or `/name` token. Names that reach disk are limited to this safe shape. */
const CANDIDATE_PATTERN = /(?:^|\s)[\p{Sc}/]([a-zA-Z0-9][a-zA-Z0-9_-]*)(?=\s|$)/gu;

/** Skill folders in precedence order: project before user, `.agents` before `.claude`. */
const SKILL_FOLDERS = [".agents/skills", ".claude/skills"] as const;

/**
 * Providers with no skill support of their own would see `$name` as plain text.
 * This inlines the skills a prompt names, using the same shape as Claude and Codex.
 * Only the mentioned skills are read, so most turns cost one regex test.
 * Returns the text unchanged when nothing matches a skill folder.
 */
export const expandSkillMentionsFromDisk = Effect.fn("expandSkillMentionsFromDisk")(
  function* (input: { readonly text: string; readonly cwd: string | null | undefined }) {
    if (!mayMentionSkill(input.text)) return input.text;
    const names = new Set(
      [...input.text.matchAll(CANDIDATE_PATTERN)].flatMap((match) => (match[1] ? [match[1]] : [])),
    );
    if (names.size === 0) return input.text;

    const fileSystem = yield* FileSystem.FileSystem;
    const home = yield* HostProcess.HomeDirectory;
    const bases = [input.cwd, home].filter(
      (base): base is string => typeof base === "string" && base.length > 0,
    );

    const bodies = new Map<string, string>();
    for (const name of names) {
      for (const base of bases) {
        for (const folder of SKILL_FOLDERS) {
          const file = NodePath.join(base, folder, name, "SKILL.md");
          const body = yield* fileSystem
            .readFileString(file)
            .pipe(Effect.orElseSucceed(() => undefined));
          if (body !== undefined) {
            bodies.set(name, body);
            break;
          }
        }
        if (bodies.has(name)) break;
      }
    }
    if (bodies.size === 0) return input.text;
    return expandSkills(input.text, bodies) ?? input.text;
  },
);
