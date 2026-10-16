// @effect-diagnostics nodeBuiltinImport:off - small synchronous spec writes from the Studio, same as subagentPersona.
/**
 * Studio edits to a subagent spec file (ADR-0082). A patch changes only the
 * fields it names and leaves comments, `extends`, `never`, `scope` and the
 * persona body as they were. Every write is checked against format v1 first,
 * and a spec that no longer resolves is put back.
 */
import * as NodeFs from "node:fs";
import * as NodePath from "node:path";

import type { SubagentSpecPatch } from "@t3tools/contracts";
import { isMap, parseDocument, type Document, type YAMLSeq } from "yaml";

import { parseSubagentSpec, resolveSubagentSpec, SubagentPersonaError } from "./subagentPersona.ts";

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FRONTMATTER = /^(﻿?---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/;

function setScalar(doc: Document, key: string, value: string | boolean | null): void {
  if (value === null || value === "") {
    doc.delete(key);
    return;
  }
  doc.set(key, value);
}

function setList(doc: Document, key: string, items: ReadonlyArray<string>, flow: boolean): void {
  const node = doc.createNode([...items]) as YAMLSeq;
  node.flow = flow;
  doc.set(key, node);
}

/** Returns the spec text with `patch` applied to its frontmatter. Throws when there is none. */
export function applySpecPatch(source: string, patch: SubagentSpecPatch): string {
  const match = FRONTMATTER.exec(source);
  if (match === null) throw new SubagentPersonaError("Spec has no frontmatter.");
  const doc = parseDocument(match[2] ?? "");
  if (!isMap(doc.contents)) throw new SubagentPersonaError("Spec frontmatter is not a mapping.");
  if (patch.enabled !== undefined) setScalar(doc, "enabled", patch.enabled);
  if (patch.description !== undefined) {
    setScalar(doc, "description", patch.description?.trim() ?? null);
  }
  if (patch.model !== undefined) setScalar(doc, "model", patch.model?.trim() ?? null);
  // Tools read best on one line; the Context List is a column of paths.
  if (patch.tools !== undefined) setList(doc, "tools", patch.tools, true);
  if (patch.context !== undefined)
    setList(doc, "context", patch.context, patch.context.length === 0);
  const frontmatter = doc.toString({ lineWidth: 0 }).trimEnd();
  return `${match[1]}${frontmatter}${match[3]}${match[4]}`;
}

/** Writes through a temp file so a crash never leaves half a spec. */
function writeFileAtomic(path: string, contents: string): void {
  const temp = `${path}.${process.pid}.tmp`;
  NodeFs.writeFileSync(temp, contents, "utf8");
  NodeFs.renameSync(temp, path);
}

/** Applies a patch to a spec on disk. The old text returns if the new one does not resolve. */
export function updateSubagentSpec(specPath: string, patch: SubagentSpecPatch): void {
  const before = NodeFs.readFileSync(specPath, "utf8");
  const after = applySpecPatch(before, patch);
  parseSubagentSpec(after, NodePath.basename(specPath, ".md"));
  writeFileAtomic(specPath, after);
  try {
    resolveSubagentSpec(specPath);
  } catch (error) {
    writeFileAtomic(specPath, before);
    throw error;
  }
}

/**
 * Creates `<folder>/<name>.md` from starter text. The starter's `name:` line
 * becomes `name`; the file is never overwritten.
 */
export function createSubagentSpec(input: {
  readonly folder: string;
  readonly name: string;
  readonly contents: string;
}): string {
  if (!NAME.test(input.name)) {
    throw new SubagentPersonaError(
      "A subagent name uses lowercase letters, digits and dashes, and starts with a letter or digit.",
    );
  }
  const match = FRONTMATTER.exec(input.contents);
  if (match === null) throw new SubagentPersonaError("The starter has no frontmatter.");
  const doc = parseDocument(match[2] ?? "");
  doc.set("name", input.name);
  const contents = `${match[1]}${doc.toString({ lineWidth: 0 }).trimEnd()}${match[3]}${match[4]}`;
  parseSubagentSpec(contents, input.name);
  const target = NodePath.join(input.folder, `${input.name}.md`);
  NodeFs.mkdirSync(input.folder, { recursive: true });
  if (NodeFs.existsSync(target)) {
    throw new SubagentPersonaError(`A subagent named "${input.name}" already exists there.`);
  }
  NodeFs.writeFileSync(target, contents, { encoding: "utf8", flag: "wx" });
  return target;
}
