import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { describe, expect, it } from "vite-plus/test";

import {
  mimeForName,
  readFocusAttachment,
  safeFileName,
  storeFocusFiles,
} from "./focusAttachments.ts";

const png = Buffer.from("not really a png").toString("base64");

describe("focus attachments", () => {
  it("cleans file names and picks the mime type from the extension", () => {
    expect(safeFileName("..\..\evil name?.PNG")).toBe("evil name_.PNG");
    expect(safeFileName("")).toBe("file");
    expect(mimeForName("a.PNG")).toBe("image/png");
    expect(mimeForName("a.exe")).toBe("application/octet-stream");
  });

  it("stores files and reads them back by the path written in the note", () => {
    const memory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "focus-"));
    const [image, doc] = storeFocusFiles(memory, [
      { name: "shot.png", mimeType: "image/png", dataBase64: png },
      { name: "plan [v2].pdf", mimeType: "application/pdf", dataBase64: png },
    ]);
    expect(image).toMatch(/^!\[shot\.png\]\(focus-files\/[0-9a-f]{8}-shot\.png\)$/);
    expect(doc).toMatch(/^\[plan _v2_\.pdf\]\(focus-files\/[0-9a-f]{8}-plan _v2_\.pdf\)$/);
    const path = /\((focus-files\/[^)]+)\)/.exec(image!)![1]!;
    const back = readFocusAttachment(memory, path);
    expect(back).toMatchObject({ name: "shot.png", mimeType: "image/png", dataBase64: png });
    expect(storeFocusFiles(memory, [{ name: "shot.png", mimeType: "x", dataBase64: png }])).toEqual(
      [image],
    );
  });

  it("refuses paths outside focus-files and empty or too many files", () => {
    const memory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "focus-"));
    expect(() => readFocusAttachment(memory, "focus-files/../focus.md")).toThrow();
    expect(() => readFocusAttachment(memory, "../secret.txt")).toThrow();
    expect(() => readFocusAttachment(memory, "focus-files/.hidden")).toThrow();
    expect(() =>
      storeFocusFiles(memory, [{ name: "a.txt", mimeType: "", dataBase64: "" }]),
    ).toThrow();
    const many = Array.from({ length: 6 }, () => ({
      name: "a.txt",
      mimeType: "",
      dataBase64: png,
    }));
    expect(() => storeFocusFiles(memory, many)).toThrow();
  });
});
