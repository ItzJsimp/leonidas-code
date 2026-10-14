import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

// The server runs under Node's own ESM loader in dev, which does not resolve
// extensionless relative imports. One such import crashes the whole dev server
// and shows up in the app as a failed route-module fetch.
const RELATIVE_IMPORT = /\b(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']*)["']/g;

function* sourceFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield path;
  }
}

describe("server relative imports", () => {
  it("name their file extension", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(import.meta.dirname)) {
      for (const match of readFileSync(file, "utf8").matchAll(RELATIVE_IMPORT)) {
        const specifier = match[1] ?? "";
        if (!/\.(ts|tsx|js|mjs|json)$/.test(specifier)) offenders.push(`${file}: ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
