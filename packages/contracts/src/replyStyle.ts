import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/** The shipped reply style. It is read-only and has no file. */
export const LEONIDAS_REPLY_STYLE_SLUG = "leonidas";
/** The shipped short style. It is read-only and has no file. */
export const AUTOPILOT_REPLY_STYLE_SLUG = "autopilot";
/** Preset files live here, relative to the workspace: `<slug>.md`. */
export const REPLY_STYLE_DIRECTORY = ".agents/reply-styles";
/** Longest preset body, in characters. A longer body falls back to Leonidas. */
export const REPLY_STYLE_MAX_BODY_LENGTH = 4_000;
/** File names a preset may use. Anything else is a bad slug, never a path. */
export const REPLY_STYLE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Why a selected preset fell back to Leonidas. */
export const ReplyStyleProblem = Schema.Literals([
  "bad-slug",
  "missing",
  "unreadable",
  "empty",
  "bad-frontmatter",
  "too-long",
]);
export type ReplyStyleProblem = typeof ReplyStyleProblem.Type;

export const ReplyStylePreset = Schema.Struct({
  slug: TrimmedNonEmptyString,
  name: Schema.String,
  description: Schema.String,
  /** True for the shipped styles, Leonidas and Autopilot. */
  builtin: Schema.Boolean,
  /** Set when the file cannot be used; selecting it falls back to Leonidas. */
  problem: Schema.optional(ReplyStyleProblem),
});
export type ReplyStylePreset = typeof ReplyStylePreset.Type;

export const ReplyStylesListInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
});
export type ReplyStylesListInput = typeof ReplyStylesListInput.Type;

export const ReplyStylesListResult = Schema.Struct({
  /** Leonidas first, then the workspace presets by slug. */
  presets: Schema.Array(ReplyStylePreset),
  /** The Leonidas body, for "Duplicate" (written with `projects.writeFile`). */
  leonidasBody: Schema.String,
});
export type ReplyStylesListResult = typeof ReplyStylesListResult.Type;

export type ParsedReplyStyleFile =
  | { readonly name: string; readonly description: string; readonly body: string }
  | { readonly problem: "empty" | "bad-frontmatter" | "too-long" };

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (/^".*"$/.test(trimmed)) {
    try {
      return String(JSON.parse(trimmed));
    } catch {
      // Not valid JSON: keep the text between the quotes.
    }
  }
  return trimmed.replace(/^(["'])(.*)\1$/, "$2");
};

/**
 * Reads a preset file: `---`, `name:` (required) and `description:` lines, `---`, then the
 * Markdown body. Only these flat keys are read; other frontmatter lines are ignored.
 */
export function parseReplyStyleFile(text: string): ParsedReplyStyleFile {
  const normalized = text.replace(/^﻿/, "").replaceAll("\r\n", "\n");
  if (normalized.trim() === "") return { problem: "empty" };
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(normalized);
  if (!match) return { problem: "bad-frontmatter" };
  const fields = new Map<string, string>();
  for (const line of match[1]!.split("\n")) {
    const field = /^([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (field) fields.set(field[1]!, unquote(field[2]!));
  }
  const name = fields.get("name") ?? "";
  if (name === "") return { problem: "bad-frontmatter" };
  const body = match[2]!.trim();
  if (body === "") return { problem: "empty" };
  if (body.length > REPLY_STYLE_MAX_BODY_LENGTH) return { problem: "too-long" };
  return { name, description: fields.get("description") ?? "", body };
}

/** The file text "Duplicate" writes; `parseReplyStyleFile` reads it back unchanged. */
export function formatReplyStyleFile(input: {
  readonly name: string;
  readonly description: string;
  readonly body: string;
}): string {
  const line = (value: string) => JSON.stringify(value.replaceAll(/\s+/g, " ").trim());
  return `---\nname: ${line(input.name)}\ndescription: ${line(input.description)}\n---\n\n${input.body.trim()}\n`;
}
