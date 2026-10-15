import type { EnvironmentId } from "@t3tools/contracts";
import { PartyPopperIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { useEnvironmentIds } from "../../state/environments";
import { useEnvironmentQuery } from "../../state/query";
import { taskBoardCompletionsLive } from "../../state/taskBoard";
import { toastManager } from "../ui/toast";
import { celebrationMessage, takeFreshCompletions } from "./taskCelebration.logic";

/** Celebrates each task the user or their agents complete, on every connected environment. */
export function TaskCelebrationCoordinator() {
  const environmentIds = useEnvironmentIds();
  return environmentIds.map((environmentId) => (
    <EnvironmentCelebrations key={environmentId} environmentId={environmentId} />
  ));
}

function EnvironmentCelebrations({ environmentId }: { environmentId: EnvironmentId }) {
  // A server without this stream fails the subscription; `data` then stays null and nothing shows.
  const completions = useEnvironmentQuery(
    taskBoardCompletionsLive({ environmentId, input: {} }),
  ).data;
  const seen = useRef<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (completions === null) return;
    const { seen: next, fresh } = takeFreshCompletions(seen.current, completions, Date.now());
    seen.current = next;
    for (const completion of fresh) {
      toastManager.add({
        type: "success",
        title: celebrationMessage(completion, completion.completedAt),
        timeout: 2_500,
        data: {
          hideCopyButton: true,
          leadingIcon: <PartyPopperIcon aria-hidden className="size-4 text-success-foreground" />,
        },
      });
    }
  }, [completions]);

  return null;
}
