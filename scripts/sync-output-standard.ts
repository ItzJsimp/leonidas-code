// @effect-diagnostics nodeBuiltinImport:off - standalone installation and drift check.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeOS from "node:os";
import * as NodeCrypto from "node:crypto";
import * as NodeURL from "node:url";
import { LEONIDAS_OUTPUT_STANDARD } from "../packages/provider-core/src/server/outputStandard.ts";

const start = "<!-- leonidas-output-standard:start -->";
const end = "<!-- leonidas-output-standard:end -->";
const block = `${start}\n${LEONIDAS_OUTPUT_STANDARD}\n${end}`;
// AIOS overlays get a pointer, not the full text: the harness already injects the standard.
const pointer = `${start}\nReply shape: Leonidas Code injects its render contract and the selected reply style into every session. The default style is Leonidas. Presets live in \`.agents/reply-styles/<slug>.md\`. Source: \`packages/provider-core/src/server/outputStandard.ts\`. Do not restate them here.\n${end}`;
const normalize = (value: string) => value.replaceAll("\r\n", "\n");
const read = async (file: string) =>
  NodeFSP.readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });

/** Update only managed copies and overlay blocks, preserving personal instructions and backups. */
export async function syncOutputStandard(input: {
  projectRoot: string;
  aiosRoots?: string[];
  check?: boolean;
}) {
  const files = new Map<string, string>();
  files.set(
    NodePath.join(input.projectRoot, ".agents/rules/output-standard.md"),
    `# Output standard (generated from the harness)\n\n${block}\n`,
  );
  const skillRoot = NodePath.join(input.projectRoot, ".agents/skills/leonidas-canvas");
  const skillFiles = (await NodeFSP.readdir(skillRoot, { recursive: true })).filter((file) =>
    /\.(?:md|html)$/.test(file),
  );
  for (const root of input.aiosRoots ?? []) {
    if (NodePath.resolve(root) === NodePath.resolve(input.projectRoot)) continue;
    for (const entry of ["AGENTS.md", "CLAUDE.md"]) {
      const file = NodePath.join(root, entry);
      const instructions = await read(file);
      if (instructions && !instructions.includes(".agents/rules/leonidas-code-overlay.md")) {
        files.set(
          file,
          `${instructions.trimEnd()}\n\n<!-- Leonidas Code overlay loader -->\nBefore acting in Leonidas Code, read [.agents/rules/leonidas-code-overlay.md](.agents/rules/leonidas-code-overlay.md).\n@.agents/rules/leonidas-code-overlay.md\n`,
        );
      }
    }
    const overlay = NodePath.join(root, ".agents/rules/leonidas-code-overlay.md");
    const previous = normalize(await read(overlay));
    const a = previous.indexOf(start);
    const b = previous.indexOf(end);
    if (a < 0 !== b < 0 || (a >= 0 && b < a)) throw new Error(`Broken managed block in ${overlay}`);
    files.set(
      overlay,
      a < 0
        ? `${previous.trimEnd() || "# Leonidas Code: shared operating layer"}\n\n${pointer}\n`
        : `${previous.slice(0, a)}${pointer}${previous.slice(b + end.length)}`,
    );
    for (const file of skillFiles)
      files.set(
        NodePath.join(root, ".agents/skills/leonidas-canvas", file),
        await read(NodePath.join(skillRoot, file)),
      );
  }
  const drift: string[] = [];
  for (const [file, expected] of files) {
    const original = await read(file);
    if (normalize(original) === normalize(expected)) continue;
    drift.push(file);
    if (input.check) continue;
    if (original) {
      const backup = NodePath.join(
        NodeOS.tmpdir(),
        `leonidas-output-standard-${NodeCrypto.randomUUID()}`,
      );
      await NodeFSP.mkdir(backup);
      await NodeFSP.writeFile(NodePath.join(backup, NodePath.basename(file)), original);
    }
    await NodeFSP.mkdir(NodePath.dirname(file), { recursive: true });
    await NodeFSP.writeFile(
      file,
      original.includes("\r\n") ? normalize(expected).replaceAll("\n", "\r\n") : expected,
    );
  }
  return drift;
}

if (
  process.argv[1] &&
  import.meta.url === NodeURL.pathToFileURL(NodePath.resolve(process.argv[1])).href
) {
  const args = process.argv.slice(2);
  const roots: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--aios-root" && args[i + 1]) roots.push(NodePath.resolve(args[++i]!));
    else if (args[i] !== "--check") throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  const check = args.includes("--check");
  const drift = await syncOutputStandard({
    projectRoot: NodePath.resolve(import.meta.dirname, ".."),
    aiosRoots: roots,
    check,
  });
  console.log(
    `${check && drift.length ? "FAIL" : "PASS"} output standard: ${drift.length} ${check ? "drifted" : "updated"} copies`,
  );
  if (check && drift.length) {
    console.error(drift.join("\n"));
    process.exitCode = 1;
  }
}
