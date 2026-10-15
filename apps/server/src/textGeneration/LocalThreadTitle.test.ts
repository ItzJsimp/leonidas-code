import { describe, expect, it, vi } from "vite-plus/test";

import { generateLocalThreadTitle } from "./LocalThreadTitle.ts";

const respond = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body }) as Response) as unknown as typeof fetch;

describe("generateLocalThreadTitle", () => {
  it("returns a sanitized title from the local model", async () => {
    const fetcher = respond({ response: JSON.stringify({ title: '"Fix login redirect"' }) });
    const title = await generateLocalThreadTitle({ model: "qwen3:4b", prompt: "p", fetcher });
    expect(title).toBe("Fix login redirect");
    const body = JSON.parse((vi.mocked(fetcher).mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({ model: "qwen3:4b", stream: false, think: false });
    expect(body.options.num_predict).toBeLessThanOrEqual(64);
  });

  it.each([
    ["server error", respond({}, false)],
    ["empty title", respond({ response: JSON.stringify({ title: "  " }) })],
    ["too long", respond({ response: JSON.stringify({ title: "x".repeat(80) }) })],
    [
      "needs refinement",
      respond({ response: JSON.stringify({ title: "Fix this", needsRefinement: true }) }),
    ],
    ["not json", respond({ response: "nope" })],
    ["network failure", vi.fn(async () => Promise.reject(new Error("down"))) as never],
  ])("falls back to the cloud model on %s", async (_name, fetcher) => {
    expect(await generateLocalThreadTitle({ model: "m", prompt: "p", fetcher })).toBeNull();
  });
});
