// Mock feedback relay for development: accepts reports on POST /feedback and appends them to
// .t3/feedback-mock.jsonl. The real relay (Cloudflare Worker -> private GitHub repo) replaces it.
// Run: node scripts/mock-feedback-relay.ts [port]
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { startMockHttpServer } from "./lib/mock-http-server.ts";

const fs = await Effect.runPromise(Effect.provide(FileSystem.FileSystem, NodeFileSystem.layer));

const port = Number(process.argv[2] ?? 8787);
const outFile = ".t3/feedback-mock.jsonl";
const MAX_BYTES = 3_000_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

await startMockHttpServer(port, (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, cors).end();
    return;
  }
  if (request.method !== "POST" || request.url !== "/feedback") {
    response.writeHead(404, cors).end();
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  request.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BYTES) request.destroy();
    else chunks.push(chunk);
  });
  request.on("end", async () => {
    try {
      const report = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        installId?: string;
        text?: string;
      };
      if (!report.installId || !report.text?.trim()) throw new Error("invalid");
      // Per-install rate limit, same shape the real relay enforces.
      const now = Effect.runSync(Clock.currentTimeMillis);
      const hits = (recent.get(report.installId) ?? []).filter((at) => now - at < WINDOW_MS);
      if (hits.length >= MAX_PER_WINDOW) {
        response.writeHead(429, cors).end();
        return;
      }
      recent.set(report.installId, [...hits, now]);
      await Effect.runPromise(fs.makeDirectory(".t3", { recursive: true }));
      await Effect.runPromise(
        fs.writeFileString(outFile, `${JSON.stringify(report)}\n`, { flag: "a" }),
      );
      response.writeHead(200, { ...cors, "content-type": "application/json" }).end('{"ok":true}');
    } catch {
      response.writeHead(400, cors).end();
    }
  });
});
Effect.runSync(
  Console.log(`mock feedback relay on http://127.0.0.1:${port}/feedback -> ${outFile}`),
);
