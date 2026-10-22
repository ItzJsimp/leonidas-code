// @effect-diagnostics nodeBuiltinImport:off globalFetch:off - this test talks to its own 127.0.0.1 server.
import * as NodeHttp from "node:http";

import { assert, describe, it } from "@effect/vitest";
import { ProviderError } from "@t3tools/mail-autopilot";

import { nodeLoopbackListener, nodeOAuthCrypto } from "./googleOAuthNode.ts";

describe("node loopback listener", () => {
  it("binds to 127.0.0.1 only and returns the redirect it receives", async () => {
    const session = await nodeLoopbackListener.start();
    assert.match(session.redirectUri, /^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    const pending = session.next(2000);
    const res = await fetch(`${session.redirectUri}?code=C1&state=S1`);
    assert.equal(res.status, 200);
    assert.deepEqual(await pending, { code: "C1", state: "S1", error: null });
    session.close();
  });

  it("answers 404 for other paths, and only the first callback counts", async () => {
    const session = await nodeLoopbackListener.start();
    const base = session.redirectUri.replace("/callback", "");
    assert.equal((await fetch(`${base}/other?code=x`)).status, 404);
    const pending = session.next(2000);
    await fetch(`${session.redirectUri}?code=first&state=s`);
    assert.equal((await fetch(`${session.redirectUri}?code=second&state=s`)).status, 404);
    assert.equal((await pending).code, "first");
    session.close();
  });

  it("refuses a request whose Host header is not the loopback address", async () => {
    const session = await nodeLoopbackListener.start();
    const url = new URL(session.redirectUri);
    const status = await new Promise<number>((resolve, reject) => {
      const req = NodeHttp.request(
        {
          host: "127.0.0.1",
          port: url.port,
          path: "/callback?code=x&state=y",
          headers: { Host: "evil.example.test" },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      req.end();
    });
    assert.equal(status, 400);
    session.close();
  });

  it("times out with a typed error", async () => {
    const session = await nodeLoopbackListener.start();
    const err = await session.next(20).catch((e: unknown) => e);
    assert.instanceOf(err, ProviderError);
    session.close();
  });

  it("stops listening after close", async () => {
    const session = await nodeLoopbackListener.start();
    session.close();
    const outcome = await fetch(`${session.redirectUri}?code=x`).then(
      () => "answered",
      () => "refused",
    );
    assert.equal(outcome, "refused");
  });
});

describe("node crypto", () => {
  it("gives different random bytes each time and a known sha256", () => {
    assert.notDeepEqual(nodeOAuthCrypto.randomBytes(16), nodeOAuthCrypto.randomBytes(16));
    assert.equal(
      Buffer.from(nodeOAuthCrypto.sha256("abc")).toString("hex"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
