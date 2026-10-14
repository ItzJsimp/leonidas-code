// Mock feedback relay for development: accepts reports on POST /feedback and appends them to
// .t3/feedback-mock.jsonl. The real relay (Cloudflare Worker -> private GitHub repo) replaces it.
// Run: node scripts/mock-feedback-relay.ts [port]
import { appendFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";

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

createServer((request, response) => {
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
  request.on("end", () => {
    try {
      const report = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        installId?: string;
        text?: string;
      };
      if (!report.installId || !report.text?.trim()) throw new Error("invalid");
      // Per-install rate limit, same shape the real relay enforces.
      const now = Date.now();
      const hits = (recent.get(report.installId) ?? []).filter((at) => now - at < WINDOW_MS);
      if (hits.length >= MAX_PER_WINDOW) {
        response.writeHead(429, cors).end();
        return;
      }
      recent.set(report.installId, [...hits, now]);
      mkdirSync(".t3", { recursive: true });
      appendFileSync(outFile, `${JSON.stringify(report)}\n`);
      response.writeHead(200, { ...cors, "content-type": "application/json" }).end('{"ok":true}');
    } catch {
      response.writeHead(400, cors).end();
    }
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`mock feedback relay on http://127.0.0.1:${port}/feedback -> ${outFile}`);
});
