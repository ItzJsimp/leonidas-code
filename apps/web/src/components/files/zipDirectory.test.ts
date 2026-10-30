import JSZip from "jszip";
import { describe, expect, it } from "vite-plus/test";

import { checkZipDirectory } from "./zipDirectory";

async function zipBytes(names: string[]) {
  const zip = new JSZip();
  for (const name of names) zip.file(name, "x");
  return (await zip.generateAsync({ type: "arraybuffer" })) as ArrayBuffer;
}

// The archive has no comment, so its end record is the last 22 bytes.
const endRecord = (bytes: ArrayBuffer) => bytes.byteLength - 22;

describe("checkZipDirectory", () => {
  it("accepts an ordinary archive", async () => {
    const bytes = await zipBytes(["a.txt", "b.txt"]);
    expect(() => checkZipDirectory(bytes)).not.toThrow();
  });

  it("rejects bytes that are not a ZIP archive", () => {
    expect(() => checkZipDirectory(new ArrayBuffer(64))).toThrow(/not a readable ZIP/);
  });

  it("rejects more entries than the limit", async () => {
    const bytes = await zipBytes(["a.txt", "b.txt", "c.txt"]);
    expect(() => checkZipDirectory(bytes, 2)).toThrow(/more than 2,048 entries/);
  });

  it("rejects an entry count that claims ZIP64 without a valid ZIP64 record", async () => {
    const bytes = await zipBytes(["a.txt"]);
    new DataView(bytes).setUint16(endRecord(bytes) + 10, 0xffff, true);
    expect(() => checkZipDirectory(bytes)).toThrow(/ZIP64/);
  });

  it("rejects a directory whose entry signature is damaged", async () => {
    const bytes = await zipBytes(["a.txt"]);
    const view = new DataView(bytes);
    const directoryStart = view.getUint32(endRecord(bytes) + 16, true);
    view.setUint32(directoryStart, 0, true);
    expect(() => checkZipDirectory(bytes)).toThrow(/damaged/);
  });

  it("rejects a directory that starts after its own end", async () => {
    const bytes = await zipBytes(["a.txt"]);
    new DataView(bytes).setUint32(endRecord(bytes) + 16, bytes.byteLength, true);
    expect(() => checkZipDirectory(bytes)).toThrow(/damaged/);
  });
});
