import type { FilesListInput, StoredFileKind } from "@t3tools/contracts";

import {
  parseThreadSegmentFromAttachmentId,
  PENDING_ATTACHMENT_THREAD_SEGMENT,
} from "../attachmentStore.ts";

export interface DiskFile {
  /** The attachment id: the file name without its extension. */
  readonly id: string;
  readonly extension: string;
  readonly kind: StoredFileKind;
  readonly sizeBytes: number;
  readonly createdMs: number;
  /** The chat part of the id; `pending` for an upload no chat has used. */
  readonly segment: string;
}

const IMAGE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tiff",
  "webp",
]);
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonl",
  "csv",
  "tsv",
  "log",
  "yml",
  "yaml",
  "toml",
  "xml",
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "ts",
  "tsx",
  "jsx",
  "py",
  "sql",
  "sh",
  "ps1",
]);

export function kindOfExtension(extension: string): StoredFileKind {
  const ext = extension.toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return TEXT_EXTENSIONS.has(ext) ? "text" : "other";
}

/** Splits a stored file name into the attachment id and extension. Partial uploads give null. */
export function parseStoredName(
  entry: string,
): { id: string; extension: string; segment: string } | null {
  const dot = entry.lastIndexOf(".");
  if (dot <= 0 || dot === entry.length - 1) return null;
  const id = entry.slice(0, dot);
  const extension = entry.slice(dot + 1).toLowerCase();
  if (extension === "part" || id.includes(".")) return null;
  const segment = parseThreadSegmentFromAttachmentId(id);
  return segment === null ? null : { id, extension, segment };
}

export function matchesTab(kind: StoredFileKind, tab: FilesListInput["tab"]): boolean {
  return tab === "all" || (tab === "images" ? kind === "image" : kind !== "image");
}

export const isPendingSegment = (segment: string) => segment === PENDING_ATTACHMENT_THREAD_SEGMENT;

/** Newest first. The id breaks ties so a cursor always lands on one place. */
export function sortNewestFirst(files: ReadonlyArray<DiskFile>): DiskFile[] {
  return files.toSorted((a, b) => b.createdMs - a.createdMs || (a.id < b.id ? -1 : 1));
}

export const encodeFileCursor = (file: Pick<DiskFile, "createdMs" | "id">) =>
  `${file.createdMs}:${file.id}`;

/** The index of the first file after the cursor in a newest-first list. */
export function indexAfterCursor(
  files: ReadonlyArray<DiskFile>,
  cursor: string | undefined,
): number {
  if (cursor === undefined) return 0;
  const cut = cursor.indexOf(":");
  const ms = Number(cursor.slice(0, cut));
  const id = cursor.slice(cut + 1);
  if (cut <= 0 || !Number.isFinite(ms)) return 0;
  const index = files.findIndex(
    (file) => file.createdMs < ms || (file.createdMs === ms && file.id > id),
  );
  return index === -1 ? files.length : index;
}

/** A readable name for a file that no message names (a rendered page, a screenshot). */
export function fallbackName(file: Pick<DiskFile, "kind" | "extension">): string {
  if (file.extension === "html" || file.extension === "htm") return "Rendered page.html";
  return file.kind === "image" ? `Image.${file.extension}` : `File.${file.extension}`;
}
