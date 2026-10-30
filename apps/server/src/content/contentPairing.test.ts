import { describe, expect, it } from "@effect/vitest";

import { ContentError } from "./contentFiles.ts";
import { makePairing, openPairing, PAIRING_MINUTES } from "./contentPairing.ts";

const KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const NOW = Date.UTC(2026, 9, 30, 20, 0, 0);

describe("pairing code", () => {
  it("gives the other computer the same key, with the right PIN", () => {
    const code = makePairing(KEY, NOW);
    expect(code.pin).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(code.expiresAt).toBe(NOW + PAIRING_MINUTES * 60_000);
    expect(openPairing(code.blob, code.pin, NOW + 1_000)).toEqual({
      key: KEY,
      id: expect.any(String),
    });
  });

  it("accepts the PIN in any case and with or without the dash", () => {
    const code = makePairing(KEY, NOW);
    expect(openPairing(code.blob, code.pin.toLowerCase().replace("-", ""), NOW).key).toEqual(KEY);
  });

  it("never holds the key in the clear, and makes a new code each time", () => {
    const one = makePairing(KEY, NOW);
    const two = makePairing(KEY, NOW);
    expect(one.blob).not.toBe(two.blob);
    expect(one.pin).not.toBe(two.pin);
    const bytes = Buffer.from(one.blob, "base64url");
    expect(bytes.includes(Buffer.from(KEY))).toBe(false);
  });

  it("refuses a wrong PIN, a changed code and junk, all with the same plain words", () => {
    const code = makePairing(KEY, NOW);
    const wrongPin = code.pin.startsWith("0") ? "1111-1111" : "0000-0000";
    const bytes = Buffer.from(code.blob, "base64url");
    bytes[bytes.length - 1] = bytes.at(-1)! ^ 1;
    for (const [blob, pin] of [
      [code.blob, wrongPin],
      [bytes.toString("base64url"), code.pin],
      ["not a code", code.pin],
      ["", code.pin],
      [code.blob, ""],
    ] as const) {
      expect(() => openPairing(blob, pin, NOW)).toThrow(ContentError);
      expect(() => openPairing(blob, pin, NOW)).toThrow("That code does not match.");
    }
  });

  it("refuses an expired code, and a code whose expiry was edited", () => {
    const code = makePairing(KEY, NOW);
    expect(() => openPairing(code.blob, code.pin, code.expiresAt + 1)).toThrow(
      "That code expired. Make a new one.",
    );
    // Push the stored expiry a day later: the check that wraps the key must notice.
    const bytes = Buffer.from(code.blob, "base64url");
    bytes.writeBigUInt64BE(BigInt(code.expiresAt + 86_400_000), 29);
    expect(() => openPairing(bytes.toString("base64url"), code.pin, code.expiresAt + 1)).toThrow(
      "That code does not match.",
    );
  });
});
