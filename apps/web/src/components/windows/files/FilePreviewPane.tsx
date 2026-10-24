import type { EnvironmentId, StoredFile } from "@t3tools/contracts";
import { formatAttachmentSize } from "@t3tools/client-runtime/state/attachments";
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MessageSquareIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAssetUrlRefresh } from "~/assets/assetUrls";
import { AttachmentFilePreview } from "~/components/files/AttachmentFilePreview";
import { Button } from "~/components/ui/button";
import { toastManager } from "~/components/ui/toast";
import { userErrorToastFields } from "~/lib/userErrorToast";

import { Tip } from "../../twoState/Tip";
import { TruncatedText } from "../shared/TruncatedText";
import { copyImage, copyText, saveFile } from "./fileActions";
import { fileResource, formatFileDate } from "./files.logic";

/**
 * The side panel for one file: its facts and four actions, then the preview. The preview is the
 * same viewer the chat uses for an attachment, so it signs its own links and renews them.
 */
export function FilePreviewPane({
  file,
  environmentId,
  onBack,
  onOpenChat,
  onDelete,
}: {
  readonly file: StoredFile;
  readonly environmentId: EnvironmentId | null;
  /** Set when the panel replaces the list (a narrow window). */
  readonly onBack: (() => void) | null;
  readonly onOpenChat: () => void;
  readonly onDelete: () => void;
}) {
  const download = useMemo(() => fileResource(file, "attachment"), [file]);
  const inline = useMemo(() => fileResource(file, "inline"), [file]);
  const prepareDownload = useAssetUrlRefresh(environmentId, download);
  const prepareInline = useAssetUrlRefresh(environmentId, inline);
  const [busy, setBusy] = useState<"save" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);
  const canCopy = file.kind === "image" || file.kind === "text";

  const run = (kind: "save" | "copy") => {
    setBusy(kind);
    void (async () => {
      try {
        if (kind === "save") {
          const url = await prepareDownload();
          if (!url) throw new Error("Reconnect to the computer and try again.");
          await saveFile(url, file.name);
        } else {
          const url = await prepareInline();
          if (!url) throw new Error("Reconnect to the computer and try again.");
          await (file.kind === "image" ? copyImage(url) : copyText(url));
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2_000);
        }
      } catch (cause) {
        toastManager.add({
          type: "error",
          title: kind === "save" ? "Could not save the file" : "Could not copy the file",
          ...userErrorToastFields(cause),
        });
      } finally {
        setBusy(null);
      }
    })();
  };

  return (
    <section
      aria-label={`Preview of ${file.name}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
    >
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="flex min-w-0 items-start gap-2">
          {onBack ? (
            <Tip text="Back to the files">
              <Button
                size="icon-xs"
                variant="ghost-muted"
                aria-label="Back to the files"
                onClick={onBack}
              >
                <ArrowLeftIcon aria-hidden />
              </Button>
            </Tip>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              <TruncatedText text={file.name} />
            </h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatAttachmentSize(file.sizeBytes)} · {formatFileDate(file.createdAt)}
            </p>
            <TruncatedText
              text={file.thread ? `From the chat "${file.thread.title}"` : "Not used in a chat yet"}
              className="text-xs text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" disabled={busy !== null} onClick={() => run("save")}>
            <DownloadIcon aria-hidden />
            {busy === "save" ? "Saving" : "Download"}
          </Button>
          {canCopy ? (
            <Button
              size="xs"
              variant="outline"
              disabled={busy !== null}
              onClick={() => run("copy")}
            >
              {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
              {copied ? "Copied" : file.kind === "image" ? "Copy image" : "Copy text"}
            </Button>
          ) : null}
          {file.thread ? (
            <Button size="xs" variant="outline" onClick={onOpenChat}>
              <MessageSquareIcon aria-hidden />
              Open the chat
            </Button>
          ) : null}
          <Button size="xs" variant="destructive-outline" onClick={onDelete}>
            <Trash2Icon aria-hidden />
            Delete
          </Button>
        </div>
      </div>
      {environmentId ? (
        <AttachmentFilePreview
          key={file.id}
          name={file.name}
          // Without a stored type the viewer reads the kind from the file name.
          mimeType={file.mimeType ?? "application/octet-stream"}
          sizeBytes={file.sizeBytes}
          asset={{ environmentId, attachmentId: file.id }}
          origin="Files"
        />
      ) : null}
    </section>
  );
}
