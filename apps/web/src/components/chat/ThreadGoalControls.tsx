import { useEffect, useRef, useState } from "react";
import type { ThreadGoal, ThreadGoalControl } from "@t3tools/contracts";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DictationTextarea } from "~/components/voice/DictationTextarea";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

/**
 * The goal dialog. The chat title menu and /goal open it through `request`; the goal banner over
 * the composer shows its state and holds pause, resume and clear.
 */
export function ThreadGoalControls({
  goal,
  disabled,
  request,
  onControl,
}: {
  goal: ThreadGoal | null;
  disabled: boolean;
  request: { action: "start" | "resume" | "show"; condition: string; nonce: number } | null;
  onControl: (control: ThreadGoalControl) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [condition, setCondition] = useState("");
  const [turnCap, setTurnCap] = useState("20");
  const [budget, setBudget] = useState("");
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  // A request opens the dialog once; a later goal change must not reopen it.
  const handledNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!request || handledNonce.current === request.nonce) return;
    handledNonce.current = request.nonce;
    setResuming(request.action === "resume");
    setCondition(request.condition || goal?.condition || "");
    setOpen(true);
  }, [request, goal?.condition]);
  const run = async (control: ThreadGoalControl) => {
    setBusy(true);
    try {
      if (await onControl(control)) setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resuming ? "Resume goal" : "Set a goal for this chat"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              The AI keeps working and checks the goal after each reply, up to the limit you set.
              The checks use your AI account and may use some of your limit. Manual checks wait for
              you. Stop pauses the goal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 px-6 pb-6">
            <label htmlFor="thread-goal-condition">Completion condition</label>
            <DictationTextarea
              id="thread-goal-condition"
              value={resuming ? (goal?.condition ?? "") : condition}
              onChange={(event) => setCondition(event.target.value)}
              maxLength={4000}
              disabled={resuming || busy}
            />
            {!resuming ? (
              <>
                <label htmlFor="thread-goal-cap">Most replies (default 20)</label>
                <Input
                  id="thread-goal-cap"
                  type="number"
                  min={1}
                  max={100}
                  value={turnCap}
                  onChange={(event) => setTurnCap(event.target.value)}
                />
                <label htmlFor="thread-goal-budget">Token limit for the AI (optional)</label>
                <Input
                  id="thread-goal-budget"
                  type="number"
                  min={1}
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                />
                <label htmlFor="thread-goal-check">Command that checks the goal (optional)</label>
                <Input
                  id="thread-goal-check"
                  value={command}
                  maxLength={4000}
                  onChange={(event) => setCommand(event.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  If you add a command, you let the AI run it in this chat's project after each
                  reply. Exit code 0 means the goal is met. With no command, the model reads the
                  chat to check.
                </p>
              </>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" disabled={busy} />}>
              Cancel
            </AlertDialogClose>
            <Button
              disabled={
                busy ||
                disabled ||
                (!resuming &&
                  (!condition.trim() ||
                    !Number.isInteger(Number(turnCap)) ||
                    Number(turnCap) < 1 ||
                    Number(turnCap) > 100 ||
                    (budget !== "" &&
                      (!Number.isSafeInteger(Number(budget)) || Number(budget) < 1))))
              }
              onClick={() =>
                void run(
                  resuming
                    ? { action: "resume", spendingApproved: true }
                    : {
                        action: "start",
                        condition: condition.trim(),
                        spendingApproved: true,
                        maxTurns: Number(turnCap),
                        ...(budget ? { tokenBudget: Number(budget) } : {}),
                        ...(command.trim()
                          ? { check: { command: command.trim(), approved: true } }
                          : {}),
                      },
                )
              }
            >
              {busy ? "Starting..." : resuming ? "Allow use and resume" : "Allow use and start"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
