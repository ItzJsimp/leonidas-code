import type { ThreadGoal, ThreadGoalControl } from "@t3tools/contracts";
import { useState } from "react";

import { Button } from "~/components/ui/button";

import { goalActions } from "./threadGoal.logic";

/** Pause, resume and clear for the app goal, in the goal banner over the composer. */
export function GoalBannerActions({
  goal,
  disabled,
  onControl,
  onResume,
}: {
  goal: ThreadGoal;
  disabled: boolean;
  onControl: (control: ThreadGoalControl) => Promise<boolean>;
  /** Resume asks for approval again, so it opens the goal dialog. */
  onResume: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { canPause, canResume, canClear } = goalActions(goal);
  const run = async (control: ThreadGoalControl) => {
    setBusy(true);
    try {
      await onControl(control);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {canPause ? (
        <Button
          size="xs"
          variant="ghost"
          disabled={disabled || busy}
          onClick={() => void run({ action: "pause" })}
        >
          Pause goal
        </Button>
      ) : null}
      {canResume ? (
        <Button size="xs" variant="ghost" disabled={disabled || busy} onClick={onResume}>
          Resume goal
        </Button>
      ) : null}
      {canClear ? (
        <Button
          size="xs"
          variant="ghost"
          disabled={disabled || busy}
          onClick={() => void run({ action: "clear" })}
        >
          Clear goal
        </Button>
      ) : null}
    </>
  );
}
