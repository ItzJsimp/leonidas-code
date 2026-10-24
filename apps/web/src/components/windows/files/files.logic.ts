import type { AssetResource, FilesListResult, StoredFile } from "@t3tools/contracts";

import type { WindowTab } from "../../twoState/WindowHeader";

export type FilesTab = "all" | "images" | "documents";

const TAB_LABELS: ReadonlyArray<{ readonly id: FilesTab; readonly label: string }> = [
  { id: "all", label: "All" },
  { id: "images", label: "Images" },
  { id: "documents", label: "Documents" },
];

/** The tab ids the page accepts in the `tab` search value. */
export function filesTab(value: string | undefined): FilesTab {
  return value === "images" || value === "documents" ? value : "all";
}

/** Tabs with the number of files on each one, once the first answer is in. */
export function filesTabs(counts: FilesListResult["counts"] | null): WindowTab[] {
  return TAB_LABELS.map(({ id, label }) => ({
    id,
    label: counts === null ? label : `${label} ${counts[id].toLocaleString("en-US")}`,
  }));
}

/** On the All tab, images show as a grid and every other file as a list. */
export function splitByKind(files: ReadonlyArray<StoredFile>) {
  return {
    images: files.filter((file) => file.kind === "image"),
    documents: files.filter((file) => file.kind !== "image"),
  };
}

/** The asset the server signs for a preview. A download asks for `attachment`. */
export function fileResource(
  file: Pick<StoredFile, "id" | "name" | "mimeType">,
  disposition: "inline" | "attachment" = "inline",
): Extract<AssetResource, { _tag: "attachment" }> {
  return {
    _tag: "attachment",
    attachmentId: file.id,
    fileName: file.name.slice(0, 255),
    ...(file.mimeType === undefined ? {} : { mimeType: file.mimeType.slice(0, 100) }),
    disposition,
  };
}

/** "Oct 23, 2:14 PM". The year shows only for a file from another year. */
export function formatFileDate(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The words for an empty list: no files at all, or no match for the search. */
export function emptyFilesText(tab: FilesTab, query: string) {
  if (query.trim() !== "") {
    return { title: "No files match", line: "Try another word, or clear the search." };
  }
  if (tab === "images") {
    return {
      title: "No images yet",
      line: "Pictures and screenshots you add to a chat are saved here.",
    };
  }
  if (tab === "documents") {
    return {
      title: "No documents yet",
      line: "PDFs, notes and pages you add to a chat are saved here.",
    };
  }
  return {
    title: "No files yet",
    line: "Pictures, screenshots and documents you add to a chat are saved here.",
  };
}

/** The reason text for a file that a chat still holds. */
export function inUseText(file: Pick<StoredFile, "thread">): string {
  return file.thread
    ? `The chat "${file.thread.title}" still shows this file, so Leonidas keeps it. To remove it, delete that chat.`
    : "A chat still shows this file, so Leonidas keeps it.";
}

/** Plain words for a delete that failed, from the reason the server gave. */
export function deleteFailureText(error: unknown, file: Pick<StoredFile, "thread">): string {
  const reason =
    typeof error === "object" && error !== null && "reason" in error
      ? (error as { reason: unknown }).reason
      : null;
  if (reason === "in_use") return inUseText(file);
  if (reason === "not_found") return "This file is already gone.";
  return "Leonidas could not delete the file. Try again.";
}
