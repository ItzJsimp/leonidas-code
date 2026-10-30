// @effect-diagnostics nodeBuiltinImport:off - the pairing code uses the platform's own crypto.
import * as NodeCrypto from "node:crypto";

import { ContentError } from "./contentFiles.ts";

/**
 * Pairing two computers so an approval signed on one verifies on the other. The code is the
 * approval key sealed with AES-256-GCM under a key made from a short PIN (scrypt). The code and
 * the PIN travel by different routes; the key is never in the clear and never goes to Git.
 * Layout: version(1) salt(16) nonce(12) expiresAt(8, ms) sealed key(32) tag(16).
 */
export const PAIRING_MINUTES = 10;

const VERSION = 1;
const SALT = 16;
const NONCE = 12;
const EXPIRY_AT = 1 + SALT + NONCE;
const SEALED_AT = EXPIRY_AT + 8;
const KEY_BYTES = 32;
const TAG = 16;
const LENGTH = SEALED_AT + KEY_BYTES + TAG;
/** Crockford base32 without I, L, O and U: easy to read aloud and type. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MISMATCH = "That code does not match.";

const sealKey = (pin: string, salt: Uint8Array) => NodeCrypto.scryptSync(pin, salt, 32);
const normalPin = (pin: string) => pin.replaceAll(/[\s-]/g, "").toUpperCase();

export interface Pairing {
  /** Long, copied to the other computer. */
  readonly blob: string;
  /** Short, told to the other person. */
  readonly pin: string;
  readonly expiresAt: number;
}

export function makePairing(key: Uint8Array, now: number): Pairing {
  const raw = Array.from(NodeCrypto.randomBytes(8), (byte) => ALPHABET[byte % 32]!).join("");
  const pin = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  const salt = NodeCrypto.randomBytes(SALT);
  const nonce = NodeCrypto.randomBytes(NONCE);
  const head = Buffer.alloc(8);
  const expiresAt = now + PAIRING_MINUTES * 60_000;
  head.writeBigUInt64BE(BigInt(expiresAt));
  const cipher = NodeCrypto.createCipheriv("aes-256-gcm", sealKey(normalPin(pin), salt), nonce);
  // The expiry is authenticated: editing it makes the key impossible to open.
  cipher.setAAD(head);
  const sealed = Buffer.concat([cipher.update(key), cipher.final()]);
  const blob = Buffer.concat([
    Buffer.from([VERSION]),
    salt,
    nonce,
    head,
    sealed,
    cipher.getAuthTag(),
  ]);
  return { blob: blob.toString("base64url"), pin, expiresAt };
}

/** The key and the code's id (to refuse a second use). Every failure but expiry reads the same. */
export function openPairing(
  blob: string,
  pin: string,
  now: number,
): { readonly key: Uint8Array; readonly id: string; readonly expiresAt: number } {
  const bytes = Buffer.from(blob.trim(), "base64url");
  if (bytes.length !== LENGTH || bytes[0] !== VERSION || normalPin(pin).length !== 8) {
    throw new ContentError(MISMATCH);
  }
  const head = bytes.subarray(EXPIRY_AT, SEALED_AT);
  if (now > Number(head.readBigUInt64BE())) {
    throw new ContentError("That code expired. Make a new one.");
  }
  const nonce = bytes.subarray(1 + SALT, EXPIRY_AT);
  try {
    const decipher = NodeCrypto.createDecipheriv(
      "aes-256-gcm",
      sealKey(normalPin(pin), bytes.subarray(1, 1 + SALT)),
      nonce,
    );
    decipher.setAAD(head);
    decipher.setAuthTag(bytes.subarray(LENGTH - TAG));
    const key = Buffer.concat([
      decipher.update(bytes.subarray(SEALED_AT, SEALED_AT + KEY_BYTES)),
      decipher.final(),
    ]);
    return {
      key: new Uint8Array(key),
      id: nonce.toString("hex"),
      expiresAt: Number(head.readBigUInt64BE()),
    };
  } catch {
    throw new ContentError(MISMATCH);
  }
}
