// @effect-diagnostics nodeBuiltinImport:off - reads the committed generated script from disk.
import * as NodeFSP from "node:fs/promises";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import {
  AIOS_FOLDERS_SCRIPT_URL,
  buildAiosFoldersCommand,
  renderAiosFoldersScript,
} from "./aiosFolders.logic";
import { AIOS_PRESET } from "./leonidasSetup.logic";

const committedScript = NodeURL.fileURLToPath(
  new URL("../../../../scripts/New-AiosFolders.ps1", import.meta.url),
);

describe("buildAiosFoldersCommand", () => {
  it("runs the published script with the default folder under the user's home", () => {
    expect(buildAiosFoldersCommand("~/AIOS")).toBe(
      `& ([scriptblock]::Create((irm ${AIOS_FOLDERS_SCRIPT_URL}))) -Path (Join-Path $HOME 'AIOS')`,
    );
  });

  it("passes an absolute folder as a quoted literal", () => {
    expect(buildAiosFoldersCommand("D:\\My AIOS")).toContain("-Path 'D:\\My AIOS'");
  });

  it("maps a bare ~ to the home folder and escapes quotes", () => {
    expect(buildAiosFoldersCommand("~")).toMatch(/-Path \$HOME$/);
    expect(buildAiosFoldersCommand("D:\\Jake's AIOS")).toContain("-Path 'D:\\Jake''s AIOS'");
  });
});

describe("renderAiosFoldersScript", () => {
  it("lists every starter path from the preset", () => {
    const script = renderAiosFoldersScript(AIOS_PRESET);

    for (const entry of AIOS_PRESET) expect(script).toContain(`'${entry.path}'`);
  });

  it("escapes single quotes for PowerShell", () => {
    expect(renderAiosFoldersScript([{ path: "it's/" }])).toContain("'it''s/'");
  });

  it("matches the committed scripts/New-AiosFolders.ps1 (run node scripts/generate-aios-folders.ts after a preset change)", async () => {
    // Normalize line endings so a Windows checkout with autocrlf still matches.
    const committed = (await NodeFSP.readFile(committedScript, "utf8")).replace(/\r\n/g, "\n");

    expect(committed).toBe(renderAiosFoldersScript(AIOS_PRESET));
  });
});
