// @effect-diagnostics nodeBuiltinImport:off - temp folders for a pure file check.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "@effect/vitest";

import {
  LAYA_FILES,
  layaPaths,
  layaStatus,
  plainInstallError,
  sha256OfFile,
  wireLayaProject,
} from "./layaSetup.ts";

describe("layaSetup", () => {
  it("puts the pack and the model under the per-user .leonidas folder", () => {
    const paths = layaPaths("/home/u");
    expect(paths.pack).toBe(NodePath.join("/home/u", ".leonidas", "laya"));
    expect(paths.model).toBe(NodePath.join("/home/u", ".leonidas", "models", "laya"));
  });

  it("pins a 64 character SHA-256 for every download", () => {
    for (const file of LAYA_FILES) expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes a file", async () => {
    const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "laya-test-"));
    const file = NodePath.join(dir, "a.txt");
    await NodeFSP.writeFile(file, "abc");
    expect(await sha256OfFile(file)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    await NodeFSP.rm(dir, { recursive: true, force: true });
  });

  it("reports ready when the pack and model are already on disk", async () => {
    const home = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "laya-home-"));
    const paths = layaPaths(home);
    await NodeFSP.mkdir(paths.pack, { recursive: true });
    await NodeFSP.mkdir(paths.model, { recursive: true });
    await NodeFSP.writeFile(NodePath.join(paths.pack, "engine.py"), "");
    await NodeFSP.writeFile(NodePath.join(paths.model, "laya_int8.onnx"), "");
    expect((await layaStatus(home)).status).toBe("ready");
    await NodeFSP.rm(home, { recursive: true, force: true });
  });
});

describe("wireLayaProject", () => {
  it("refuses a missing folder", async () => {
    const result = await wireLayaProject({ projectPath: "/no/such/laya/folder", confirmed: false });
    expect(result.status).toBe("error");
  });

  it("asks for confirmation before writing into a SimplyGersi folder", async () => {
    const root = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "laya-wire-"));
    const folder = NodePath.join(root, "SimplyGersi AIOS");
    await NodeFSP.mkdir(folder);
    const result = await wireLayaProject({ projectPath: folder, confirmed: false });
    expect(result.status).toBe("error");
    expect(result.message).toContain("Confirm");
    expect(await NodeFSP.readdir(folder)).toEqual([]);
    await NodeFSP.rm(root, { recursive: true, force: true });
  });

  it("asks to install first when the pack is missing", async () => {
    const root = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "laya-wire-"));
    const result = await wireLayaProject({ projectPath: root, confirmed: false, home: root });
    expect(result.message).toContain("Install Laya first");
    await NodeFSP.rm(root, { recursive: true, force: true });
  });
});

describe("plainInstallError", () => {
  it("turns a full disk into plain words", () => {
    const error = Object.assign(new Error("ENOSPC: no space left on device, write"), {
      code: "ENOSPC",
    });
    expect(plainInstallError(error)).toBe("The disk is full. Free some space, then try again.");
  });

  it("never shows a raw system message", () => {
    expect(plainInstallError(new Error("EBADF: weird"))).toBe("The install failed. Try again.");
  });
});
