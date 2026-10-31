import type { ContentSyncResult } from "@t3tools/contracts";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

/** The result, or the server's own words when Sync did not run. */
export type SyncFn = () => Promise<ContentSyncResult | string>;

const OK = new Set(["synced", "pushed", "pulled"]);

/** What a Sync result means, in plain words. `ok` is false when a person must act. */
export function syncMessage(result: ContentSyncResult): { readonly ok: boolean; text: string } {
  const ok = OK.has(result.state);
  switch (result.state) {
    case "synced":
      return { ok, text: "Already up to date." };
    case "pushed":
      return { ok, text: "Sent your changes to the shared copy." };
    case "pulled":
      return { ok, text: "Got new changes from the shared copy." };
    case "conflict":
      return {
        ok,
        text: `Both of you changed the same lines in ${result.conflicts.join(", ") || "a file"}. Both versions are kept. Ask the other person to look at it.`,
      };
    case "merging":
      return { ok, text: "A merge is open in this folder. Finish it first." };
    case "locked":
      return {
        ok,
        text: "The shared copy refused you. Check that you are signed in to GitHub and have access.",
      };
    case "offline":
      return {
        ok,
        text: "You are offline. Your changes stay on this computer. Try Sync again when you are online.",
      };
    default:
      return {
        ok,
        text: result.detail ? `Sync failed: ${result.detail}` : "Sync failed. Try again.",
      };
  }
}

/** Shares the deal files with the other computer. The caller shows it only to a person who may write. */
export function SyncButton(props: { readonly busy: boolean; readonly onSync: () => void }) {
  return (
    <Button size="sm" variant="outline" disabled={props.busy} onClick={props.onSync}>
      <RefreshCwIcon />
      Sync
    </Button>
  );
}
