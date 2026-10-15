export type ThreadAction = "attach" | "approve" | "stop";

const THREAD_ACTION_EVENT = "leonidas:thread-action";

/** Lets the command palette trigger composer and run actions that live in the chat view. */
export function requestThreadAction(action: ThreadAction): void {
  window.dispatchEvent(new CustomEvent<ThreadAction>(THREAD_ACTION_EVENT, { detail: action }));
}

export function subscribeThreadAction(listener: (action: ThreadAction) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<ThreadAction>).detail);
  window.addEventListener(THREAD_ACTION_EVENT, handler);
  return () => window.removeEventListener(THREAD_ACTION_EVENT, handler);
}
