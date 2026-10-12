import { SparklesIcon } from "lucide-react";

import { Button } from "../ui/button";
import { ReleaseHistoryButton } from "./ReleaseHistoryButton";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";

export interface WhatsNewDialogProps {
  readonly version: string | null;
  readonly items: ReadonlyArray<string>;
  readonly onShowMe: (item: string) => void;
  /** Omit both actions for a preview: the footer is then just Close. */
  readonly onRestartNow?: (() => void) | undefined;
  readonly onUpdateWhenSafe?: (() => void) | undefined;
  readonly onClose: () => void;
}

/** Centered mini changelog shown when an update has downloaded: what shipped, then install or later. */
export function LeonidasWhatsNewDialog(props: WhatsNewDialogProps) {
  const { version, items, onShowMe, onRestartNow, onUpdateWhenSafe, onClose } = props;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="max-w-lg" bottomStickOnMobile={false}>
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <SparklesIcon aria-hidden className="size-4 text-muted-foreground" />
              What's new{version ? ` in ${version}` : ""}
            </span>
          </DialogTitle>
          <DialogDescription>
            {onRestartNow
              ? "Choose a change to restart and open a guided chat after it installs."
              : "Choose a change to open a chat with a ready-to-send walkthrough."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="max-h-[55dvh] overflow-y-auto [scrollbar-width:thin]">
          <ul className="space-y-3 text-sm leading-relaxed">
            {items.map((item, index) => (
              <li key={`${index}-${item}`} className="relative break-words ps-4">
                <span
                  aria-hidden
                  className="absolute start-0.5 top-[0.6em] size-1 rounded-full bg-muted-foreground/40"
                />
                <p>{item}</p>
                <div className="-ms-1 mt-1">
                  <Button
                    size="xs"
                    variant="link"
                    aria-label={`Walk me through: ${item}`}
                    onClick={() => onShowMe(item)}
                  >
                    {onRestartNow ? "Restart and try" : "Walk me through it"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DialogPanel>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <ReleaseHistoryButton />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {onRestartNow ? "Later" : "Close"}
            </Button>
            {onUpdateWhenSafe ? (
              <Button
                variant="outline"
                onClick={() => {
                  onUpdateWhenSafe();
                  onClose();
                }}
              >
                Update when safe
              </Button>
            ) : null}
            {onRestartNow ? (
              <Button
                onClick={() => {
                  onClose();
                  onRestartNow();
                }}
              >
                Restart now
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
