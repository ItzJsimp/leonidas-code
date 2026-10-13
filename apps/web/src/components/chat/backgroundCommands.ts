import type { OrchestrationV2PendingBackgroundTask } from "@t3tools/contracts";

// Claude's shell tool answers a backgrounded command immediately, so its item
// settles as completed while the process keeps running.
const BACKGROUNDED_OUTPUT = /^command running in background/iu;

interface BackgroundCommandCandidate {
  readonly id: string;
  readonly type: string;
}

function commandOutput(item: BackgroundCommandCandidate): string {
  const output: unknown = Reflect.get(item, "output");
  return typeof output === "string" ? output : "";
}

/**
 * Ids of the command items whose process is still running. The provider
 * roster says how many background commands are live, not which items they
 * are, so the most recently backgrounded items take those slots.
 */
export function liveBackgroundCommandIds(
  turnItems: ReadonlyArray<BackgroundCommandCandidate>,
  pendingTasks: ReadonlyArray<Pick<OrchestrationV2PendingBackgroundTask, "kind">>,
): ReadonlyArray<string> {
  const liveCount = pendingTasks.filter((task) => task.kind === "command").length;
  if (liveCount === 0) return [];
  const ids: string[] = [];
  for (let index = turnItems.length - 1; index >= 0 && ids.length < liveCount; index -= 1) {
    const item = turnItems[index]!;
    if (item.type === "command_execution" && BACKGROUNDED_OUTPUT.test(commandOutput(item))) {
      ids.push(item.id);
    }
  }
  return ids;
}
