import type { DesktopRecentSnip } from "@t3tools/contracts";
import { ChevronDownIcon, FolderOpenIcon, ScissorsIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { getDesktopSnipBridge, snipResultToFile } from "~/lib/desktopSnip";
import { toastManager } from "../ui/toast";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
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
  const [recent, setRecent] = useState<ReadonlyArray<DesktopRecentSnip> | null>(null);
  const bridge = getDesktopSnipBridge();

  const reportError = useCallback((title: string, error: unknown) => {
    toastManager.add({
      type: "error",
      title,
      description: error instanceof Error ? error.message : "Try again.",
    });
  }, []);

  const loadRecent = useCallback(
    (open: boolean) => {
      const current = getDesktopSnipBridge();
      if (!open || !current) return;
      current
        .listRecentSnips()
        .then(setRecent)
        .catch((error: unknown) => reportError("Could not list your recent snips", error));
    },
    [reportError],
  );

  const attachRecent = useCallback(
    async (path: string) => {
      try {
        const file = snipResultToFile(await getDesktopSnipBridge()!.readSnip(path));
        if (file) onSnip(file);
      } catch (error) {
        reportError("Could not open that snip", error);
      }
    },
    [onSnip, reportError],
  );

  const openFolder = useCallback(() => {
    getDesktopSnipBridge()
      ?.openSnipsFolder()
      .catch((error: unknown) => reportError("Could not open the snips folder", error));
  }, [reportError]);

  const snip = useCallback(async () => {
    const current = getDesktopSnipBridge();
    if (!current || busy) return;
    setBusy(true);
    try {
      await afterTwoFrames();
      const file = snipResultToFile(await current.startSnip());
      if (file) onSnip(file);
    } catch (error) {
      reportError("Could not take the snip", error);
    } finally {
      setBusy(false);
    }
  }, [busy, onSnip, reportError]);

  if (!bridge) return null;

  const label = shortcutLabel ? `Snip the screen (${shortcutLabel})` : "Snip the screen";
  return (
    <>
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
      <Menu onOpenChange={loadRecent}>
        <MenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              onPointerDown={(event) => event.preventDefault()}
              aria-label="Recent snips"
            />
          }
        >
          <ChevronDownIcon />
        </MenuTrigger>
        <MenuPopup align="end" side="top">
          {recent === null ? (
            <MenuItem disabled>Loading...</MenuItem>
          ) : recent.length === 0 ? (
            <MenuItem disabled>No snips yet. Take a snip to see it here.</MenuItem>
          ) : (
            recent.map((snip) => (
              <MenuItem key={snip.path} onClick={() => void attachRecent(snip.path)}>
                {snip.dataUrl ? (
                  <img src={snip.dataUrl} alt="" className="h-8 w-12 rounded-sm object-cover" />
                ) : null}
                <span className="truncate">{snip.name}</span>
              </MenuItem>
            ))
          )}
          <MenuSeparator />
          <MenuItem onClick={openFolder}>
            <FolderOpenIcon />
            Open snips folder
          </MenuItem>
        </MenuPopup>
      </Menu>
    </>
  );
}
