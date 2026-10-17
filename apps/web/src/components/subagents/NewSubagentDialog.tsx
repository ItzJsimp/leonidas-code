import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, SubagentCatalogEntry } from "@t3tools/contracts";
import { useId, useMemo, useState, type FormEvent } from "react";

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
import { Spinner } from "~/components/ui/spinner";
import { SUBAGENT_STARTERS } from "~/onboarding/subagentStarters";
import { subagentCreate } from "~/state/subagents";
import { workspaceScopeInput } from "~/components/workspace/aiosWorkspace.logic";
import { activeWorkspaceId } from "~/components/workspace/aiosWorkspaceStore";
import { useAtomCommand } from "~/state/use-atom-command";
import { writeFailureMessage } from "./SubagentEditor";
import { newSubagentDestinations, slugifySubagentName } from "./subagentEdit.logic";

/** Start a subagent from one of the starters, under a new name. */
export function NewSubagentDialog(props: {
  readonly environmentId: EnvironmentId;
  readonly entries: ReadonlyArray<SubagentCatalogEntry>;
  readonly hasAios: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (entry: SubagentCatalogEntry) => void;
}) {
  const create = useAtomCommand(subagentCreate, { reportFailure: false });
  const destinations = useMemo(
    () => newSubagentDestinations(props.entries, props.hasAios),
    [props.entries, props.hasAios],
  );
  const [starterName, setStarterName] = useState(SUBAGENT_STARTERS[0]?.name ?? "");
  const [nameText, setNameText] = useState("");
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  const starter = SUBAGENT_STARTERS.find((item) => item.name === starterName);
  const name = slugifySubagentName(nameText);
  const destination = destinations.find(
    (item) => item.id === (destinationId ?? destinations[0]?.id),
  );
  const canCreate = starter !== undefined && name !== null && destination !== undefined && !busy;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate || starter === undefined || name === null || destination === undefined) return;
    setBusy(true);
    setError(null);
    const result = await create({
      environmentId: props.environmentId,
      input: {
        ...workspaceScopeInput(activeWorkspaceId(props.environmentId)),
        name,
        contents: starter.contents,
        destination:
          destination.id === "aios"
            ? { kind: "aios" }
            : { kind: "project", projectName: destination.id.slice("project:".length) },
      },
    });
    setBusy(false);
    if (result._tag === "Success") {
      setNameText("");
      props.onOpenChange(false);
      return props.onCreated(result.value);
    }
    if (isAtomCommandInterrupted(result)) return;
    setError(
      writeFailureMessage(squashAtomCommandFailure(result), "It was not created. Try again."),
    );
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New helper</DialogTitle>
            <DialogDescription>
              Start from a starter, then edit it. The starter decides if it is on or off.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-starter`} className="font-medium">
                Starter
              </label>
              <select
                id={`${ids}-starter`}
                value={starterName}
                onChange={(event) => setStarterName(event.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {SUBAGENT_STARTERS.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-name`} className="font-medium">
                Name
              </label>
              <Input
                id={`${ids}-name`}
                autoFocus
                value={nameText}
                placeholder="my-helper"
                onChange={(event) => setNameText(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {name === null ? "Lowercase words joined by dashes." : `Saved as ${name}.md`}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${ids}-where`} className="font-medium">
                Where
              </label>
              <select
                id={`${ids}-where`}
                value={destination?.id ?? ""}
                onChange={(event) => setDestinationId(event.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {destinations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {error === null ? null : (
              <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2">
                {error}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canCreate}>
              {busy ? <Spinner /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
