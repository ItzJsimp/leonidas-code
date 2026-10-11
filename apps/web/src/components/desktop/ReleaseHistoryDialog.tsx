import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { appAtomRegistry } from "../../rpc/atomRegistry";
import { createFeatureWalkthroughPrompt } from "../desktopUpdate.logic";
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
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  fetchReleaseHistory,
  formatExactReleaseDate,
  formatFriendlyReleaseDate,
  type ReleaseHistoryEntry,
} from "./releaseHistory";

export const releaseHistoryDialogOpenAtom = Atom.make<boolean>(false).pipe(
  Atom.keepAlive,
  Atom.withLabel("release-history:dialog-open"),
);

export function openReleaseHistoryDialog(): void {
  appAtomRegistry.set(releaseHistoryDialogOpenAtom, true);
}

export function closeReleaseHistoryDialog(): void {
  appAtomRegistry.set(releaseHistoryDialogOpenAtom, false);
}

const BULLET_CAP = 6;

/** Load notes only when opened, with bounded pages and a retry for network failures. */
export function ReleaseHistoryDialog({ onClose }: { readonly onClose?: () => void }) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ReleaseHistoryEntry[]>([]);
  const [request, setRequest] = useState({ page: 1, attempt: 0 });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<ReadonlySet<string>>(new Set());

  const handleClose = () => {
    closeReleaseHistoryDialog();
    onClose?.();
  };

  const openWalkthrough = (note: string) => {
    handleClose();
    void navigate({ to: "/", search: { guidePrompt: createFeatureWalkthroughPrompt(note) } });
  };

  const toggleExpanded = (version: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchReleaseHistory(request.page, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setEntries((current) => [
          ...current,
          ...result.entries.filter(
            (entry) => !current.some((old) => old.version === entry.version),
          ),
        ]);
        setHasMore(result.hasMore);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Could not load release history.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogPopup className="max-w-xl" bottomStickOnMobile={false}>
        <DialogHeader>
          <DialogTitle>Update history</DialogTitle>
          <DialogDescription>
            What changed in each Leonidas Code version. Choose a change to open a guided chat.
            Versions below 1.0 are development releases.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div
            className="max-h-[58vh] space-y-7 overflow-y-auto pr-2 [scrollbar-gutter:stable] [scrollbar-width:thin]"
            aria-busy={loading}
          >
            {entries.map((entry) => {
              const isExpanded = expandedVersions.has(entry.version);
              const hasMoreNotes = entry.notes.length > BULLET_CAP;
              const displayedNotes = isExpanded ? entry.notes : entry.notes.slice(0, BULLET_CAP);

              return (
                <article key={entry.version} className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2.5">
                    <h3 className="flex items-baseline gap-2 text-sm font-semibold tabular-nums tracking-tight text-foreground">
                      {entry.version}
                      {entry.version.startsWith("0.") ? (
                        <span className="text-2xs font-normal tracking-normal text-muted-foreground">
                          Development
                        </span>
                      ) : null}
                    </h3>
                    {entry.publishedAt ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <time
                              className="rounded-sm text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground cursor-default"
                              tabIndex={0}
                              dateTime={entry.publishedAt}
                            />
                          }
                        >
                          {formatFriendlyReleaseDate(entry.publishedAt)}
                        </TooltipTrigger>
                        <TooltipPopup side="top" align="end" className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {formatExactReleaseDate(entry.publishedAt)}
                          </span>
                          {entry.meta?.authors && entry.meta.authors.length > 0 ? (
                            <span className="text-muted-foreground">
                              Pushed by {entry.meta.authors.join(", ")}
                            </span>
                          ) : null}
                          {entry.meta?.commit ? (
                            <span className="font-mono text-muted-foreground">
                              commit {entry.meta.commit.slice(0, 7)}
                            </span>
                          ) : null}
                        </TooltipPopup>
                      </Tooltip>
                    ) : null}
                  </div>

                  {entry.notes.length ? (
                    <div className="flex flex-col gap-1.5">
                      <ul className="space-y-2 text-sm leading-relaxed text-popover-foreground">
                        {displayedNotes.map((note) => (
                          <li key={note} className="relative break-words ps-4">
                            <span
                              aria-hidden
                              className="absolute start-0.5 top-[0.6em] size-1 rounded-full bg-muted-foreground/40"
                            />
                            <p>{note}</p>
                            <div className="-ms-1 mt-1">
                              <Button
                                size="xs"
                                variant="link"
                                aria-label={`Walk me through: ${note}`}
                                onClick={() => openWalkthrough(note)}
                              >
                                Walk me through it
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {hasMoreNotes ? (
                        <Button
                          size="xs"
                          variant="link"
                          className="self-start -ms-2 text-muted-foreground hover:text-foreground"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpanded(entry.version)}
                        >
                          {isExpanded
                            ? "Show fewer changes"
                            : `Show ${entry.notes.length - BULLET_CAP} more ${
                                entry.notes.length - BULLET_CAP === 1 ? "change" : "changes"
                              }`}
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No patch notes were published.</p>
                  )}
                </article>
              );
            })}

            {loading ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading updates…
              </p>
            ) : null}

            {error ? (
              <div className="space-y-2">
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    setRequest((current) => ({ ...current, attempt: current.attempt + 1 }));
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {!loading && !error && entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published updates yet.</p>
            ) : null}

            {!loading && !error && hasMore ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setRequest((current) => ({ ...current, page: current.page + 1 }));
                }}
              >
                Older updates
              </Button>
            ) : null}
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export function ReleaseHistoryDialogHost() {
  const isOpen = useAtomValue(releaseHistoryDialogOpenAtom);
  if (!isOpen) return null;
  return <ReleaseHistoryDialog />;
}
