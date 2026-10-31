import type { ModelSelection, ServerProvider } from "@t3tools/contracts";

/** 32-bit FNV-1a, as 8 hex digits. Not secret: it only has to repeat for the same input. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * The id of one spawn card. A retry of the same call gets the same id, so it joins the open
 * card instead of making a second one. Without a `clientRequestId` the task text stands in.
 */
export function spawnApprovalId(input: {
  readonly threadId: string;
  readonly clientRequestId: string | undefined;
  readonly task: string;
  readonly instanceId: string;
  readonly model: string;
}): string {
  const call =
    input.clientRequestId ?? fnv1a(`${input.instanceId}\u0000${input.model}\u0000${input.task}`);
  return `spawn:${input.threadId}:${call}`;
}

/** The effort option of a model selection, such as "high", or undefined when it has none. */
export function modelSelectionEffort(selection: ModelSelection): string | undefined {
  const option = selection.options?.find((entry) => /effort/i.test(entry.id));
  return option === undefined ? undefined : String(option.value);
}

/** "5-hour 41% used, weekly 40% used", or undefined when the account reports no windows. */
export function describeAccountUsage(provider: ServerProvider | undefined): string | undefined {
  const windows = provider?.usageLimits?.windows ?? [];
  if (windows.length === 0) return undefined;
  return windows
    .map((window) => `${window.label} ${Math.round(window.usedPercent)}% used`)
    .join(", ");
}
