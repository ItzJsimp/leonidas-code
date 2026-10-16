import type { ImageItem } from "@t3tools/contracts";
import { useCallback, useMemo } from "react";

import { Badge } from "../ui/badge";
import { SidebarInset } from "../ui/sidebar";
import { Spinner } from "../ui/spinner";
import { ComfySettings } from "./ComfySettings";
import { Hint } from "./Hint";
import { ImagesForm } from "./ImagesForm";
import { ImagesGrid } from "./ImagesGrid";
import { ImagesQueueBar } from "./ImagesQueueBar";
import { describeQueue } from "./images.logic";
import { useImages } from "./useImages";

/** Make pictures with models on this computer. Pictures save in the project, with a recipe file. */
export function ImagesPage() {
  const images = useImages();
  const { state, memory, patchMemory } = images;
  const items = useMemo(() => state?.items ?? [], [state]);
  const queue = useMemo(() => describeQueue(items), [items]);
  // Server time minus this device's time, so elapsed seconds are right on a remote device.
  const clockSkew = useMemo(() => (state ? state.now - Date.now() : 0), [state]);

  const reuse = useCallback(
    (item: ImageItem) => patchMemory({ prompt: item.prompt }),
    [patchMemory],
  );

  const { generate: startImages } = images;
  const generate = useCallback((seed: number | null) => void startImages(seed), [startImages]);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 p-4 max-md:pt-14 sm:p-6">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">Images</h1>
              <p className="text-sm text-muted-foreground">
                Make pictures with models on your computer. Each picture saves in your project with
                a recipe file.
              </p>
            </div>
            {state ? (
              <Hint
                tip={
                  state.source.online
                    ? `ComfyUI answers at ${state.source.baseUrl}.`
                    : (state.source.message ?? "ComfyUI does not answer.")
                }
              >
                <Badge variant={state.source.online ? "success" : "warning"} size="lg">
                  {state.source.online ? "ComfyUI connected" : "ComfyUI not found"}
                </Badge>
              </Hint>
            ) : null}
          </header>

          {images.error ? (
            <p className="text-sm text-destructive-foreground" role="alert">
              {images.error}
            </p>
          ) : null}

          {/* On a phone the order is form, pictures, connection. On a wide screen the pictures fill the right column. */}
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
            <div className="lg:col-start-1 lg:row-start-1">
              <ImagesForm
                values={{
                  prompt: memory.prompt,
                  seed: memory.seed,
                  count: memory.count,
                  modelIds: images.selectedModelIds,
                }}
                models={state?.models ?? []}
                items={items}
                projects={images.projects}
                projectId={images.projectId}
                canStart={images.projectId !== null && state !== null}
                onChange={patchMemory}
                onGenerate={generate}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <ImagesQueueBar queue={queue} clockSkew={clockSkew} onCancel={images.cancel} />
              {images.isPending ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> Loading...
                </p>
              ) : null}
              {state && images.environmentId ? (
                <ImagesGrid
                  environmentId={images.environmentId}
                  workspaceRoot={state.workspaceRoot}
                  items={items}
                  clockSkew={clockSkew}
                  onKeep={images.keep}
                  onReuse={reuse}
                />
              ) : null}
            </div>

            <div className="lg:col-start-1 lg:row-start-2">
              <ComfySettings source={state?.source ?? null} onSave={images.setBaseUrl} />
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
