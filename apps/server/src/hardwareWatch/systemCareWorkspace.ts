// @effect-diagnostics nodeBuiltinImport:off - paths are resolved before file operations.
import * as NodePath from "node:path";
import { listAiosWorkspaces, resolveWorkspaceRoot } from "../taskBoard/aiosWorkspaces.ts";

/** Unknown ids never fall back to another workspace's notes or agent files. */
export function systemCarePaths(
  baseDir: string,
  hints: ReadonlyArray<string | undefined>,
  workspaceId?: string,
) {
  const workspaces = listAiosWorkspaces(hints);
  const aiosRoot = resolveWorkspaceRoot(workspaces, workspaceId);
  if (workspaceId && aiosRoot === null) return null;
  const root = workspaceId
    ? NodePath.join(baseDir, "system-care", "workspaces", encodeURIComponent(workspaceId))
    : NodePath.join(baseDir, "system-care");
  return {
    root,
    notesDir: aiosRoot ? NodePath.join(aiosRoot, "domains", "pc") : NodePath.join(root, "notes"),
  };
}
