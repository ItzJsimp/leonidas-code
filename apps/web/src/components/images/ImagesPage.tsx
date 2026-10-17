import { FlaskConicalIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "../ui/popover";
import { SidebarInset } from "../ui/sidebar";
import { Switch } from "../ui/switch";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { ASPECTS, SIZES, dimensionsFor } from "./catalog.logic";
import { CreateView } from "./CreateView";
import { GalleryView } from "./GalleryView";
import { ImagesQueueBar } from "./ImagesQueueBar";
import { describeQueue } from "./images.logic";
import type { GalleryItem } from "./images.mock";
import { ModelsView } from "./ModelsView";
import { AddressField, SetupCard } from "./SetupCard";
import { useCreateMemory, type CreateMemory, type ImagesView } from "./useCreateMemory";
import { useImagesCatalog, type ImagesCatalogApi, type PreviewSettings } from "./useImagesCatalog";

/** Finds the aspect and size presets that give these pixels. Null when no preset matches. */
function presetsFor(width: number, height: number): Pick<CreateMemory, "aspect" | "size"> | null {
  for (const aspect of ASPECTS) {
    for (const size of SIZES) {
      const dims = dimensionsFor(aspect.id, size.id);
      if (dims.width === width && dims.height === height)
        return { aspect: aspect.id, size: size.id };
    }
  }
  return null;
}

/** Dev-only switches for the sample data: card size, ComfyUI state, catalog size, empty gallery. */
function PreviewMenu(props: {
  readonly preview: PreviewSettings;
  readonly onChange: (patch: Partial<PreviewSettings>) => void;
}) {
  const { preview, onChange } = props;
  const row = (label: string, checked: boolean, key: "online" | "bigCatalog" | "emptyGallery") => (
    <label className="flex min-h-9 items-center justify-between gap-4 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={(value) => onChange({ [key]: value })} />
    </label>
  );
  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" variant="ghost" />}>
        <FlaskConicalIcon />
        Test data
      </PopoverTrigger>
      <PopoverPopup className="w-72">
        <PopoverTitle className="mb-2">Test data (dev only)</PopoverTitle>
        <div className="flex flex-col gap-1">
          <span className="text-sm">Graphics card</span>
          <ToggleGroup
            aria-label="Graphics card"
            className="w-full *:flex-1"
            value={[preview.gpu]}
            onValueChange={(next) => {
              const gpu = next[0];
              if (gpu === "6" || gpu === "12" || gpu === "24") onChange({ gpu });
            }}
          >
            <Toggle value="6">6 GB</Toggle>
            <Toggle value="12">12 GB</Toggle>
            <Toggle value="24">24 GB</Toggle>
          </ToggleGroup>
          {row("ComfyUI connected", preview.online, "online")}
          {row("20 models", preview.bigCatalog, "bigCatalog")}
          {row("Empty gallery", preview.emptyGallery, "emptyGallery")}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function ConnectionBadge(props: { readonly api: ImagesCatalogApi }) {
  const { source } = props.api;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          />
        }
      >
        <Badge variant={source.online ? "success" : "warning"} size="lg">
          {source.online ? "ComfyUI connected" : "ComfyUI not found"}
        </Badge>
      </PopoverTrigger>
      <PopoverPopup className="w-80">
        <PopoverTitle className="mb-1">Connection</PopoverTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          {source.online ? `ComfyUI answers at ${source.baseUrl}.` : source.message}
        </p>
        <AddressField baseUrl={source.baseUrl} onSave={props.api.setBaseUrl} />
      </PopoverPopup>
    </Popover>
  );
}

const VIEWS: ReadonlyArray<{ id: ImagesView; label: string }> = [
  { id: "create", label: "Create" },
  { id: "models", label: "Models" },
  { id: "gallery", label: "Gallery" },
];

