// Mock Scribe engine: follows contract v1.1 plus the v1.2 history proposal.
// Lets the UI be built before the Rust engine is ready.
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

export type MockFailMode = "status" | "events" | "history" | "all";

export interface MockScribeEngineOptions {
  port?: number;
  empty?: boolean;
  fail?: MockFailMode;
  /** Run one full dictation cycle every N seconds. */
  demoSeconds?: number;
  seed?: number;
  historyCount?: number;
  pingMs?: number;
  processingMs?: number;
}

export interface MockScribeEngine {
  port: number;
  close(): Promise<void>;
}

type State = "ready" | "listening" | "processing" | "mic_error";
type Mode = "hands-free" | "hold" | "toggle";

interface HistoryItem {
  id: string;
  at: string;
  mode: Mode;
  app: string;
  rawText: string;
  cleanedText: string;
  words: number;
  metrics: { transcribeMs: number; polishMs: number; totalMs: number };
  pasted: boolean;
}

const MODES: readonly Mode[] = ["hands-free", "hold", "toggle"];
const APPS = ["code.exe", "chrome.exe", "discord.exe", "claude.exe", "notepad.exe"] as const;
const SENTENCES = [
  "Please send the report by the end of the day.",
  "The meeting moved to Thursday afternoon.",
  "I will review the draft and leave comments.",
  "The build finished without any errors.",
  "Let us plan the next steps for the release.",
  "Add a short note to the task about the open question.",
  "The new layout looks cleaner on a small screen.",
  "Remember to update the schedule before the weekend.",
  "We should test this change on a second machine.",
  "The draft needs a clearer title and a short summary.",
  "Check the numbers again before we share them.",
  "I think the plan works if we keep the scope small.",
] as const;
const DAY_MS = 86_400_000;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)] as T;
}

function makeTexts(rng: () => number): { rawText: string; cleanedText: string; words: number } {
  const count = 1 + Math.floor(rng() * 3);
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) parts.push(pick(rng, SENTENCES));
  const cleanedText = parts.join(" ");
  const rawText = cleanedText.toLowerCase().replace(/[.,!?]/g, "");
  return { rawText, cleanedText, words: cleanedText.split(/\s+/).length };
}

function makeItem(
  rng: () => number,
  id: string,
  at: Date,
  mode: Mode,
  app: string,
  pasted: boolean,
): HistoryItem {
  const texts = makeTexts(rng);
  const transcribeMs = 300 + Math.floor(rng() * 900);
  const polishMs = 150 + Math.floor(rng() * 500);
  return {
    id,
    at: at.toISOString(),
    ...texts,
    mode,
    app,
    metrics: { transcribeMs, polishMs, totalMs: transcribeMs + polishMs + 40 },
    pasted,
  };
}

export function buildHistory(seed: number, count: number, now = Date.now()): HistoryItem[] {
  const rng = mulberry32(seed);
  const gaps: number[] = [];
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    const gap = 0.2 + rng();
    gaps.push(gap);
    sum += gap;
  }
  const scale = (30 * DAY_MS) / (sum || 1);
  const items: HistoryItem[] = [];
  let offset = 0;
  for (let i = 0; i < count; i += 1) {
    offset += (gaps[i] as number) * scale;
    const id = `h${String(count - i).padStart(5, "0")}`;
    items.push(
      makeItem(rng, id, new Date(now - offset), pick(rng, MODES), pick(rng, APPS), rng() < 0.9),
    );
  }
  return items;
}

