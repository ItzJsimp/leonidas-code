import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { FolderCheckIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useEnvironmentQuery } from "~/state/query";
import { taskBoardAiosConfirm, taskBoardAiosDetectQuery } from "~/state/taskBoard";
import { useAtomCommand } from "~/state/use-atom-command";
import { failureText } from "./useTaskActions.logic";

/**
 * One-time confirm screen: until a folder is confirmed, offers the AIOS folders the server found
 * (best match first) or a typed path. Confirming saves it for every client; it then disappears.
 */
export function AiosConfirmCard(props: {
  readonly environmentId: EnvironmentId | null;
  readonly onConfirmed: () => void;
}) {
  const detect = useEnvironmentQuery(
    props.environmentId
      ? taskBoardAiosDetectQuery({ environmentId: props.environmentId, input: {} })
      : null,
  );
  const runConfirm = useAtomCommand(taskBoardAiosConfirm, { reportFailure: false });
  const canConfirm = useAtomValue(taskBoardAiosConfirm.permissionAtom(props.environmentId));
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, refresh } = detect;
  if (!data || data.confirmedRoot !== null || dismissed) return null;

  const confirm = async (root: string) => {
    if (!props.environmentId || busy) return;
    setBusy(true);
    setError(null);
    const result = await runConfirm({ environmentId: props.environmentId, input: { root } });
    setBusy(false);
    if (result._tag === "Success") {
      refresh();
      props.onConfirmed();
    } else if (!isAtomCommandInterrupted(result)) {
      setError(failureText(squashAtomCommandFailure(result), "Could not use that folder."));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (path.trim()) void confirm(path.trim());
  };

  return (
    <section
      aria-label="Connect your AIOS"
      className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 text-sm"
    >
      <div className="flex items-center gap-2">
        <FolderCheckIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h3 className="min-w-0 flex-1 font-medium">
          {data.candidates.length > 0 ? "Is this your AIOS?" : "Where is your AIOS?"}
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Not now
        </Button>
      </div>
      {data.candidates.slice(0, 5).map((candidate) => (
        <div key={candidate.root} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate">{candidate.root}</p>
            <p className="text-xs text-muted-foreground">
              {candidate.cardCount} task cards ·{" "}
              {candidate.confidence === "marker" ? "looks like an AIOS" : "cards match the format"}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !canConfirm}
            onClick={() => void confirm(candidate.root)}
          >
            Use this
          </Button>
        </div>
      ))}
      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="min-w-40 flex-1">
          <Input
            aria-label="AIOS folder path"
            placeholder="Or paste the folder that holds your tasks/ folder"
            value={path}
            disabled={busy}
            onChange={(event) => setPath(event.target.value)}
          />
        </div>
        <Button type="submit" size="sm" disabled={busy || !canConfirm || !path.trim()}>
          Use folder
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-xs text-destructive-foreground">
          {error}
        </p>
      ) : null}
    </section>
  );
}
