import JSZip from "jszip";
import { describe, expect, it } from "vite-plus/test";

import { boundedZip } from "./boundedZip";

async function zipBytes(files: Record<string, string>) {
  const zip = new JSZip();
  for (const [name, text] of Object.entries(files)) zip.file(name, text);
  return (await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })) as ArrayBuffer;
}

describe("boundedZip", () => {
  it("opens an archive and lists its files with their bytes", async () => {
    const files = await boundedZip(await zipBytes({ "a.txt": "alpha", "dir/b.txt": "beta" }));
    expect([...files.keys()].toSorted()).toEqual(["a.txt", "dir/", "dir/b.txt"]);
    expect(new TextDecoder().decode(files.get("a.txt")?.bytes)).toBe("alpha");
    expect(files.get("dir/")?.directory).toBe(true);
  });

  it("refuses an archive over the preview size limit", async () => {
    await expect(boundedZip(new ArrayBuffer(51 * 1024 * 1024))).rejects.toThrow(/50 MB/);
  });

  it("refuses an archive that expands far beyond its compressed size", async () => {
    const bytes = await zipBytes({ "bomb.txt": "a".repeat(2 * 1024 * 1024) });
    await expect(boundedZip(bytes)).rejects.toThrow(/compression ratio limit/);
  });

  it("refuses an entry over the entry, total or XML limit", async () => {
    const bytes = await zipBytes({ "a.txt": "x".repeat(100), "b.xml": "<a/>".repeat(50) });
    await expect(boundedZip(bytes, 50)).rejects.toThrow(/limit/);
    await expect(boundedZip(bytes, undefined, { totalLimit: 150 })).rejects.toThrow(/limit/);
    await expect(boundedZip(bytes, undefined, { xmlLimit: 100 })).rejects.toThrow(/limit/);
  });

  it("refuses an entry with too many markup characters", async () => {
    const bytes = await zipBytes({ "doc.xml": "<a/>".repeat(50) });
    await expect(boundedZip(bytes, undefined, { markupLimit: 10 })).rejects.toThrow(/limit/);
  });

  it("refuses an archive with a path over 1,024 characters", async () => {
    const bytes = await zipBytes({ [`${"p".repeat(1025)}.txt`]: "x" });
    await expect(boundedZip(bytes)).rejects.toThrow(/path is too long/);
  });
});
