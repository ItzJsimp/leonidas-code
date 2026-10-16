// @effect-diagnostics nodeBuiltinImport:off - one synchronous read per spawn, same as taskBoard/aiosCards.
/**
 * Loads a named subagent spec (`.agents/subagents/<name>.md`) into the lean
 * persona a delegated child starts with (ADR-0082). The nearest spec wins,
 * walking up from the child's working directory, so a Project Subagent
 * shadows an AIOS Subagent of the same name.
 */
import * as NodeFs from "node:fs";
import * as NodePath from "node:path";

import { parse as parseYamlDocument } from "yaml";

const SUBAGENT_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_CONTEXT_FILE_BYTES = 200_000;

export interface SubagentPersonaSpec {
  readonly name: string;
  readonly model: string | null;
  readonly provider: string | null;
  readonly tools: ReadonlyArray<string>;
  readonly context: ReadonlyArray<string>;
  readonly body: string;
}

export interface LoadedSubagentPersona {
  readonly spec: SubagentPersonaSpec;
  readonly specPath: string;
  readonly systemPrompt: string;
}

export class SubagentPersonaError extends Error {
  override readonly name = "SubagentPersonaError";
}

function stringList(value: unknown, field: string): ReadonlyArray<string> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new SubagentPersonaError(`Field "${field}" must be a list of strings.`);
  }
  return value.map((item: string) => item.trim()).filter((item) => item.length > 0);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function parseSubagentSpec(source: string, expectedName: string): SubagentPersonaSpec {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (match === null) throw new SubagentPersonaError("Spec has no frontmatter.");
  const frontmatter: unknown = parseYamlDocument(match[1] ?? "");
  if (typeof frontmatter !== "object" || frontmatter === null) {
    throw new SubagentPersonaError("Spec frontmatter is not a mapping.");
  }
  const fields = frontmatter as Record<string, unknown>;
  const name = optionalString(fields.name);
  if (name !== expectedName) {
    throw new SubagentPersonaError(`Spec name "${name ?? ""}" does not match "${expectedName}".`);
  }
  const body = (match[2] ?? "").trim();
  if (body.length === 0) throw new SubagentPersonaError("Spec has no persona body.");
  return {
    name,
    model: optionalString(fields.model),
    provider: optionalString(fields.provider),
    tools: stringList(fields.tools, "tools"),
    context: stringList(fields.context, "context"),
    body,
  };
}

/** Nearest `.agents/subagents/<name>.md` at or above `cwd`, or null. */
export function findSubagentSpec(cwd: string, name: string): string | null {
  let directory = NodePath.resolve(cwd);
  for (;;) {
    const candidate = NodePath.join(directory, ".agents", "subagents", `${name}.md`);
    if (NodeFs.existsSync(candidate)) return candidate;
    const parent = NodePath.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

export function buildPersonaSystemPrompt(input: {
  readonly spec: SubagentPersonaSpec;
  readonly contextFiles: ReadonlyArray<{ readonly path: string; readonly content: string }>;
}): string {
  const sections = [input.spec.body];
  for (const file of input.contextFiles) {
    sections.push(`<context file="${file.path}">\n${file.content.trim()}\n</context>`);
  }
  return sections.join("\n\n");
}

export function loadSubagentPersona(cwd: string, name: string): LoadedSubagentPersona {
  if (!SUBAGENT_NAME.test(name)) {
    throw new SubagentPersonaError(`"${name}" is not a valid subagent name.`);
  }
  const specPath = findSubagentSpec(cwd, name);
  if (specPath === null) {
    throw new SubagentPersonaError(`No subagent "${name}" in .agents/subagents/ above ${cwd}.`);
  }
  const spec = parseSubagentSpec(NodeFs.readFileSync(specPath, "utf8"), name);
  // Context paths are relative to the folder that holds `.agents/`.
  const root = NodePath.dirname(NodePath.dirname(NodePath.dirname(specPath)));
  const contextFiles = spec.context.map((relativePath) => {
    const absolute = NodePath.resolve(root, relativePath);
    if (!absolute.startsWith(root + NodePath.sep)) {
      throw new SubagentPersonaError(`Context path "${relativePath}" leaves ${root}.`);
    }
    if (!NodeFs.existsSync(absolute)) {
      throw new SubagentPersonaError(`Context file "${relativePath}" does not exist.`);
    }
    if (NodeFs.statSync(absolute).size > MAX_CONTEXT_FILE_BYTES) {
      throw new SubagentPersonaError(`Context file "${relativePath}" is over 200 KB.`);
    }
    return { path: relativePath, content: NodeFs.readFileSync(absolute, "utf8") };
  });
  return { spec, specPath, systemPrompt: buildPersonaSystemPrompt({ spec, contextFiles }) };
}
