import { ScissorsIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { getDesktopSnipBridge, snipResultToFile } from "~/lib/desktopSnip";
import { toastManager } from "../ui/toast";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** Two frames let the pressed button and its tooltip leave the screen before the capture. */
async function afterTwoFrames(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function ComposerSnipButton({
  onSnip,
  shortcutLabel,
}: {
  /** Receives the snip as an image file for the current draft. */
  readonly onSnip: (file: File) => void;
  readonly shortcutLabel?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const bridge = getDesktopSnipBridge();

  const snip = useCallback(async () => {
    const current = getDesktopSnipBridge();
    if (!current || busy) return;
    setBusy(true);
    try {
      await afterTwoFrames();
      const file = snipResultToFile(await current.startSnip());
      if (file) onSnip(file);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not take the snip",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, onSnip]);

  if (!bridge) return null;

  const label = shortcutLabel ? `Snip the screen (${shortcutLabel})` : "Snip the screen";
  return (
    <Tooltip open={busy ? false : undefined}>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => void snip()}
            aria-label="Snip the screen"
          />
        }
      >
        <ScissorsIcon />
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
