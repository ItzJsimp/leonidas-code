import { assert, describe, it } from "@effect/vitest";

import { resolveDesktopBackendPortProbeHosts } from "./DesktopApp.ts";

describe("resolveDesktopBackendPortProbeHosts", () => {
  it("probes loopback only in local-only mode so Windows shows no Firewall prompt", () => {
    assert.deepEqual(resolveDesktopBackendPortProbeHosts("local-only"), ["127.0.0.1"]);
  });

  it("also probes every interface when network access is on", () => {
    assert.deepEqual(resolveDesktopBackendPortProbeHosts("network-accessible"), [
      "127.0.0.1",
      "0.0.0.0",
      "::",
    ]);
  });
});
