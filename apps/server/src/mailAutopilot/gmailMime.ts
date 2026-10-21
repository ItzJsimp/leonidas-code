import { assertDraftInput, ProviderError, type DraftInput } from "@t3tools/mail-autopilot";

const ENCODED_WORD = /=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=/g;
// Space between two encoded words is dropped by the RFC 2047 rule.
const BETWEEN_WORDS = /(\?=)\s+(?==\?[^?\s]+\?[bBqQ]\?)/g;
const PLAIN_HEADER_TEXT = /^[ -~]*$/;
// Keeps each encoded word under the 75 character limit.
const MAX_WORD_BYTES = 45;

/** Decodes `=?UTF-8?B?...?=` and `=?UTF-8?Q?...?=` words. Other charsets are left as written. */
export const decodeWords = (text: string): string =>
  text
    .replace(BETWEEN_WORDS, "$1")
    .replace(ENCODED_WORD, (whole, charset: string, kind: string, data: string) => {
      if (!/^(utf-?8|us-ascii)$/i.test(charset)) return whole;
      if (kind.toUpperCase() === "B") return Buffer.from(data, "base64").toString("utf8");
      const bytes = data
        .replaceAll("_", " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        );
      return Buffer.from(bytes, "latin1").toString("utf8");
    });

/** Plain ASCII passes through. Anything else becomes folded UTF-8 base64 words. */
export const encodeWord = (text: string): string => {
  if (PLAIN_HEADER_TEXT.test(text)) return text;
  const words: string[] = [];
  let chunk = "";
  for (const ch of text) {
    if (chunk && Buffer.byteLength(chunk + ch) > MAX_WORD_BYTES) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, "utf8").toString("base64")}?=`).join("\r\n ");
};

const NAMED = /^(.*?)\s*<([^<>]+)>\s*$/s;

export const parseAddress = (header: string): { name: string; address: string } => {
  const text = header.trim();
  const m = NAMED.exec(text);
  if (!m) return { name: "", address: text.replaceAll(/^<|>$/g, "").toLowerCase() };
  const name = decodeWords(
    m[1]!
      .trim()
      .replace(/^"(.*)"$/s, "$1")
      .replaceAll(/\\(.)/g, "$1"),
  );
  return { name, address: m[2]!.trim().toLowerCase() };
};

/** Plain text reply as a base64url RFC 822 message. Subject and recipient are checked first. */
export const buildRawDraft = (input: DraftInput): string => {
  assertDraftInput(input);
  if (!PLAIN_HEADER_TEXT.test(input.to) || input.to.includes(" ")) {
    throw new ProviderError("invalid", "recipient must be plain ASCII");
  }
  const body = Buffer.from(input.body, "utf8")
    .toString("base64")
    .replaceAll(/(.{76})/g, "$1\r\n");
  const message = [
    `To: ${input.to}`,
    `Subject: ${encodeWord(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
};
