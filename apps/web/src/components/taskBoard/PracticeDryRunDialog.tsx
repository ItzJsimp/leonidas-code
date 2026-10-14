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

import type { PracticeDryRun } from "./practice.logic";

/** Shows what "Send to agent" would have done, without starting anything. */
export function PracticeDryRunDialog(props: {
  readonly dryRun: PracticeDryRun | null;
  readonly onClose: () => void;
  readonly onFinish: () => void;
}) {
  const { dryRun } = props;
  const count = dryRun?.tasks.length ?? 0;
  return (
    <Dialog open={dryRun !== null} onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Practice: no agent was started</DialogTitle>
          <DialogDescription>
            This is what would happen for real. Nothing was sent, claimed or published.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="space-y-3 text-sm">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                {count === 1
                  ? "One new chat opens in the task's project, using your default model."
                  : `One new chat opens for all ${count} tasks, using your default model.`}
              </li>
              <li>
                {count === 1 ? "The task moves" : "The tasks move"} to In progress, claimed by you.
              </li>
              <li>
                The agent updates {count === 1 ? "its card" : "each card"} as it works. If it
                forgets, Leonidas moves {count === 1 ? "it" : "them"} to Review when the run ends.
              </li>
            </ul>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">What the agent would be told</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs">
                {dryRun?.prompt}
              </pre>
            </div>
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={props.onFinish}>
            Pretend the agent finished
          </Button>
          <Button onClick={props.onClose}>Close</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
