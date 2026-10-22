import type { ActionLogEntry, Inverse } from "./actionLog.ts";
import type { ApplyDeps } from "./apply.ts";
import { ProviderError, type ProviderErrorCode } from "./provider.ts";

export interface UndoSelector {
  /** Undo everything done to this message. Leave out both fields to undo everything. */
  readonly messageId?: string;
  /** Undo one `applied` entry. */
  readonly entryId?: string;
}

export interface UndoStep {
  readonly entry: ActionLogEntry;
  readonly inverse: Inverse;
}

export interface UndoResult {
  readonly entryId: string;
  readonly outcome: "undone" | "skipped" | "failed";
  readonly code?: ProviderErrorCode;
}

/** Applied entries not yet undone or deliberately left, newest first. */
export const planUndo = (
  entries: readonly ActionLogEntry[],
  selector: UndoSelector,
): UndoStep[] => {
  const settled = new Set(
    entries.filter((e) => e.status === "undone" || e.status === "skipped").map((e) => e.ref),
  );
  const steps: UndoStep[] = [];
  for (const entry of entries) {
    if (entry.status !== "applied" || !entry.inverse || settled.has(entry.id)) continue;
    if (selector.messageId !== undefined && entry.messageId !== selector.messageId) continue;
    if (selector.entryId !== undefined && entry.id !== selector.entryId) continue;
    steps.push({ entry, inverse: entry.inverse });
  }
  return steps.toReversed();
};

/** Runs the steps in order. A failed step is logged and the rest still run. A draft the user edited is left alone. */
export const runUndo = async (
  deps: ApplyDeps,
  steps: readonly UndoStep[],
): Promise<UndoResult[]> => {
  const { provider, log, inbox, now, newId } = deps;
  const results: UndoResult[] = [];

  for (const { entry, inverse } of steps) {
    const write = (status: ActionLogEntry["status"], note?: string) =>
      log.append({
        v: 1,
        id: newId(),
        ts: now(),
        inbox,
        messageId: entry.messageId,
        threadId: entry.threadId,
        action: entry.action,
        status,
        ref: entry.id,
        ...(note ? { note } : {}),
      });
    try {
      if (inverse.type === "labels") {
        await provider.modifyLabels(entry.messageId, {
          add: inverse.add,
          remove: inverse.remove,
        });
      } else {
        const draft = await provider.getDraft(inverse.draftId);
        if (draft && draft.messageId !== inverse.draftMessageId) {
          await write("skipped", "edited");
          results.push({ entryId: entry.id, outcome: "skipped" });
          continue;
        }
        if (draft) await provider.deleteDraft(inverse.draftId);
      }
      await write("undone");
      results.push({ entryId: entry.id, outcome: "undone" });
    } catch (err) {
      const code = err instanceof ProviderError ? err.code : undefined;
      await write("failed", code ?? "error");
      results.push({ entryId: entry.id, outcome: "failed", ...(code ? { code } : {}) });
    }
  }
  return results;
};
