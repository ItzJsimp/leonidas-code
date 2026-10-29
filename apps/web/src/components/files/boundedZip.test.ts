import JSZip from "jszip";
import { describe, expect, it } from "vite-plus/test";

import { boundedZip } from "./boundedZip";

async function zipBytes(files: Record<string, string>) {
  const zip = new JSZip();
  for (const [name, text] of Object.entries(files)) zip.file(name, text);
  return (await zip.generateAsync({ type: "arraybuffer" })) as ArrayBuffer;
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
});
