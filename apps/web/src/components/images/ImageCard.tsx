import type { ImageItem } from "@t3tools/contracts";
import { CheckIcon, ImageOffIcon, RotateCcwIcon, StarIcon } from "lucide-react";
import { memo } from "react";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { ElapsedText } from "./ElapsedText";
import { Hint } from "./Hint";

/** The square area of a card: the picture, or the state of the image that is not ready. */
function CardFace(props: {
  readonly item: ImageItem;
  readonly url: string | null;
  readonly clockSkew: number;
  readonly onOpen: () => void;
}) {
  const { item, url } = props;
  if (item.status === "done") {
    return url ? (
      <button
        type="button"
        onClick={props.onOpen}
        title="Click to enlarge"
        aria-label={`Enlarge image, ${item.modelLabel}, seed ${String(item.seed)}`}
        className="block size-full cursor-zoom-in outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <img
          src={url}
          alt={item.prompt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      </button>
    ) : (
      <div className="flex size-full items-center justify-center text-muted-foreground">
        <Spinner />
      </div>
    );
  }
  const message =
    item.status === "waiting" ? (
      "Waiting"
    ) : item.status === "running" ? (
      <span className="inline-flex items-center gap-2">
        <Spinner />
        Running{" "}
        {item.startedAt !== null ? (
          <ElapsedText startedAt={item.startedAt} clockSkew={props.clockSkew} />
        ) : null}
      </span>
    ) : item.status === "cancelled" ? (
      "Stopped"
    ) : (
      <span className="flex flex-col items-center gap-1 text-destructive-foreground">
        <ImageOffIcon className="size-5" />
        <span className="line-clamp-5 px-3 text-xs">{item.error ?? "The image failed."}</span>
      </span>
    );
  return (
    <div
      className={cn(
        "flex size-full items-center justify-center text-center text-sm text-muted-foreground",
        item.status === "error" && "bg-destructive/6",
      )}
      role={item.status === "error" ? "alert" : undefined}
    >
      {message}
    </div>
  );
}

export const ImageCard = memo(function ImageCard(props: {
  readonly item: ImageItem;
  readonly url: string | null;
  readonly clockSkew: number;
  readonly onOpen: (item: ImageItem) => void;
  readonly onKeep: (item: ImageItem, kept: boolean) => void;
  readonly onReuse: (item: ImageItem) => void;
}) {
  const { item } = props;
  const done = item.status === "done";
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-xs/5",
        item.status === "waiting" && "border-dashed",
      )}
    >
      <div className="aspect-square bg-muted">
        <CardFace
          item={item}
          url={props.url}
          clockSkew={props.clockSkew}
          onOpen={() => props.onOpen(item)}
        />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.modelLabel}</div>
          <div className="truncate text-xs text-muted-foreground tabular-nums">
            Seed {item.seed}
            {item.seconds !== null && done ? ` · ${String(item.seconds)} s` : ""}
          </div>
        </div>
        {done ? (
          <div className="flex items-center gap-2">
            <Hint
              tip={
                item.kept
                  ? "This image is kept in images/kept. Press again to remove the kept copy. The original stays."
                  : "Copies this image and its recipe to images/kept in your project. Free."
              }
            >
              <Button
                size="compact"
                variant={item.kept ? "secondary" : "outline"}
                aria-pressed={item.kept}
                onClick={() => props.onKeep(item, !item.kept)}
              >
                {item.kept ? <CheckIcon /> : <StarIcon />}
                {item.kept ? "Kept" : "Keep"}
              </Button>
            </Hint>
            <Hint tip="Puts this prompt back in the prompt box so you can change it. Free.">
              <Button
                size="icon-sm"
                variant="ghost-muted"
                aria-label="Reuse this prompt"
                onClick={() => props.onReuse(item)}
              >
                <RotateCcwIcon />
              </Button>
            </Hint>
          </div>
        ) : null}
      </div>
    </article>
  );
});
