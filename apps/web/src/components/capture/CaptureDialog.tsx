import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
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
import { toastManager } from "~/components/ui/toast";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { inboxDrop, inboxUndo, taskBoardWorkspaceQuery } from "~/state/taskBoard";
import { useAtomCommand } from "~/state/use-atom-command";
import { failureText } from "../taskBoard/useTaskActions.logic";
import { closeCapture, useCaptureStore } from "./captureStore";

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

/** One field, one key: Enter saves the raw text to the inbox; sorting happens later. */
function CaptureForm(props: { readonly source?: string; readonly initialText: string }) {
  const environmentId = usePrimaryEnvironmentId();
  const workspace = useEnvironmentQuery(
    environmentId ? taskBoardWorkspaceQuery({ environmentId, input: {} }) : null,
  );
  const runDrop = useAtomCommand(inboxDrop, { reportFailure: false });
  const runUndo = useAtomCommand(inboxUndo, { reportFailure: false });
  const [text, setText] = useState(props.initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = text.trim().length > 0 && environmentId !== null && !busy;

  const save = async () => {
    if (!canSave || environmentId === null) return;
    setBusy(true);
    setError(null);
    const result = await runDrop({
      environmentId,
      input: {
        text: text.trim(),
        ...(props.source ? { source: props.source } : {}),
        actor: workspace.data?.member ?? "Leonidas Code",
      },
    });
    setBusy(false);
    if (result._tag === "Success") {
      closeCapture();
      const id = result.value.id;
      const toastId = toastManager.add({
        type: "success",
        title: "Saved to inbox",
        timeout: 4000,
        actionProps: {
          children: "Undo",
          onClick: () => {
            toastManager.close(toastId);
            void runUndo({ environmentId, input: { id } });
          },
        },
      });
    } else if (!isAtomCommandInterrupted(result)) {
      setError(failureText(squashAtomCommandFailure(result), "Could not save the drop."));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void save();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Quick capture</DialogTitle>
        <DialogDescription>
          A note, idea or task. Just write it; it is sorted later.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <Textarea
          autoFocus
          aria-label="Capture"
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
          Enter saves · Shift+Enter adds a line
        </span>
        <Button disabled={!canSave} onClick={() => void save()}>
          {busy ? <Spinner /> : null}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
