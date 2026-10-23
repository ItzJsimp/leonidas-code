import { lazy, Suspense, useEffect, useState } from "react";
import { SparklesIcon } from "lucide-react";

import { fetchReleaseEntry, type ReleaseHistoryEntry } from "./releaseHistory";
import { ReleaseNoteList } from "./ReleaseNoteList";
import { Tooltip, TooltipTrigger, TooltipPopup } from "../ui/tooltip";
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

const ReleaseArticle = lazy(() =>
  import("./ReleaseArticleView").then((module) => ({ default: module.ReleaseArticle })),
);

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
  const [entry, setEntry] = useState<ReleaseHistoryEntry | null>(null);
  const [fullNotes, setFullNotes] = useState(false);
  const [articleError, setArticleError] = useState(false);
  const [request, setRequest] = useState({ version, attempt: 0 });
  useEffect(() => {
    if (!request.version) return;
    const controller = new AbortController();
    void fetchReleaseEntry(request.version, controller.signal)
      .then((release) => {
        if (!controller.signal.aborted) setEntry(release);
      })
      .catch(() => {
        if (!controller.signal.aborted) setArticleError(true);
      });
    return () => controller.abort();
  }, [request]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="max-w-2xl" bottomStickOnMobile={false}>
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <SparklesIcon aria-hidden className="size-4 text-muted-foreground" />
              {entry ? entry.article.title : `What is new${version ? ` in ${version}` : ""}`}
            </span>
          </DialogTitle>
          <DialogDescription>
            {onRestartNow
              ? "Your update is ready. Restart to install it, or wait until the AI is done."
              : "The newest changes and fixes in Leonidas."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="max-h-[55dvh]">
          {entry?.article.image?.src && !fullNotes ? (
            <img
              src={entry.article.image.src}
              alt={entry.article.image.alt}
              decoding="async"
              referrerPolicy="no-referrer"
              className="aspect-video w-full rounded-xl bg-muted object-contain"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ) : null}
          {entry?.article.hasIntroduction && !fullNotes ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{entry.article.summary}</p>
          ) : null}
          {fullNotes && entry ? (
            <Suspense fallback={<p role="status">Loading the notes…</p>}>
              <ReleaseArticle entry={entry} />
            </Suspense>
          ) : (
            <ReleaseNoteList key={version} items={entry?.notes ?? items} />
          )}
          {entry ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    variant="outline"
                    aria-expanded={fullNotes}

                    onClick={() => setFullNotes((current) => !current)}
                  >
                    {fullNotes ? "Highlights" : "Full notes"}
                  </Button>
                }
              />
              <TooltipPopup>
                {fullNotes ? "Go back to the highlights" : "Read the full update notes"}
              </TooltipPopup>
            </Tooltip>
          ) : articleError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="status" className="text-xs text-muted-foreground">
                The full notes are not available. The highlights are shown above. Select Retry to
                load them again.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setArticleError(false);
                  setRequest((current) => ({ ...current, attempt: current.attempt + 1 }));
                }}
              >
                Retry
              </Button>
            </div>
          ) : version ? (
            <p role="status" className="text-xs text-muted-foreground">
              Loading full notes…
            </p>
          ) : null}
        </DialogPanel>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <ReleaseHistoryButton />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {onRestartNow ? "Restart later" : "Close"}
            </Button>
            {onUpdateWhenSafe ? (
              <Button
                variant="outline"
                onClick={() => {
                  onUpdateWhenSafe();
                  onClose();
                }}
              >
                Update when the AI is done
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