/** Make pictures with models on this computer, compare models and keep the best results. */
export function ImagesPage() {
  const api = useImagesCatalog();
  const [memory, patch] = useCreateMemory();
  const { items, catalog } = api;
  const queue = useMemo(() => describeQueue(items), [items]);
  const latestJob = items[0]?.jobId ?? null;
  const latest = useMemo(
    () => (latestJob ? items.filter((item) => item.jobId === latestJob) : []),
    [items, latestJob],
  );
  const doneCount = useMemo(() => items.filter((item) => item.status === "done").length, [items]);
  const readyCount = catalog.filter((model) => model.state === "ready").length;

  const reuse = useCallback(
    (item: GalleryItem) => {
      const runModels = [
        ...new Set(
          items.filter((entry) => entry.jobId === item.jobId).map((entry) => entry.modelId),
        ),
      ];
      patch({
        view: "create",
        prompt: item.prompt,
        modelIds: runModels,
        seedMode: "fixed",
        seed: String(item.seed),
        steps: item.steps,
        guidance: item.guidance,
        sampler: item.sampler,
        negativePrompt: item.negativePrompt,
        ...presetsFor(item.width, item.height),
      });
    },
    [items, patch],
  );
  const lockSeed = useCallback(
    (item: GalleryItem) =>
      patch({ view: "create", seedMode: "fixed", seed: String(item.seed), seedLocked: true }),
    [patch],
  );
  const galleryActions = {
    imageUrl: api.imageUrl,
    onKeep: api.keep,
    onRetry: api.retry,
    onRemove: api.remove,
    onReuse: reuse,
    onLockSeed: lockSeed,
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background scrollbar-gutter-both">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 p-4 max-md:pt-14 sm:p-6">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">Images</h1>
              <p className="text-sm text-muted-foreground">
                Make pictures on your own PC. Give many models the same prompt and compare them.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" size="lg">
                Sample data
              </Badge>
              <ConnectionBadge api={api} />
              {import.meta.env.DEV ? (
                <PreviewMenu preview={api.preview} onChange={api.patchPreview} />
              ) : null}
            </div>
          </header>

          {!api.source.online ? (
            <SetupCard
              source={api.source}
              checking={api.checking}
              onRecheck={api.recheck}
              onSaveAddress={api.setBaseUrl}
            />
          ) : null}

          <ToggleGroup
            aria-label="Images view"
            className="w-full *:flex-1 *:pointer-coarse:min-h-11 sm:w-auto sm:*:min-w-28"
            value={[memory.view]}
            onValueChange={(next) => {
              const view = next[0] as ImagesView | undefined;
              if (view) patch({ view });
            }}
          >
            {VIEWS.map((view) => (
              <Toggle key={view.id} value={view.id}>
                {view.label}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {view.id === "models"
                    ? readyCount
                    : view.id === "gallery"
                      ? doneCount
                      : memory.modelIds.length}
                </span>
              </Toggle>
            ))}
          </ToggleGroup>

          <ImagesQueueBar queue={queue} clockSkew={0} onCancel={api.cancel} />

          {memory.view === "create" ? (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]">
              <CreateView
                memory={memory}
                onChange={patch}
                catalog={catalog}
                items={items}
                online={api.source.online}
                onGenerate={(request) => void api.generate(request)}
                onOpenModels={() => patch({ view: "models" })}
              />
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Latest run</h2>
                  {items.length > 0 ? (
                    <Button size="sm" variant="ghost" onClick={() => patch({ view: "gallery" })}>
                      Open Gallery
                    </Button>
                  ) : null}
                </div>
                <GalleryView items={latest} compact {...galleryActions} />
              </div>
            </div>
          ) : memory.view === "models" ? (
            <ModelsView
              catalog={catalog}
              hardware={api.hardware}
              items={items}
              selectedIds={memory.modelIds}
              online={api.source.online}
              onSelect={(modelIds) => patch({ modelIds })}
              onInstall={api.install}
              onBenchmark={(ids) => {
                api.runBenchmark(ids);
                patch({ view: "gallery" });
              }}
              onDone={() => patch({ view: "create" })}
            />
          ) : (
            <GalleryView items={items} {...galleryActions} />
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
