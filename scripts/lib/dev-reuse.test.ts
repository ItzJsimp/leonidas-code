// @effect-diagnostics nodeBuiltinImport:off - the test writes a descriptor into a temp home.
import { assert, describe, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import {
  type DevReuseProbes,
  devRuntimePath,
  findHealthyDev,
  findReusableDev,
  readDevRuntime,
} from "./dev-reuse.ts";

const descriptor = {
  version: 1,
  pid: 4242,
  port: 23773,
  origin: "http://127.0.0.1:23773",
  devUrl: "http://localhost:15733/",
  startedAt: "2026-10-20T19:10:08.775Z",
};

function makeHome(contents?: string): string {
  const home = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "dev-reuse-"));
  if (contents !== undefined) {
    NodeFS.mkdirSync(NodePath.dirname(devRuntimePath(home)), { recursive: true });
    NodeFS.writeFileSync(devRuntimePath(home), contents);
  }
  return home;
}

const probes = (alive: boolean, listening: ReadonlyArray<number>): DevReuseProbes => ({
  isProcessAlive: () => alive,
  isPortListening: async (port) => listening.includes(port),
});

describe("dev reuse", () => {
  it("reads ports from the descriptor", () => {
    const runtime = readDevRuntime(makeHome(JSON.stringify(descriptor)));
    assert.equal(runtime?.webPort, 15733);
    assert.equal(runtime?.serverPort, 23773);
  });

  it("treats missing, empty, malformed and non-dev descriptors as absent", () => {
    assert.isUndefined(readDevRuntime(makeHome()));
    assert.isUndefined(readDevRuntime(makeHome("")));
    assert.isUndefined(readDevRuntime(makeHome("{not json")));
    const { devUrl: _devUrl, ...nonDev } = descriptor;
    assert.isUndefined(readDevRuntime(makeHome(JSON.stringify(nonDev))));
  });

  it("reuses a live pid whose server and web ports both answer", async () => {
    const home = makeHome(JSON.stringify(descriptor));
    assert.equal((await findHealthyDev(home, probes(true, [23773, 15733])))?.pid, 4242);
  });

  it("reuses only for a plain dev start", async () => {
    const home = makeHome(JSON.stringify(descriptor));
    const up = probes(true, [23773, 15733]);
    assert.equal((await findReusableDev({ mode: "dev" }, home, up))?.pid, 4242);
    assert.isUndefined(await findReusableDev({ mode: "dev:server" }, home, up));
    assert.isUndefined(await findReusableDev({ mode: "dev", dryRun: true }, home, up));
    assert.isUndefined(await findReusableDev({ mode: "dev", share: true }, home, up));
    assert.isUndefined(await findReusableDev({ mode: "dev", port: 1234 }, home, up));
  });

  it("treats a dead pid as stale", async () => {
    const home = makeHome(JSON.stringify(descriptor));
    assert.isUndefined(await findHealthyDev(home, probes(false, [23773, 15733])));
  });

  it("treats a recycled pid (ports closed) or a half-up stack as stale", async () => {
    const home = makeHome(JSON.stringify(descriptor));
    assert.isUndefined(await findHealthyDev(home, probes(true, [])));
    assert.isUndefined(await findHealthyDev(home, probes(true, [23773])));
    assert.isUndefined(await findHealthyDev(home, probes(true, [15733])));
  });
});
