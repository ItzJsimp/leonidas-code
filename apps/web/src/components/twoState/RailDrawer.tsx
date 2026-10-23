import { PanelLeftIcon } from "lucide-react";

import { Sheet, SheetPopup, SheetTitle, SheetDescription } from "~/components/ui/sheet";
import { Dialog } from "@base-ui/react/dialog";

import { LeftRail } from "./LeftRail";
import { RightRail } from "./RightRail";
import { Tip } from "./Tip";

/**
 * The rails for a narrow window: a header button opens one drawer with both rails. The sheet
 * traps focus, closes on Escape and returns focus to the button.
 */
export function RailDrawer() {
  return (
    <Sheet>
      <Tip text="Show your AIOS, what needs you and the activity">
        <Dialog.Trigger
          aria-label="Open the Command Center side panel"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [-webkit-app-region:no-drag]"
        >
          <PanelLeftIcon aria-hidden className="size-3.5" />
        </Dialog.Trigger>
      </Tip>
      <SheetPopup side="left" className="max-w-sm">
        <SheetTitle className="sr-only">Command Center side panel</SheetTitle>
        <SheetDescription className="sr-only">
          Your AIOS areas, what needs you and the live activity.
        </SheetDescription>
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-3 pt-12">
          <LeftRail />
          <RightRail />
        </div>
      </SheetPopup>
    </Sheet>
  );
}
