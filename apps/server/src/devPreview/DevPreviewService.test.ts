import { describe, expect, it } from "@effect/vitest";

import { parsePairingUrl, parseWebPort } from "./DevPreviewService.ts";

describe("parsePairingUrl", () => {
  it("reads the link from a structured log line", () => {
    expect(
      parsePairingUrl(
        'timestamp=2026 level=INFO message="Authentication required." pairingUrl="http://localhost:15733/pair#token=abc"',
      ),
    ).toBe("http://localhost:15733/pair#token=abc");
  });

  it("ignores color codes and lines without a link", () => {
    expect(parsePairingUrl("\u001b[32mpairingUrl: http://localhost:1/#token=x\u001b[0m")).toBe(
      "http://localhost:1/#token=x",
    );
    expect(parsePairingUrl("Vite ready in 300 ms")).toBeNull();
  });
});

describe("parseWebPort", () => {
  it("reads the port from the dev runner banner", () => {
    expect(
      parseWebPort("[dev-runner] mode=dev source=env serverPort=23773 webPort=15733 baseDir=x"),
    ).toBe(15733);
    expect(parseWebPort("no port here")).toBeNull();
  });
});
