// @effect-diagnostics nodeBuiltinImport:off globalTimers:off - thin Node wrappers: a loopback web server, a timer and hashing.
import * as NodeCrypto from "node:crypto";
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";

import { ProviderError } from "@t3tools/mail-autopilot";

import type { LoopbackRedirect, LoopbackSession, OAuthCrypto } from "./googleOAuth.ts";

export const nodeOAuthCrypto: OAuthCrypto = {
  randomBytes: (n) => new Uint8Array(NodeCrypto.randomBytes(n)),
  sha256: (data) => new Uint8Array(NodeCrypto.createHash("sha256").update(data).digest()),
};

const DONE_PAGE =
  "<!doctype html><meta charset=utf-8><title>Leonidas</title><p>You are signed in. You can close this tab.</p>";

/** A web server on 127.0.0.1 and a random port that accepts one `/callback` request, then stops. */
export const nodeLoopbackListener = {
  async start(): Promise<LoopbackSession> {
    let settle: (r: LoopbackRedirect) => void = () => {};
    const redirect = new Promise<LoopbackRedirect>((resolve) => {
      settle = resolve;
    });
    let answered = false;
    const server = NodeHttp.createServer((req, res) => {
      const host = req.headers.host ?? "";
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      // The host check stops a web page from reaching this server through a rebound name.
      if (req.method !== "GET" || url.pathname !== "/callback" || answered) {
        res.writeHead(404).end();
        return;
      }
      if (host !== `127.0.0.1:${(server.address() as NodeNet.AddressInfo).port}`) {
        res.writeHead(400).end();
        return;
      }
      answered = true;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(DONE_PAGE);
      settle({
        code: url.searchParams.get("code"),
        state: url.searchParams.get("state"),
        error: url.searchParams.get("error"),
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const port = (server.address() as NodeNet.AddressInfo).port;
    return {
      redirectUri: `http://127.0.0.1:${port}/callback`,
      next: (timeoutMs) =>
        new Promise<LoopbackRedirect>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new ProviderError("transient", "sign-in timed out")),
            timeoutMs,
          );
          void redirect.then((r) => {
            clearTimeout(timer);
            resolve(r);
          });
        }),
      close: () => {
        server.close();
        server.closeAllConnections();
      },
    };
  },
};
