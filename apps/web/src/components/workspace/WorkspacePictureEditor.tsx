import type { AiosWorkspaceSummary } from "@t3tools/contracts";
import { ImageUpIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";

import { Tip } from "~/components/twoState/Tip";
import { Spinner } from "~/components/ui/spinner";
import { useAtomCommand } from "~/state/use-atom-command";
import { workspacePictureRemove, workspacePictureSet } from "~/state/workspacePictures";

import {
  prepareWorkspacePicture,
  useWorkspacePictures,
  WorkspacePicture,
} from "./WorkspacePicture";
import { validatePictureFile, WORKSPACE_PICTURE_UPLOAD_TYPES } from "./workspacePicture.logic";

const ICON_BUTTON =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-64";

/** Change or remove the picture of each workspace. The server keeps it for every client. */
export function WorkspacePictureEditor(props: {
  readonly workspaces: ReadonlyArray<AiosWorkspaceSummary>;
  readonly pictures: Readonly<Record<string, string>>;
}) {
  const { environmentId, refresh } = useWorkspacePictures();
  const runSet = useAtomCommand(workspacePictureSet, { reportFailure: false });
  const runRemove = useAtomCommand(workspacePictureRemove, { reportFailure: false });
  const fileInput = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (workspaceId: string, file: File) => {
    const invalid = validatePictureFile(file);
    if (invalid || !environmentId) {
      setError(invalid ?? "Connect to your computer to change the picture.");
      return;
    }
    setBusy(workspaceId);
    setError(null);
    let dataUrl: string;
    try {
      dataUrl = await prepareWorkspacePicture(file);
    } catch {
      setBusy(null);
      setError("Could not read this image. Try another file.");
      return;
    }
    const result = await runSet({ environmentId, input: { workspaceId, dataUrl } });
    setBusy(null);
    if (result._tag === "Success") refresh();
    else setError("Could not save the picture. Try again.");
  };

  const remove = async (workspaceId: string) => {
    if (!environmentId) return;
    setBusy(workspaceId);
    setError(null);
    const result = await runRemove({ environmentId, input: { workspaceId } });
    setBusy(null);
    if (result._tag === "Success") refresh();
    else setError("Could not remove the picture. Try again.");
  };

  return (
    <div className="flex flex-col gap-0.5 border-t border-border pt-1.5">
      <p className="px-0.5 pb-0.5 text-xs text-muted-foreground">Pictures</p>
      {props.workspaces.map((workspace) => {
        const id = workspace.id!;
        const name = workspace.name ?? id;
        const hasOwn = Object.hasOwn(props.pictures, id);
        return (
          <div key={id} className="flex min-w-0 items-center gap-2 py-0.5">
            <WorkspacePicture
              workspaceId={id}
              name={name}
              pictures={props.pictures}
              className="size-6 text-xs"
            />
            <Tip text={name}>
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
            </Tip>
            {busy === id ? <Spinner className="size-3.5" /> : null}
            <Tip text="Change picture">
              <button
                type="button"
                aria-label={`Change picture for ${name}`}
                disabled={busy !== null}
                className={ICON_BUTTON}
                onClick={() => {
                  setTarget(id);
                  fileInput.current?.click();
                }}
              >
                <ImageUpIcon aria-hidden className="size-3.5" />
              </button>
            </Tip>
            {hasOwn ? (
              <Tip text="Remove picture">
                <button
                  type="button"
                  aria-label={`Remove picture for ${name}`}
                  disabled={busy !== null}
                  className={ICON_BUTTON}
                  onClick={() => void remove(id)}
                >
                  <Trash2Icon aria-hidden className="size-3.5" />
                </button>
              </Tip>
            ) : (
              // Keeps every row's change button in one column.
              <span aria-hidden className="size-6 shrink-0" />
            )}
          </div>
        );
      })}
      {error ? (
        <p role="alert" className="px-0.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <input
        ref={fileInput}
        type="file"
        accept={WORKSPACE_PICTURE_UPLOAD_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file && target) void upload(target, file);
        }}
      />
    </div>
  );
}
