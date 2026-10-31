import type { EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";
import { useEnvironmentQuery } from "~/state/query";
import { useVcsInitAction } from "~/state/sourceControlActions";
import { vcsEnvironment } from "~/state/vcs";
import { Button } from "../ui/button";

export const TURN_ON_UNDO_TEXT = "Going back to a turn needs a saved history. Turn it on?";

/** Shown under a reply when the project folder has no git, so "Go back to here" cannot work yet. */
export function TurnOnUndoNote({
  environmentId,
  cwd,
}: {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
}) {
  const status = useEnvironmentQuery(vcsEnvironment.status({ environmentId, input: { cwd } }));
  const init = useVcsInitAction({ environmentId, cwd });
  const [failed, setFailed] = useState(false);
  const [turnedOn, setTurnedOn] = useState(false);

  if (turnedOn) {
    return (
      <p className="mt-2 text-xs text-muted-foreground" role="status">
        Saved history is on. You can go back to your next turn.
      </p>
    );
  }
  if (status.data?.isRepo !== false) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{TURN_ON_UNDO_TEXT}</span>
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={init.isPending}
        onClick={() =>
          void init.run().then((result) => {
            setFailed(result._tag !== "Success");
            setTurnedOn(result._tag === "Success");
          })
        }
      >
        {init.isPending ? "Turning on..." : "Turn on"}
      </Button>
      {failed ? <span role="alert">That did not work. Try again.</span> : null}
    </div>
  );
}
