import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useState } from "react";
import { create } from "zustand";

import { userErrorToastFields } from "~/lib/userErrorToast";
import { threadEnvironment } from "../state/threads";
import { useOrchestrationCommand } from "../state/use-orchestration-command";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { stackedThreadToast, toastManager } from "./ui/toast";

export const TITLE_HINT_MAX_LENGTH = 200;

interface RegenerateTitleHintState {
  readonly target: ScopedThreadRef | null;
  readonly open: (target: ScopedThreadRef) => void;
  readonly close: () => void;
}

const useRegenerateTitleHintStore = create<RegenerateTitleHintState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));

/** Ask the user what the new title should focus on, then regenerate it. */
export function openRegenerateTitleHint(target: ScopedThreadRef) {
  useRegenerateTitleHintStore.getState().open(target);
}

/** Mount once near the sidebar. It renders nothing until a hint is requested. */
export function RegenerateTitleHintDialog() {
  const target = useRegenerateTitleHintStore((state) => state.target);
  const close = useRegenerateTitleHintStore((state) => state.close);
  const [hint, setHint] = useState("");
  const updateThreadMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });

  const dismiss = () => {
    setHint("");
    close();
  };
  const submit = async () => {
    if (!target) return;
    const trimmed = hint.trim();
    dismiss();
    const result = await updateThreadMetadata({
      environmentId: target.environmentId,
      input: {
        threadId: target.threadId,
        regenerateTitle: true,
        ...(trimmed.length > 0 ? { titleHint: trimmed } : {}),
      },
    });
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: "Failed to regenerate thread title",
          ...userErrorToastFields(squashAtomCommandFailure(result)),
        }),
      );
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => (open ? undefined : dismiss())}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regenerate title with a hint</DialogTitle>
          <DialogDescription>
            Say what the title should focus on. Leave it empty to regenerate as usual.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Input
            aria-label="Title hint"
            autoFocus
            maxLength={TITLE_HINT_MAX_LENGTH}
            placeholder="For example: the release pipeline, not the UI"
            value={hint}
            onChange={(event) => setHint(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
          />
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Regenerate</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
