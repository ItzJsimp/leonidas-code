import {
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type { ImageItem, ImagesState, ProjectId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useCallback, useMemo } from "react";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useProjects } from "~/state/entities";
import {
  imagesCancel,
  imagesGenerate,
  imagesKeep,
  imagesLive,
  imagesSetBaseUrl,
} from "~/state/images";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";
import { toastManager } from "~/components/ui/toast";

import { resolveSelectedModels } from "./images.logic";

/** What the form remembers between visits. */
const FormMemory = Schema.Struct({
  projectId: Schema.NullOr(Schema.String),
  prompt: Schema.String,
  modelIds: Schema.Array(Schema.String),
  count: Schema.Number,
  seed: Schema.String,
});
type FormMemory = typeof FormMemory.Type;

const EMPTY_MEMORY: FormMemory = {
  projectId: null,
  prompt: "",
  modelIds: ["flux2klein"],
  count: 2,
  seed: "",
};

function unwrap<A, E>(result: AtomCommandResult<A, E>): A {
  if (result._tag === "Failure") throw squashAtomCommandFailure(result);
  return result.value;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Everything the Images panel needs: form memory, live state and the four actions. */
export function useImages() {
  const environmentId = usePrimaryEnvironmentId();
  const allProjects = useProjects();
  const projects = useMemo(
    () => allProjects.filter((project) => project.environmentId === environmentId),
    [allProjects, environmentId],
  );
  const [memory, writeMemory] = useLocalStorage("leonidas:images:form", EMPTY_MEMORY, FormMemory);

  const project =
    projects.find((candidate) => candidate.id === memory.projectId) ?? projects[0] ?? null;
  const live = useEnvironmentQuery(
    environmentId === null || project === null
      ? null
      : imagesLive({ environmentId, input: { projectId: project.id } }),
  );
  const state: ImagesState | null = live.data;
  const selectedModelIds = useMemo(
    () => (state ? resolveSelectedModels(state.models, memory.modelIds) : [...memory.modelIds]),
    [memory.modelIds, state],
  );

  const patchMemory = useCallback(
    (patch: Partial<FormMemory>) => writeMemory((current) => ({ ...current, ...patch })),
    [writeMemory],
  );

  const runGenerate = useAtomCommand(imagesGenerate, { reportFailure: false });
  const runCancel = useAtomCommand(imagesCancel, { reportFailure: false });
  const runKeep = useAtomCommand(imagesKeep, { reportFailure: false });
  const runSetBaseUrl = useAtomCommand(imagesSetBaseUrl, { reportFailure: false });

  const attempt = useCallback(async (title: string, action: () => Promise<void>) => {
    try {
      await action();
      return true;
    } catch (error) {
      toastManager.add({ type: "error", title, description: errorText(error) });
      return false;
    }
  }, []);

  const generate = useCallback(
    (seed: number | null) =>
      attempt("Could not start the images", async () => {
        if (environmentId === null || project === null) return;
        unwrap(
          await runGenerate({
            environmentId,
            input: {
              projectId: project.id,
              prompt: memory.prompt.trim(),
              modelIds: selectedModelIds,
              seed,
              count: memory.count,
            },
          }),
        );
      }),
    [attempt, environmentId, memory.count, memory.prompt, project, runGenerate, selectedModelIds],
  );

  const cancel = useCallback(
    (stopRunning: boolean) =>
      attempt("Could not cancel", async () => {
        if (environmentId === null) return;
        unwrap(await runCancel({ environmentId, input: { stopRunning } }));
      }),
    [attempt, environmentId, runCancel],
  );

  const keep = useCallback(
    (item: ImageItem, kept: boolean) =>
      attempt("Could not keep the image", async () => {
        if (environmentId === null || project === null) return;
        unwrap(
          await runKeep({
            environmentId,
            input: { projectId: project.id, itemId: item.id, kept },
          }),
        );
      }),
    [attempt, environmentId, project, runKeep],
  );

  const setBaseUrl = useCallback(
    (baseUrl: string) =>
      attempt("Could not save the address", async () => {
        if (environmentId === null) return;
        unwrap(await runSetBaseUrl({ environmentId, input: { baseUrl } }));
      }),
    [attempt, environmentId, runSetBaseUrl],
  );

  return {
    environmentId,
    projects,
    projectId: (project?.id ?? null) as ProjectId | null,
    state,
    error: live.error,
    isPending: live.isPending && state === null,
    memory,
    selectedModelIds,
    patchMemory,
    generate,
    cancel,
    keep,
    setBaseUrl,
  };
}
