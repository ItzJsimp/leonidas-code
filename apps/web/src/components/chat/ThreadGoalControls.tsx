import { useEffect, useState } from "react";
import { TargetIcon } from "lucide-react";
import type { ThreadGoal, ThreadGoalControl } from "@t3tools/contracts";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

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
  useEffect(() => {
    if (!request) return;
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
  const active = goal?.status === "active" || goal?.status === "evaluating";
  const canResume =
    goal?.status === "paused" &&
    goal.turns < goal.maxTurns &&
    (goal.tokenBudget === undefined || goal.tokensUsed < goal.tokenBudget);
  return (
    <>
      <div className="flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || busy}
          onClick={() => {
            setResuming(false);
            setCondition(goal?.condition ?? "");
            setOpen(true);
          }}
          aria-label="Configure thread goal"
        >
          <TargetIcon aria-hidden="true" />
          Goal
        </Button>
        {active ? (
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled || busy}
            onClick={() => void run({ action: "pause" })}
          >
            Pause goal
          </Button>
        ) : null}
        {canResume ? (
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled || busy}
            onClick={() => {
              setResuming(true);
              setOpen(true);
            }}
          >
            Resume goal
          </Button>
        ) : null}
        {goal ? (
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled || busy}
            onClick={() => void run({ action: "clear" })}
          >
            Clear goal
          </Button>
        ) : null}
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{resuming ? "Resume goal" : "Start a thread goal"}</AlertDialogTitle>
            <AlertDialogDescription>
              Allow agent turns and one check after each completed turn, up to the chosen cap. Model
              checks use your configured text-generation provider and may consume your subscription
              or credits. Manual checks stay pending. Stop pauses the goal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 px-6 pb-6">
            <label htmlFor="thread-goal-condition">Completion condition</label>
            <Textarea
              id="thread-goal-condition"
              value={resuming ? (goal?.condition ?? "") : condition}
              onChange={(event) => setCondition(event.target.value)}
              maxLength={4000}
              disabled={resuming || busy}
            />
            {!resuming ? (
              <>
                <label htmlFor="thread-goal-cap">Maximum turns (default 20)</label>
                <Input
                  id="thread-goal-cap"
                  type="number"
                  min={1}
                  max={100}
                  value={turnCap}
                  onChange={(event) => setTurnCap(event.target.value)}
                />
                <label htmlFor="thread-goal-budget">Agent token budget (optional)</label>
                <Input
                  id="thread-goal-budget"
                  type="number"
                  min={1}
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                />
                <label htmlFor="thread-goal-check">Check command (optional)</label>
                <Input
                  id="thread-goal-check"
                  value={command}
                  maxLength={4000}
                  onChange={(event) => setCommand(event.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Adding a command explicitly approves running it in this thread's workspace after
                  each turn. Exit code 0 meets the goal. With no command, the model checks quoted
                  transcript evidence.
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
              {busy
                ? "Starting..."
                : resuming
                  ? "Allow spending and resume"
                  : "Allow spending and start"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
