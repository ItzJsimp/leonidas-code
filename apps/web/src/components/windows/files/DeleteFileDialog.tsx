import type { StoredFile } from "@t3tools/contracts";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

import { inUseText } from "./files.logic";

/**
 * Asks before a delete. A file that a chat shows is kept: deleting it would leave a broken
 * picture in that chat, so the dialog explains this and offers the chat instead.
 */
export function DeleteFileDialog({
  file,
  busy,
  onCancel,
  onConfirm,
  onOpenChat,
}: {
  readonly file: StoredFile | null;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onOpenChat: () => void;
}) {
  const kept = file?.thread != null;
  return (
    <AlertDialog open={file !== null} onOpenChange={(open) => (open ? undefined : onCancel())}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {kept ? "This file is in a chat" : "Delete this file?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {file === null
              ? ""
              : kept
                ? inUseText(file)
                : `"${file.name}" is removed from this computer. You cannot undo this.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" disabled={busy} />}>
            {kept ? "Close" : "Cancel"}
          </AlertDialogClose>
          {kept ? (
            <Button onClick={onOpenChat}>Open the chat</Button>
          ) : (
            <Button variant="destructive" disabled={busy} onClick={onConfirm}>
              {busy ? "Deleting" : "Delete"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
