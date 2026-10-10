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
  readonly onRestartNow: () => void;
  readonly onUpdateWhenSafe: () => void;
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
            Later
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onUpdateWhenSafe();
              onClose();
            }}
          >
            Update when safe
          </Button>
          <Button
            onClick={() => {
              onClose();
              onRestartNow();
            }}
          >
            Restart now
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
