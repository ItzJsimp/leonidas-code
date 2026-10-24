import type { EnvironmentId, StoredFile } from "@t3tools/contracts";
import { formatAttachmentSize } from "@t3tools/client-runtime/state/attachments";
import { FileIcon, FileTextIcon, ImageOffIcon } from "lucide-react";
import { useState } from "react";

import { useAssetUrlState } from "~/assets/assetUrls";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

import { TruncatedText } from "../shared/TruncatedText";
import { fileResource, formatFileDate } from "./files.logic";

const FOCUS =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** One picture in the grid. The browser loads it only when it scrolls near. */
export function ImageTile({
  file,
  environmentId,
  selected,
  onSelect,
}: {
  readonly file: StoredFile;
  readonly environmentId: EnvironmentId | null;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const asset = useAssetUrlState(environmentId, fileResource(file));
  const [broken, setBroken] = useState(false);
  const failed = broken || asset._tag === "Failure";
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${file.name}, ${formatAttachmentSize(file.sizeBytes)}`}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg p-1.5 text-left transition-colors motion-reduce:transition-none",
        FOCUS,
        selected ? "bg-surface-raised" : "hover:bg-surface-raised/60",
      )}
    >
      <span className="relative block aspect-square overflow-hidden rounded-md border border-border bg-surface-raised">
        {failed ? (
          <span className="grid size-full place-items-center text-muted-foreground">
            <ImageOffIcon aria-hidden className="size-5" />
          </span>
        ) : asset._tag === "Success" ? (
          <img
            src={asset.url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        ) : (
          <Skeleton className="size-full" shape="block" />
        )}
      </span>
      <TruncatedText text={file.name} className="text-xs font-medium text-foreground" />
      <span className="block truncate text-xs text-muted-foreground tabular-nums">
        {formatFileDate(file.createdAt)}
      </span>
    </button>
  );
}

/** One document in the list: name, the chat it came from, size and date. */
export function FileRow({
  file,
  selected,
  onSelect,
}: {
  readonly file: StoredFile;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const Icon = file.kind === "pdf" || file.kind === "text" ? FileTextIcon : FileIcon;
  const chat = file.thread?.title ?? "Not used in a chat yet";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors motion-reduce:transition-none",
        FOCUS,
        selected ? "bg-surface-raised" : "hover:bg-surface-raised/60",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-raised text-muted-foreground">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <TruncatedText text={file.name} className="text-sm font-medium text-foreground" />
        <TruncatedText text={chat} className="text-xs text-muted-foreground" />
      </span>
      <span className="flex shrink-0 flex-col items-end text-xs text-muted-foreground tabular-nums">
        <span>{formatAttachmentSize(file.sizeBytes)}</span>
        <span>{formatFileDate(file.createdAt)}</span>
      </span>
    </button>
  );
}
