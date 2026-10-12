import { describe, expect, it } from "vite-plus/test";
import { parseScribeComment } from "./useScribeTeamFeed";

describe("parseScribeComment", () => {
  it("parses valid JSON broadcast comment with author, text and metadata", () => {
    const raw = {
      id: 6119892134,
      body: JSON.stringify({
        id: "tx_init",
        author: "Jake",
        timestamp: "2026-10-12T00:39:00Z",
        text: "Scribe team dictation feed initialized.",
        app: "Leonidas Code",
        latencyMs: 480,
      }),
      created_at: "2026-10-12T07:39:41Z",
      html_url: "https://github.com/ItzJsimp/leonidas-code/issues/2#issuecomment-6119892134",
      user: { login: "ItzJsimp" },
    };

    const parsed = parseScribeComment(raw);
    expect(parsed.id).toBe("tx_init");
    expect(parsed.commentId).toBe(6119892134);
    expect(parsed.author).toBe("Jake");
    expect(parsed.text).toBe("Scribe team dictation feed initialized.");
    expect(parsed.app).toBe("Leonidas Code");
    expect(parsed.latencyMs).toBe(480);
    expect(parsed.createdAt).toBe("2026-10-12T07:39:41Z");
  });

  it("falls back gracefully for non-JSON plain text comments", () => {
    const raw = {
      id: 9999,
      body: "Testing plain text transcript without JSON envelope",
      created_at: "2026-10-12T08:00:00Z",
      html_url: "https://github.com/ItzJsimp/leonidas-code/issues/2#issuecomment-9999",
      user: { login: "Mob" },
    };

    const parsed = parseScribeComment(raw);
    expect(parsed.id).toBe("comment-9999");
    expect(parsed.commentId).toBe(9999);
    expect(parsed.author).toBe("Mob");
    expect(parsed.text).toBe("Testing plain text transcript without JSON envelope");
    expect(parsed.createdAt).toBe("2026-10-12T08:00:00Z");
  });

  it("handles null/undefined body safely", () => {
    const raw = {
      id: 1234,
      body: null,
      created_at: "2026-10-12T08:00:00Z",
      html_url: "https://github.com/ItzJsimp/leonidas-code/issues/2#issuecomment-1234",
      user: null,
    };

    const parsed = parseScribeComment(raw);
    expect(parsed.id).toBe("comment-1234");
    expect(parsed.author).toBe("Anonymous");
    expect(parsed.text).toBe("");
  });
});
