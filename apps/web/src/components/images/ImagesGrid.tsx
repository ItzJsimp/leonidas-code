import type { AssetResource, EnvironmentId, ImageItem } from "@t3tools/contracts";
import { useCallback, useMemo, useState } from "react";

import { useAssetUrls } from "~/assets/assetUrls";
import { Button } from "../ui/button";
import { ExpandedImageDialog } from "../chat/ExpandedImageDialog";
import type { ExpandedImagePreview } from "../chat/ExpandedImagePreview";
import { ImageCard } from "./ImageCard";

/** Cards shown before "Show older". Each picture is a full size file, so the first screen stays small. */
const FIRST_PAGE = 24;

/** One card per image, newest first. Updates live while the queue runs. */
export function ImagesGrid(props: {
  readonly environmentId: EnvironmentId;
  readonly workspaceRoot: string;
  readonly items: ReadonlyArray<ImageItem>;
  readonly clockSkew: number;
  readonly onKeep: (item: ImageItem, kept: boolean) => void;
  readonly onReuse: (item: ImageItem) => void;
}) {
  const [limit, setLimit] = useState(FIRST_PAGE);
  const [preview, setPreview] = useState<ExpandedImagePreview | null>(null);
  const shown = useMemo(() => props.items.slice(0, limit), [props.items, limit]);

  const finished = useMemo(
    () => shown.filter((item) => item.status === "done" && item.file !== null),
    [shown],
  );
  const resources = useMemo(
    () =>
      finished.map((item): AssetResource => ({
        _tag: "draft-workspace-file",
        cwd: props.workspaceRoot,
        path: item.file ?? "",
      })),
    [finished, props.workspaceRoot],
  );
  const urls = useAssetUrls(props.environmentId, resources);
  const urlById = useMemo(
    () => new Map(finished.map((item, index) => [item.id, urls[index] ?? null] as const)),
    [finished, urls],
  );

  const open = useCallback(
    (item: ImageItem) => {
      const images = finished.flatMap((entry) => {
        const src = urlById.get(entry.id);
        return src
          ? [{ id: entry.id, src, name: `${entry.modelLabel}, seed ${String(entry.seed)}` }]
          : [];
      });
      const index = images.findIndex((image) => image.id === item.id);
      if (index < 0) return;
      setPreview({ images: images.map(({ src, name }) => ({ src, name })), index });
    },
    [finished, urlById],
  );

  if (props.items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
        Your images appear here. Write a prompt and press Generate.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {shown.map((item) => (
          <ImageCard
            key={item.id}
            item={item}
            url={urlById.get(item.id) ?? null}
            clockSkew={props.clockSkew}
            onOpen={open}
            onKeep={props.onKeep}
            onReuse={props.onReuse}
          />
        ))}
      </div>
      {props.items.length > limit ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((value) => value + FIRST_PAGE)}>
            Show older ({props.items.length - limit})
          </Button>
        </div>
      ) : null}
      {preview ? <ExpandedImageDialog preview={preview} onClose={() => setPreview(null)} /> : null}
    </>
  );
}
