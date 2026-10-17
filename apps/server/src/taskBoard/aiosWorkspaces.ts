// @effect-diagnostics nodeBuiltinImport:off - synchronous node and global APIs are used on purpose in this file.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { findAiosRoot } from "./aiosCards.ts";

/**
 * A Workspace is one AIOS root with a `workspace.json` (ADR-0080). Every Command view resolves
 * its root here, by workspace id, so one workspace never reads another's folder.
 */
export const WORKSPACE_FILE = "workspace.json";
const SCHEMA_VERSION = 1;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type AiosWorkspaceType = "personal" | "business";

export interface AiosWorkspaceFile {
  readonly id: string;
  readonly name: string;
  readonly type: AiosWorkspaceType;
  readonly schemaVersion: number;
}

export type AiosWorkspaceState =
  | { readonly status: "ready"; readonly root: string; readonly file: AiosWorkspaceFile }
  | { readonly status: "missing"; readonly root: string }
  | { readonly status: "invalid"; readonly root: string; readonly error: string };

function parseWorkspaceFile(value: unknown): AiosWorkspaceFile | string {
  if (typeof value !== "object" || value === null) return "The file is not a JSON object.";
  const { id, name, type, schemaVersion } = value as Record<string, unknown>;
  if (schemaVersion !== SCHEMA_VERSION) return `schemaVersion must be ${SCHEMA_VERSION}.`;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    return "id must be lowercase letters, digits and hyphens.";
  }
  if (typeof name !== "string" || !name.trim()) return "name must not be empty.";
  if (type !== "personal" && type !== "business") return 'type must be "personal" or "business".';
  return { id, name: name.trim(), type, schemaVersion };
}

export function readWorkspaceFile(root: string): AiosWorkspaceState {
  let text: string;
  try {
    text = NodeFS.readFileSync(NodePath.join(root, WORKSPACE_FILE), "utf8");
  } catch {
    return { status: "missing", root };
  }
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { status: "invalid", root, error: "The file is not valid JSON." };
  }
  const parsed = parseWorkspaceFile(json);
  return typeof parsed === "string"
    ? { status: "invalid", root, error: parsed }
    : { status: "ready", root, file: parsed };
}

/** Writes a valid `workspace.json` (the setup prompt). Throws on bad input. */
export function writeWorkspaceFile(
  root: string,
  input: { readonly id: string; readonly name: string; readonly type: AiosWorkspaceType },
): AiosWorkspaceState {
  const parsed = parseWorkspaceFile({ ...input, schemaVersion: SCHEMA_VERSION });
  if (typeof parsed === "string") throw new Error(parsed);
  const target = NodePath.join(root, WORKSPACE_FILE);
  let existing: NodeFS.Stats | undefined;
  try {
    existing = NodeFS.lstatSync(target);
  } catch {
    // No file yet: the normal setup case.
  }
  if (existing && !existing.isFile()) throw new Error("workspace.json is not a regular file.");
  NodeFS.writeFileSync(target, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return readWorkspaceFile(root);
}

// Each request resolves its scope, so real paths are kept briefly instead of resolved per compare.
const KEY_TTL_MS = 2_000;
const keyCache = new Map<string, { readonly key: string; readonly at: number }>();

const keyFor = (path: string) => {
  const now = performance.now();
  const cached = keyCache.get(path);
  if (cached && now - cached.at < KEY_TTL_MS) return cached.key;
  let real = path;
  try {
    real = NodeFS.realpathSync.native(path);
  } catch {
    // Keep the given path when it cannot be resolved.
  }
  const key = NodePath.sep === "\\" ? real.toLowerCase() : real;
  if (keyCache.size > 512) keyCache.clear();
  keyCache.set(path, { key, at: now });
  return key;
};

/** Finds each AIOS root once, in hint order (confirmed folder, env, then project folders). */
export function listAiosWorkspaces(
  hints: ReadonlyArray<string | undefined>,
): ReadonlyArray<AiosWorkspaceState> {
  const seen = new Set<string>();
  const workspaces: AiosWorkspaceState[] = [];
  for (const hint of hints) {
    const root = findAiosRoot([hint]);
    if (root === null) continue;
    const key = keyFor(root);
    if (seen.has(key)) continue;
    seen.add(key);
    workspaces.push(readWorkspaceFile(root));
  }
  return workspaces;
}

/**
 * The root for a workspace id. An id that matches no ready workspace resolves to null, never to
 * another workspace. With no id, the first listed root wins (the confirmed folder, then the env
 * folder), ready or not, so a broken workspace file never moves default writes into another
 * workspace.
 */
export function resolveWorkspaceRoot(
  workspaces: ReadonlyArray<AiosWorkspaceState>,
  workspaceId: string | null | undefined,
): string | null {
  if (workspaceId) {
    const match = workspaces.find(
      (workspace) => workspace.status === "ready" && workspace.file.id === workspaceId,
    );
    return match?.root ?? null;
  }
  return workspaces[0]?.root ?? null;
}

/** True when `path` (a project folder) is `root` or inside it, after links resolve. */
export function isPathInRoot(root: string, path: string): boolean {
  const relative = NodePath.relative(keyFor(root), keyFor(path));
  return relative === "" || (!relative.startsWith("..") && !NodePath.isAbsolute(relative));
}

/** The workspace whose root holds `path` (a project folder), or undefined. */
export function workspaceForPath(
  workspaces: ReadonlyArray<AiosWorkspaceState>,
  path: string,
): AiosWorkspaceState | undefined {
  return workspaces.find((workspace) => isPathInRoot(workspace.root, path));
}

/** The default workspace root from the confirmed folder and env hints (non-Command readers). */
export function defaultWorkspaceRoot(hints: ReadonlyArray<string | undefined>): string | null {
  return resolveWorkspaceRoot(listAiosWorkspaces(hints), undefined);
}
