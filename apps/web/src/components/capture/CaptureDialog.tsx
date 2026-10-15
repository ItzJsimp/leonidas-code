import { useState, type KeyboardEvent } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { closeCapture, useCaptureStore } from "./captureStore";
import { useCaptureDrop } from "./useCaptureDrop";

/** Mounted once at the app root so every entry point shares one capture box. */
export function CaptureDialogHost() {
  const request = useCaptureStore((state) => state.request);
  return (
    <Dialog open={request !== null} onOpenChange={(open) => (open ? undefined : closeCapture())}>
      <DialogPopup>
        {request ? (
          <CaptureForm
            {...(request.source ? { source: request.source } : {})}
            initialText={request.initialText ?? ""}
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

/** One field, one key: Enter saves the raw text to the inbox; sorting happens on the server. */
function CaptureForm(props: { readonly source?: string; readonly initialText: string }) {
  const { drop, canDrop } = useCaptureDrop();
  const [text, setText] = useState(props.initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = text.trim().length > 0 && canDrop && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const result = await drop(text, props.source);
    setBusy(false);
    if (result.ok) closeCapture();
    else setError(result.error);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void save();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Quick note</DialogTitle>
        <DialogDescription>
          Write a note, idea or task. Clear tasks go to your task list.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <Textarea
          autoFocus
          aria-label="Note"
          placeholder="What's on your mind?"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {error ? <p className="mt-2 text-destructive text-xs">{error}</p> : null}
      </DialogPanel>
      <DialogFooter>
        <span className="mr-auto text-muted-foreground text-xs">
          Press Enter to save. Press Shift+Enter to add a line.
        </span>
        <Button disabled={!canSave} onClick={() => void save()}>
          {busy ? <Spinner /> : null}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
