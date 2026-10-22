import type { ActionLogEntry, ActionLogStore, Inverse, LoggedAction } from "./actionLog.ts";
import { ProviderError, type MailProvider, type ProviderErrorCode } from "./provider.ts";
import type { Action, MailMessage } from "./types.ts";

export interface ApplyDeps {
  readonly provider: MailProvider;
  readonly log: ActionLogStore;
  readonly inbox: string;
  /** ISO 8601 time. Supplied by the caller so this file stays free of clocks. */
  readonly now: () => string;
  readonly newId: () => string;
}

export interface ApplyResult {
  readonly action: Action["type"];
  readonly outcome: "applied" | "skipped" | "failed" | "noop";
  readonly code?: ProviderErrorCode;
}

/** A draft the log says we made for this thread and nobody has undone. */
const hasLiveDraft = (entries: readonly ActionLogEntry[], threadId: string): boolean => {
  const undone = new Set(entries.filter((e) => e.status === "undone").map((e) => e.ref));
  return entries.some(
    (e) =>
      e.threadId === threadId &&
      e.status === "applied" &&
      e.inverse?.type === "deleteDraft" &&
      !undone.has(e.id),
  );
};

/**
 * Runs a plan against the mailbox. Writes an `intent` line before each mailbox call and an outcome line after.
 * Safe to repeat: a label or archive that is already in place is skipped, and a thread gets one live draft.
 * Stops at the first failed call. A log write that fails throws, so no mailbox change goes unlogged.
 */
export const applyActions = async (
  deps: ApplyDeps,
  message: MailMessage,
  actions: readonly Action[],
): Promise<ApplyResult[]> => {
  const { provider, log, inbox } = deps;
  const { now, newId } = deps;
  const results: ApplyResult[] = [];

  const entry = (
    id: string,
    action: LoggedAction,
    status: ActionLogEntry["status"],
    extra: Partial<ActionLogEntry> = {},
  ): ActionLogEntry => ({
    v: 1,
    id,
    ts: now(),
    inbox,
    messageId: message.id,
    threadId: message.threadId,
    action,
    status,
    ...extra,
  });

  /** Log intent, run the call, log the outcome. Returns false when the call failed. */
  const step = async (
    action: LoggedAction,
    type: Action["type"],
    call: () => Promise<Inverse>,
  ): Promise<boolean> => {
    const intentId = newId();
    await log.append(entry(intentId, action, "intent"));
    let inverse: Inverse;
    try {
      inverse = await call();
    } catch (err) {
      const code = err instanceof ProviderError ? err.code : undefined;
      await log.append(entry(newId(), action, "failed", { ref: intentId, note: code ?? "error" }));
      results.push({ action: type, outcome: "failed", ...(code ? { code } : {}) });
      return false;
    }
    // Outside the try: a log that breaks now throws, so a change that happened is never reported as failed.
    await log.append(entry(newId(), action, "applied", { ref: intentId, inverse }));
    results.push({ action: type, outcome: "applied" });
    return true;
  };

  for (const action of actions) {
    if (action.type === "label") {
      const add = action.labels.filter((l) => !message.labels.includes(l));
      if (add.length === 0) {
        results.push({ action: "label", outcome: "skipped" });
        continue;
      }
      const ok = await step({ type: "label", labels: add }, "label", async () => {
        for (const name of add) await provider.ensureLabel(name);
        await provider.modifyLabels(message.id, { add, remove: [] });
        return { type: "labels", add: [], remove: add };
      });
      if (!ok) break;
    } else if (action.type === "archive") {
      if (!message.labels.includes("INBOX")) {
        results.push({ action: "archive", outcome: "skipped" });
        continue;
      }
      const ok = await step({ type: "archive" }, "archive", async () => {
        await provider.archive(message.id);
        return { type: "labels", add: ["INBOX"], remove: [] };
      });
      if (!ok) break;
    } else if (action.type === "draft") {
      if (hasLiveDraft(await log.readAll(), message.threadId)) {
        results.push({ action: "draft", outcome: "skipped" });
        continue;
      }
      const ok = await step({ type: "draft" }, "draft", async () => {
        const draft = await provider.createDraft({
          threadId: message.threadId,
          to: message.fromAddress,
          subject: action.subject,
          body: action.body,
        });
        return { type: "deleteDraft", draftId: draft.id, draftMessageId: draft.messageId };
      });
      if (!ok) break;
    } else {
      results.push({ action: action.type, outcome: "noop" });
    }
  }
  return results;
};
