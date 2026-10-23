import { useRouterState } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog } from "@base-ui/react/dialog";
import { Sheet, SheetPopup, SheetTitle, SheetDescription } from "~/components/ui/sheet";

import { AppRail } from "./AppRail";
import { Tip } from "./Tip";

/**
 * The rail for a window under 728 px: a menu button pinned top-left opens it as a drawer. The
 * sheet keeps focus inside while open, closes on Escape and returns focus to the button.
 */
export function RailDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Choosing an icon opens another page: the drawer has done its job.
  useEffect(() => setOpen(false), [pathname]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Pinned where the titlebar leaves room, like the settings sidebar button. */}
      <div className="pointer-events-none fixed top-[var(--workspace-controls-top)] left-[var(--workspace-controls-left)] z-50 flex h-[var(--workspace-topbar-height)] items-center">
        <Tip text="Open the menu">
          <Dialog.Trigger
            aria-label="Open the menu"
            className="pointer-events-auto inline-flex size-[var(--workspace-titlebar-control-size)] items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-surface-raised focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none [-webkit-app-region:no-drag]"
          >
            <MenuIcon aria-hidden className="size-4" />
          </Dialog.Trigger>
        </Tip>
      </div>
      {/* oxlint-disable-next-line shadcn/no-restyle -- reduced motion must not slide the drawer */}
      <SheetPopup side="left" className="max-w-64 motion-reduce:transition-none">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Open a page or switch workspace.</SheetDescription>
        <AppRail expanded />
      </SheetPopup>
    </Sheet>
  );
}
