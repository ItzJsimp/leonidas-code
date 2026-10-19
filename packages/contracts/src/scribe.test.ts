import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import {
  ScribeEngineWireEvent,
  ScribeHistoryPage,
  ScribeListHistoryInput,
  ScribeLiveEvent,
} from "./scribe.ts";

const decodeWire = Schema.decodeUnknownSync(Schema.fromJsonString(ScribeEngineWireEvent));
const decodeLive = Schema.decodeUnknownSync(ScribeLiveEvent);
const decodePage = Schema.decodeUnknownSync(ScribeHistoryPage);
const decodeListInput = Schema.decodeUnknownSync(ScribeListHistoryInput);

const historyItem = {
  id: "h-1",
  at: "2026-10-15T01:00:03.000Z",
  mode: "hold",
  app: "code.exe",
  rawText: "hello world",
  cleanedText: "Hello world.",
  words: 2,
  metrics: { transcribeMs: 700, polishMs: 300, totalMs: 1000 },
  pasted: true,
};

describe("ScribeEngineWireEvent", () => {
  it("decodes every v1 contract example", () => {
    const lines = [
      '{"type":"state","state":"listening","at":"2026-10-15T01:00:00.000Z"}',
      '{"type":"partial","text":"hello wor","at":"2026-10-15T01:00:01.000Z"}',
      '{"type":"transcript","text":"Hello world.","durationMs":1840,"pasted":true,"at":"2026-10-15T01:00:03.000Z"}',
      '{"type":"error","code":"mic_error","message":"No input device","at":"2026-10-15T01:00:00.000Z"}',
    ];
    expect(lines.map((line) => decodeWire(line).type)).toEqual([
      "state",
      "partial",
      "transcript",
      "error",
    ]);
  });

  it("keeps the v1.1 transcript fields and ignores the envelope", () => {
    const event = decodeWire(
      '{"service":"leonidas-scribe","apiVersion":1,"type":"transcript","text":"Hello world.","raw":"hello world","durationMs":1840,"pasted":true,"engine":"local","at":"2026-10-15T01:00:03.000Z"}',
    );
    expect(event).toMatchObject({ type: "transcript", raw: "hello world", engine: "local" });
  });

  it("decodes the v1.2 history event", () => {
    const event = decodeWire(JSON.stringify({ type: "history", item: historyItem }));
    expect(event).toMatchObject({ type: "history", item: { id: "h-1", words: 2 } });
  });

  it("rejects an unknown state", () => {
    expect(() => decodeWire('{"type":"state","state":"asleep","at":"x"}')).toThrow();
  });
});

describe("ScribeLiveEvent", () => {
  it("accepts server connection and process events", () => {
    expect(decodeLive({ type: "connection", connected: false, at: "x" }).type).toBe("connection");
    expect(
      decodeLive({
        type: "process",
        process: { status: "running", restarts: 1, lastRestartAt: "2026-10-15T01:00:00.000Z" },
      }).type,
    ).toBe("process");
  });
});

describe("ScribeHistoryPage and ScribeListHistoryInput", () => {
  it("decodes a page with a cursor", () => {
    const page = decodePage({ items: [historyItem], next: "h-1" });
    expect(page.items).toHaveLength(1);
  });

  it("rejects a limit over 500", () => {
    expect(() => decodeListInput({ limit: 501 })).toThrow();
  });
});