export async function startMockScribeEngine(
  options: MockScribeEngineOptions = {},
): Promise<MockScribeEngine> {
  const failStatus = options.fail === "status" || options.fail === "all";
  const failEvents = options.fail === "events" || options.fail === "all";
  const failHistory = options.fail === "history" || options.fail === "all";
  const seed = options.seed ?? 1;
  const pingMs = options.pingMs ?? 15_000;
  const processingMs = options.processingMs ?? 600;
  const history: HistoryItem[] = options.empty
    ? []
    : buildHistory(seed, options.historyCount ?? 200);
  const liveRng = mulberry32(seed ^ 0x9e3779b9);
  let nextLiveId = history.length + 1;

  let state: State = "ready";
  let groqKey = true;
  let currentMode: Mode = "hold";
  let boundPort = 0;
  const clients = new Set<NodeHttp.ServerResponse>();
  const timers = new Set<NodeJS.Timeout>();

  const base = { service: "leonidas-scribe", apiVersion: 1 } as const;

  const emit = (event: Record<string, unknown>) => {
    const line = `data: ${JSON.stringify({ ...base, ...event })}\n\n`;
    for (const res of clients) res.write(line);
  };
  const setState = (next: State) => {
    state = next;
    emit({ type: "state", state, at: new Date().toISOString() });
  };
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  const finishDictation = (paste: boolean) => {
    const item = makeItem(
      liveRng,
      `h${String(nextLiveId++).padStart(5, "0")}`,
      new Date(),
      currentMode,
      pick(liveRng, APPS),
      paste,
    );
    history.unshift(item);
    setState("ready");
    emit({
      type: "transcript",
      text: item.cleanedText,
      raw: item.rawText,
      durationMs: item.metrics.totalMs,
      pasted: paste,
      engine: "groq",
      at: item.at,
    });
    emit({ type: "history", item });
  };
  const startDictation = (mode: Mode) => {
    currentMode = mode;
    setState("listening");
  };
  const stopDictation = (paste: boolean) => {
    setState("processing");
    later(processingMs, () => finishDictation(paste));
  };

  const send = (res: NodeHttp.ServerResponse, status: number, body?: Record<string, unknown>) => {
    res.setHeader("Cache-Control", "no-store");
    if (body === undefined) {
      res.writeHead(status);
      res.end();
      return;
    }
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ...base, ...body }));
  };
  const fail = (res: NodeHttp.ServerResponse, status: number, error: string) =>
    send(res, status, { error });

  const readJson = (req: NodeHttp.IncomingMessage): Promise<Record<string, unknown> | null> =>
    new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8").trim();
        if (text === "") return resolve({});
        try {
          const value: unknown = JSON.parse(text);
          resolve(value && typeof value === "object" && !Array.isArray(value) ? value : null);
        } catch {
          resolve(null);
        }
      });
      req.on("error", () => resolve(null));
    });

  const handle = async (req: NodeHttp.IncomingMessage, res: NodeHttp.ServerResponse) => {
    if (req.headers.origin !== undefined || req.headers.host !== `127.0.0.1:${boundPort}`) {
      return fail(res, 403, "forbidden");
    }
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const allow = (...methods: string[]) => {
      if (methods.includes(method)) return true;
      fail(res, 405, "method_not_allowed");
      return false;
    };

    if (path === "/v1/status") {
      if (!allow("GET")) return;
      if (failStatus) return fail(res, 503, "status_unavailable");
      return send(res, 200, {
        state,
        sampledAt: new Date().toISOString(),
        groqKey,
        privateMode: false,
      });
    }
    if (path === "/v1/start") {
      if (!allow("POST")) return;
      const body = await readJson(req);
      if (body === null) return fail(res, 400, "bad_request");
      const mode = body.mode ?? "hold";
      if (mode !== "hold" && mode !== "toggle") return fail(res, 400, "bad_request");
      if (state !== "ready") return fail(res, 409, "invalid_state");
      startDictation(mode);
      return send(res, 200, { state });
    }
    if (path === "/v1/stop") {
      if (!allow("POST")) return;
      const body = await readJson(req);
      if (body === null) return fail(res, 400, "bad_request");
      if (state !== "listening") return fail(res, 409, "invalid_state");
      stopDictation(body.paste !== false);
      return send(res, 200, { state });
    }
    if (path === "/v1/credentials/groq") {
      if (!allow("PUT", "DELETE")) return;
      if (method === "PUT") {
        const body = await readJson(req);
        if (body === null || typeof body.key !== "string" || body.key === "") {
          return fail(res, 400, "bad_request");
        }
        groqKey = true;
      } else {
        groqKey = false;
      }
      return send(res, 204);
    }
    if (path === "/v1/events") {
      if (!allow("GET")) return;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      if (failEvents) {
        res.end();
        return;
      }
      clients.add(res);
      res.write(": connected\n\n");
      const ping = setInterval(() => res.write(": ping\n\n"), pingMs);
      res.on("close", () => {
        clearInterval(ping);
        clients.delete(res);
      });
      return;
    }
    if (path === "/v1/history") {
      if (!allow("GET")) return;
      if (failHistory) return fail(res, 500, "store_error");
      const limitRaw = url.searchParams.get("limit");
      const limit = limitRaw === null ? 50 : Number(limitRaw);
      if (!Number.isInteger(limit) || limit < 1) return fail(res, 400, "bad_request");
      const mode = url.searchParams.get("mode");
      const before = url.searchParams.get("before");
      let list = mode ? history.filter((i) => i.mode === mode) : history;
      if (before !== null) {
        const idx = list.findIndex((i) => i.id === before);
        list = idx < 0 ? [] : list.slice(idx + 1);
      }
      const size = Math.min(limit, 500);
      const items = list.slice(0, size);
      const next = list.length > size ? (items[items.length - 1]?.id ?? null) : null;
      return send(res, 200, { items, next });
    }
    const del = /^\/v1\/history\/([^/]+)$/.exec(path);
    if (del) {
      if (!allow("DELETE")) return;
      if (failHistory) return fail(res, 500, "store_error");
      const idx = history.findIndex((i) => i.id === decodeURIComponent(del[1] as string));
      if (idx < 0) return fail(res, 404, "not_found");
      history.splice(idx, 1);
      return send(res, 200, { deleted: true });
    }
    return fail(res, 404, "not_found");
  };

  const server = NodeHttp.createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) fail(res, 500, "store_error");
      else res.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 8766, "127.0.0.1", () => resolve());
  });
  boundPort = (server.address() as NodeNet.AddressInfo).port;

  if (options.demoSeconds && options.demoSeconds > 0) {
    const demo = setInterval(() => {
      if (state !== "ready") return;
      startDictation("hold");
      later(1500, () => stopDictation(true));
    }, options.demoSeconds * 1000);
    timers.add(demo);
  }

  return {
    port: boundPort,
    close: async () => {
      for (const t of timers) {
        clearTimeout(t);
        clearInterval(t);
      }
      timers.clear();
      for (const res of clients) res.destroy();
      clients.clear();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },
  };
}

function parseArgs(argv: string[]): MockScribeEngineOptions {
  const out: MockScribeEngineOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--empty") out.empty = true;
    else if (arg === "--port") out.port = Number(argv[++i]);
    else if (arg === "--seed") out.seed = Number(argv[++i]);
    else if (arg === "--demo") out.demoSeconds = Number(argv[++i]);
    else if (arg === "--fail") {
      const value = argv[++i];
      if (value !== "status" && value !== "events" && value !== "history" && value !== "all") {
        throw new Error("--fail takes status, events, history or all");
      }
      out.fail = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

if (
  process.argv[1] &&
  NodePath.resolve(process.argv[1]) === NodePath.resolve(NodeURL.fileURLToPath(import.meta.url))
) {
  const engine = await startMockScribeEngine({ port: 8766, ...parseArgs(process.argv.slice(2)) });
  console.log(`mock scribe engine on http://127.0.0.1:${engine.port}`);
}
