import type { AiLevel, VcsStatusLocalResult, VcsStatusRemoteResult } from "@t3tools/contracts";

/** The slice of the live VCS status the lane needs. Remote fields may be absent. */
export type LaneStatus = Pick<
  VcsStatusLocalResult,
  "isRepo" | "hasPrimaryRemote" | "isDefaultRef" | "refName" | "hasWorkingTreeChanges"
> & {
  readonly workingTree: { readonly files: ReadonlyArray<unknown> };
  readonly sourceControlProvider?: { readonly name: string } | undefined;
} & Partial<Pick<VcsStatusRemoteResult, "hasUpstream" | "aheadCount" | "behindCount">>;

export type LaneStepId = "working" | "saved" | "github";

export interface LaneStep {
  readonly id: LaneStepId;
  /** The real Git term. Always shown. */
  readonly gitTerm: string;
  /** Plain-word label for new users. */
  readonly plainTerm: string;
  /** One line shown when the step opens. */
  readonly explainer: string;
  /** Null when the number is unknown (for example, no upstream branch yet). */
  readonly count: number | null;
  /** What the count measures, as a short noun phrase. */
  readonly countLabel: string;
}

export interface GitLane {
  readonly steps: ReadonlyArray<LaneStep>;
  readonly connectGitHub: boolean;
}

export function buildLane(status: LaneStatus): GitLane {
  if (!status.isRepo) return { steps: [], connectGitHub: false };
  const remoteName = status.sourceControlProvider?.name ?? "GitHub";
  const steps: LaneStep[] = [
    {
      id: "working",
      gitTerm: "Working files",
      plainTerm: "Your files",
      explainer: "The files in your folder right now, including edits that are not saved yet.",
      count: status.workingTree.files.length,
      countLabel: "changed files",
    },
    {
      id: "saved",
      gitTerm: "Commits",
      plainTerm: "Saved",
      explainer: "Saved snapshots of your work. Each one is a point you can go back to.",
      count: status.hasUpstream ? (status.aheadCount ?? 0) : null,
      countLabel: "not sent yet",
    },
  ];
  if (!status.hasPrimaryRemote) return { steps, connectGitHub: true };
  steps.push({
    id: "github",
    gitTerm: `On ${remoteName}`,
    plainTerm: `On ${remoteName}`,
    explainer: `The copy of your project online. Teammates and backups use this copy.`,
    count: status.hasUpstream ? (status.behindCount ?? 0) : null,
    countLabel: "not received yet",
  });
  return { steps, connectGitHub: false };
}

export interface MainBranchBanner {
  /** Null on a detached head. */
  readonly branch: string | null;
}

/** The banner shows when a repository folder sits on something other than its main branch. */
export function mainBranchBanner(status: LaneStatus): MainBranchBanner | null {
  if (!status.isRepo || status.isDefaultRef) return null;
  return { branch: status.refName };
}

export type BackToMainGate =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

/** "Back to main" must never carry or lose unsaved edits, so a dirty folder refuses. */
export function backToMainGate(status: LaneStatus | null): BackToMainGate {
  if (status === null) {
    return { allowed: false, reason: "Still checking this folder. Try again in a moment." };
  }
  if (!status.hasWorkingTreeChanges) return { allowed: true };
  const count = status.workingTree.files.length;
  const files = count === 1 ? "1 file has" : `${count} files have`;
  return {
    allowed: false,
    reason: `${files} changes that are not saved. Save or set them aside first, so nothing is lost.`,
  };
}

export type WordsMode = "beginner" | "advanced";

/** New and beginner users also see plain words. The switch, when set, wins. */
export function resolveWordsMode(level: AiLevel | null, override: WordsMode | null): WordsMode {
  if (override !== null) return override;
  return level === null || level === "new" || level === "beginner" ? "beginner" : "advanced";
}
