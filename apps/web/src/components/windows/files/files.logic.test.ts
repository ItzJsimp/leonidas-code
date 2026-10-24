import { ThreadId, type StoredFile } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  deleteFailureText,
  emptyFilesText,
  fileResource,
  filesTab,
  filesTabs,
  formatFileDate,
  splitByKind,
} from "./files.logic";

const file = (id: string, kind: StoredFile["kind"]): StoredFile => ({
  id,
  name: `${id}.x`,
  kind,
  sizeBytes: 1,
  createdAt: "2026-10-23T21:14:00.000Z",
  thread: { id: ThreadId.make("t"), title: "Chat" },
});

describe("files.logic", () => {
  it("reads the tab from the search value and counts files on each tab", () => {
    expect(filesTab("images")).toBe("images");
    expect(filesTab("nonsense")).toBe("all");
    expect(filesTabs(null).map((tab) => tab.label)).toEqual(["All", "Images", "Documents"]);
    expect(filesTabs({ all: 12000, images: 9, documents: 11991 }).map((tab) => tab.label)).toEqual([
      "All 12,000",
      "Images 9",
      "Documents 11,991",
    ]);
  });

  it("splits images from other files and keeps the order", () => {
    const split = splitByKind([file("a", "image"), file("b", "pdf"), file("c", "image")]);
    expect(split.images.map((f) => f.id)).toEqual(["a", "c"]);
    expect(split.documents.map((f) => f.id)).toEqual(["b"]);
  });

  it("builds a bounded asset request and asks for a download on demand", () => {
    const resource = fileResource({ id: "t-1", name: "n".repeat(300), mimeType: undefined });
    expect(resource.fileName).toHaveLength(255);
    expect(resource).not.toHaveProperty("mimeType");
    expect(
      fileResource({ id: "t-1", name: "a.pdf", mimeType: "application/pdf" }, "attachment"),
    ).toMatchObject({
      disposition: "attachment",
      mimeType: "application/pdf",
    });
  });

  it("shows the year only for another year and says what an empty tab holds", () => {
    const now = Date.parse("2026-10-24T12:00:00Z");
    expect(formatFileDate("2026-10-23T21:14:00.000Z", now)).not.toContain("2026");
    expect(formatFileDate("2025-01-02T21:14:00.000Z", now)).toContain("2025");
    expect(formatFileDate("bad", now)).toBe("");
    expect(emptyFilesText("images", "").title).toBe("No images yet");
    expect(emptyFilesText("all", "cat").title).toBe("No files match");
  });
});

describe("deleteFailureText", () => {
  it("explains a refusal in plain words and never shows a raw error", () => {
    const withChat = file("a", "pdf");
    expect(deleteFailureText({ reason: "in_use" }, withChat)).toContain('"Chat"');
    expect(deleteFailureText({ reason: "not_found" }, withChat)).toBe("This file is already gone.");
    expect(deleteFailureText(new Error("EPERM: boom"), withChat)).toBe(
      "Leonidas could not delete the file. Try again.",
    );
  });
});
