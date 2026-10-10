import { SparklesIcon } from "lucide-react";

import { Button } from "../ui/button";
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
  /** Omit both actions for a preview: the footer is then just Close. */
  readonly onRestartNow?: (() => void) | undefined;
  readonly onUpdateWhenSafe?: (() => void) | undefined;
  readonly onClose: () => void;
}

/** Centered mini changelog shown when an update has downloaded: what shipped, then install or later. */
export function LeonidasWhatsNewDialog(props: WhatsNewDialogProps) {
  const { version, items, onRestartNow, onUpdateWhenSafe, onClose } = props;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="max-w-md" bottomStickOnMobile={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon aria-hidden className="size-5 text-cyan-400" />
            What's new{version ? ` in ${version}` : ""}
          </DialogTitle>
          <DialogDescription>Here is what shipped in this update.</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <ul className="list-disc space-y-1.5 ps-5 text-sm leading-relaxed marker:text-cyan-400">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </DialogPanel>
        <DialogFooter>
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
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
