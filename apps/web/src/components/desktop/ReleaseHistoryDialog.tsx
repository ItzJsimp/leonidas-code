import { useEffect, useState } from "react";
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
import { fetchReleaseHistory, type ReleaseHistoryEntry } from "./releaseHistory";

/** Load notes only when opened, with bounded pages and a retry for network failures. */
export function ReleaseHistoryDialog({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ReleaseHistoryEntry[]>([]);
  const [request, setRequest] = useState({ page: 1, attempt: 0 });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup bottomStickOnMobile={false}>
        <DialogHeader>
          <DialogTitle>Update history</DialogTitle>
          <DialogDescription>
            What changed in each Leonidas Code version. Versions below 1.0 are development releases.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="max-h-[55vh] space-y-6 overflow-y-auto" aria-busy={loading}>
            {entries.map((entry) => (
              <article key={entry.version} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">
                    {entry.version}
                    {entry.version.startsWith("0.") ? " · Development" : ""}
                  </h3>
                  {entry.publishedAt ? (
                    <time className="text-xs text-muted-foreground" dateTime={entry.publishedAt}>
                      {new Date(entry.publishedAt).toLocaleDateString()}
                    </time>
                  ) : null}
                </div>
                {entry.notes.length ? (
                  <ul className="list-disc space-y-1 ps-5 text-sm leading-relaxed">
                    {entry.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No patch notes were published.</p>
                )}
                {entry.url ? (
                  <Button
                    size="compact"
                    variant="link"
                    render={<a href={entry.url} target="_blank" rel="noreferrer noopener" />}
                  >
                    Full release
                  </Button>
                ) : null}
              </article>
            ))}
            {loading ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading updates…
              </p>
            ) : null}
            {error ? (
              <div className="space-y-2">
                <p role="alert" className="text-sm">
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
              <p className="text-sm">No published updates yet.</p>
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
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
