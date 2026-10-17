// @effect-diagnostics nodeBuiltinImport:off -- This desktop-only module reads the user's snips folder.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import { newestSnips } from "./SnipGeometry.ts";

export type SnipFile = {
  readonly name: string;
  readonly path: string;
  readonly modifiedMs: number;
};

/** Newest PNG files in the snips folder. A missing folder is an empty list. */
export async function listSnipFiles(directory: string): Promise<ReadonlyArray<SnipFile>> {
  const names = await NodeFSP.readdir(directory).catch(() => [] as string[]);
  const files = await Promise.all(
    names
      .filter((name) => /\.png$/i.test(name))
      .map(async (name): Promise<SnipFile | null> => {
        const path = NodePath.join(directory, name);
        const stats = await NodeFSP.stat(path).catch(() => null);
        return stats?.isFile() ? { name, path, modifiedMs: stats.mtimeMs } : null;
      }),
  );
  return newestSnips(files.filter((file): file is SnipFile => file !== null));
}

/**
 * The renderer sends a path back to re-attach a snip. Only a PNG directly inside the snips
 * folder may be read, so a bad path can never open another file.
 */
export function resolveSnipPath(directory: string, requested: string): string | null {
  if (requested.length === 0 || !/\.png$/i.test(requested)) return null;
  const resolved = NodePath.resolve(requested);
  const root = NodePath.resolve(directory);
  return NodePath.dirname(resolved) === root ? resolved : null;
}
