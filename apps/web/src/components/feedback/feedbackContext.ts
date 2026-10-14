/**
 * What the app knew when a report was started: the open chat's provider and model, and the most
 * recent error. Plain module state, written by ChatView and the error banner and read once on
 * submit, so recording it never re-renders anything.
 */
let activeModel: { readonly provider: string; readonly model: string | null } | null = null;
let lastError: { readonly text: string; readonly at: number } | null = null;

export function setFeedbackActiveModel(next: typeof activeModel): void {
  activeModel = next;
}

export function getFeedbackActiveModel(): typeof activeModel {
  return activeModel;
}

export function recordFeedbackError(text: string): void {
  lastError = { text, at: Date.now() };
}

export function getFeedbackLastError(): typeof lastError {
  return lastError;
}

/** Uncaught errors count as "last error" too; installed once by the feedback host. */
export function installFeedbackErrorCapture(): () => void {
  const onError = (event: ErrorEvent) => recordFeedbackError(event.message);
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    recordFeedbackError(reason instanceof Error ? reason.message : String(reason));
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
