import type { AiosWorkspaceSummary, AiosWorkspaceType } from "@t3tools/contracts";
import { FolderCogIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { aiosWorkspaceInit } from "~/state/aiosWorkspaces";
import { useAtomCommand } from "~/state/use-atom-command";

import { suggestWorkspaceId, workspaceFolderName } from "./aiosWorkspace.logic";
import { useActiveAiosWorkspace } from "./useActiveAiosWorkspace";
import { WorkspacePictureEditor } from "./WorkspacePictureEditor";
import { useWorkspacePictures, WorkspacePicture } from "./WorkspacePicture";

/**
 * Picks the AIOS workspace this window shows, and offers setup for a folder with no valid
 * workspace.json. Hidden when there is one ready workspace and nothing to set up, unless
 * `editPictures` asks for the picture editor (the rail avatar menu).
 */
export function WorkspaceSwitcher(props: { readonly editPictures?: boolean }) {
  const { environmentId, workspaces, active, choose, refresh } = useActiveAiosWorkspace();
  const { pictures } = useWorkspacePictures();
  const [setupRoot, setSetupRoot] = useState<string | null>(null);
  const ready = workspaces.filter((workspace) => workspace.status === "ready");
  const needsSetup = workspaces.filter((workspace) => workspace.status !== "ready");
  const editPictures = props.editPictures === true && ready.length > 0;
  if (environmentId === null || (ready.length <= 1 && needsSetup.length === 0 && !editPictures)) {
    return null;
  }

  const setupTarget = needsSetup.find((workspace) => workspace.root === setupRoot) ?? null;
  const items = ready.map((workspace) => ({ value: workspace.id!, label: workspace.name! }));

  return (
    <div className="flex flex-col gap-1.5 px-2 pb-1">
      {ready.length > 1 || (ready.length === 1 && !editPictures) ? (
        <Select
          modal={false}
          value={active?.id ?? null}
          onValueChange={(value) => {
            if (typeof value === "string") choose(value);
          }}
          items={items}
        >
          <SelectTrigger size="sm" aria-label="Workspace" className="w-full">
            <span className="flex min-w-0 items-center gap-1.5">
              <WorkspacePicture
                workspaceId={active?.id}
                name={active?.name ?? ""}
                pictures={pictures}
                className="size-4 text-3xs"
              />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectPopup>
            {ready.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                <span className="flex items-center gap-1.5">
                  <WorkspacePicture
                    workspaceId={workspace.id}
                    name={workspace.name ?? ""}
                    pictures={pictures}
                    className="size-4 text-3xs"
                  />
                  {workspace.name}
                </span>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      ) : null}
      {editPictures ? <WorkspacePictureEditor workspaces={ready} pictures={pictures} /> : null}
      {needsSetup.map((workspace) => (
        <button
          key={workspace.root}
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setSetupRoot(workspace.root)}
        >
          <FolderCogIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">Set up {workspaceFolderName(workspace.root)}</span>
        </button>
      ))}
      <Dialog
        open={setupTarget !== null}
        onOpenChange={(open) => {
          if (!open) setSetupRoot(null);
        }}
      >
        <DialogPopup>
          {setupTarget ? (
            <WorkspaceSetupForm
              environmentId={environmentId}
              workspace={setupTarget}
              onDone={(workspaceId) => {
                setSetupRoot(null);
                refresh();
                if (workspaceId) choose(workspaceId);
              }}
            />
          ) : null}
        </DialogPopup>
      </Dialog>
    </div>
  );
}

function WorkspaceSetupForm(props: {
  readonly environmentId: NonNullable<ReturnType<typeof useActiveAiosWorkspace>["environmentId"]>;
  readonly workspace: AiosWorkspaceSummary;
  readonly onDone: (workspaceId: string | null) => void;
}) {
  const id = useId();
  const folder = workspaceFolderName(props.workspace.root);
  const [name, setName] = useState(folder.replace(/\s+AIOS$/i, ""));
  const [type, setType] = useState<AiosWorkspaceType>("personal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runInit = useAtomCommand(aiosWorkspaceInit, { reportFailure: false });
  const workspaceId = suggestWorkspaceId(name);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await runInit({
      environmentId: props.environmentId,
      input: { root: props.workspace.root, id: workspaceId, name: name.trim(), type },
    });
    setBusy(false);
    if (result._tag === "Success") props.onDone(workspaceId);
    else setError("Could not save the workspace file. Check that the folder is writable.");
  };

  return (
    <form className="contents" onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>Set up {folder}</DialogTitle>
        <DialogDescription>
          {props.workspace.status === "invalid"
            ? `The workspace file in this folder is not valid (${props.workspace.error ?? "unknown error"}). Save a new one to open it.`
            : "This folder has no workspace file yet. Save one to open it as its own workspace."}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <div className="flex flex-col gap-4">
          <Label className="flex flex-col items-stretch" htmlFor={`${id}-name`}>
            Name
            <Input
              id={`${id}-name`}
              autoFocus
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </Label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Type</legend>
            {(["personal", "business"] as const).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${id}-type`}
                  checked={type === option}
                  onChange={() => setType(option)}
                />
                {option === "personal" ? "Personal" : "Business"}
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Saves workspace.json with the id <code>{workspaceId}</code> in {props.workspace.root}.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => props.onDone(null)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? <Spinner /> : null}
          Save workspace
        </Button>
      </DialogFooter>
    </form>
  );
}
