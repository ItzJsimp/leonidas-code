import type { LaneStatus, WordsMode } from "./gitLane.logic";

export type ActionGate =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

export type SendGate =
  | { readonly allowed: true; readonly confirmMain: boolean }
  | { readonly allowed: false; readonly reason: string };

const WAITING = {
  allowed: false as const,
  reason: "Still checking this folder. Try again in a moment.",
};

function fileCount(status: LaneStatus): string {
  const count = status.workingTree.files.length;
  return count === 1 ? "1 file has" : `${count} files have`;
}

/** Save (commit) needs at least one changed file. */
export function saveGate(status: LaneStatus | null): ActionGate {
  if (status === null) return WAITING;
  if (!status.hasWorkingTreeChanges) {
    return { allowed: false, reason: "Nothing to save. No files have changed." };
  }
  return { allowed: true };
}

/** Send (push) needs a remote, a branch, saved work to send, and no newer work online. */
export function sendGate(status: LaneStatus | null): SendGate {
  if (status === null) return WAITING;
  if (!status.hasPrimaryRemote) {
    return { allowed: false, reason: "This project is not on GitHub yet. Connect GitHub first." };
  }
  if (status.refName === null) {
    return {
      allowed: false,
      reason: "This folder is not on a branch, so there is nothing to send.",
    };
  }
  const behind = status.behindCount ?? 0;
  if (behind > 0) {
    const saves = behind === 1 ? "1 newer save" : `${behind} newer saves`;
    return { allowed: false, reason: `GitHub has ${saves}. Get latest first, then send.` };
  }
  // A branch with no upstream has never been sent, so its first send always counts.
  if (status.hasUpstream && (status.aheadCount ?? 0) === 0) {
    return { allowed: false, reason: "Everything you saved is already online." };
  }
  return { allowed: true, confirmMain: status.isDefaultRef };
}

/** Get latest (pull) runs only on a clean folder, so it can never touch unsaved edits. */
export function getLatestGate(status: LaneStatus | null): ActionGate {
  if (status === null) return WAITING;
  if (!status.hasPrimaryRemote || !status.hasUpstream) {
    return { allowed: false, reason: "There is no online copy of this branch to get from." };
  }
  if (status.hasWorkingTreeChanges) {
    return {
      allowed: false,
      reason: `${fileCount(status)} changes that are not saved. Save them first, so nothing is lost.`,
    };
  }
  if ((status.behindCount ?? 0) === 0) {
    return { allowed: false, reason: "You already have the latest." };
  }
  return { allowed: true };
}

export interface ActionLabels {
  readonly save: string;
  readonly send: string;
  readonly getLatest: string;
  readonly saveHelp: string;
  readonly sendHelp: string;
  readonly getLatestHelp: string;
}

/** Beginner shows plain words. Advanced shows the Git verb. Each has a one-line help. */
export function actionLabels(mode: WordsMode): ActionLabels {
  const help = {
    saveHelp: "Saves a snapshot of your changed files. You can go back to it later.",
    sendHelp: "Puts your saved snapshots online so others and your backups have them.",
    getLatestHelp: "Brings in newer saves from online. Runs only when nothing is unsaved.",
  };
  return mode === "beginner"
    ? { save: "Save", send: "Send to GitHub", getLatest: "Get latest", ...help }
    : { save: "Commit", send: "Push", getLatest: "Pull", ...help };
}
