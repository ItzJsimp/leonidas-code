import type { QueueView } from "./images.logic";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { ElapsedText } from "./ElapsedText";
import { Hint } from "./Hint";

/** Shows what runs now and how many wait. Gives the two cancel buttons. */
export function ImagesQueueBar(props: {
  readonly queue: QueueView;
  readonly clockSkew: number;
  readonly onCancel: (stopRunning: boolean) => void;
}) {
  const { queue } = props;
  if (!queue.active) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-4 py-3 shadow-xs/5"
      role="status"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {queue.running ? (
          <span className="inline-flex items-center gap-2 font-medium">
            <Spinner />
            Running {queue.running.modelLabel}
            {queue.running.startedAt !== null ? (
              <span className="font-normal text-muted-foreground">
                <ElapsedText startedAt={queue.running.startedAt} clockSkew={props.clockSkew} />
              </span>
            ) : null}
          </span>
        ) : null}
        <span className="text-muted-foreground">
          {queue.waiting === 0 ? "Nothing else waits." : `${String(queue.waiting)} waiting`}
        </span>
      </div>
      <div className="flex gap-2">
        <Hint tip="Removes every image that has not started. The image that runs now finishes.">
          <Button
            size="sm"
            variant="outline"
            disabled={queue.waiting === 0}
            onClick={() => props.onCancel(false)}
          >
            Cancel waiting
          </Button>
        </Hint>
        <Hint tip="Stops the image that runs now and removes the waiting ones. Nothing is saved for them.">
          <Button size="sm" variant="destructive-outline" onClick={() => props.onCancel(true)}>
            Stop all
          </Button>
        </Hint>
      </div>
    </div>
  );
}
