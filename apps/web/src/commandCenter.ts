import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { resolveSidebarThreadStatus } from "./components/Sidebar.logic";

export type CommandCenterStatus = "approval" | "input" | "limited" | "working" | "waiting";
export interface CommandCenterRow {
  readonly thread: EnvironmentThreadShell;
  readonly status: CommandCenterStatus;
}

/** Shell subscriptions already span environments; never fetch full chat histories for this view. */
export function groupCommandCenterThreads(threads: ReadonlyArray<EnvironmentThreadShell>) {
  const groups: Record<"attention" | "limited" | "running", CommandCenterRow[]> = {
    attention: [],
    limited: [],
    running: [],
  };
  for (const thread of threads) {
    if (thread.archivedAt !== null || thread.deletedAt !== null) continue;
    const status = resolveSidebarThreadStatus(thread);
    if (status === "approval" || status === "input") groups.attention.push({ thread, status });
    else if (status === "limited") groups.limited.push({ thread, status });
    else if (status === "working" || status === "waiting") groups.running.push({ thread, status });
  }
  for (const rows of Object.values(groups)) {
    rows.sort((a, b) => b.thread.updatedAt.localeCompare(a.thread.updatedAt));
  }
  return groups;
}
