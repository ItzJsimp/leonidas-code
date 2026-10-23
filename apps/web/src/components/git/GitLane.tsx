import { useState, type ReactNode } from "react";

import { cn } from "~/lib/utils";
import type { GitLane as GitLaneModel, LaneStep, WordsMode } from "./gitLane.logic";

/**
 * The three-step Git lane (Working files, Saved, On GitHub). Shared on purpose: the
 * dashboard list uses it now and a per-project panel can mount it later.
 */
export function GitLane(props: {
  readonly lane: GitLaneModel;
  readonly mode: WordsMode;
  readonly onConnectGitHub?: () => void;
  /** Optional per-step controls, shown under the step's explainer. */
  readonly renderActions?: (stepId: LaneStep["id"]) => ReactNode;
}) {
  const [openId, setOpenId] = useState<LaneStep["id"] | null>(null);
  const open = props.lane.steps.find((step) => step.id === openId) ?? null;
  return (
    <div className="@container">
      <ol className="flex flex-col gap-2 @3xl:flex-row @3xl:items-stretch @3xl:gap-0">
        {props.lane.steps.map((step, index) => (
          <li
            key={step.id}
            className="flex min-w-0 flex-1 flex-col @3xl:flex-row @3xl:items-stretch"
          >
            {index > 0 ? (
              <span
                aria-hidden
                className="mx-auto h-3 w-px bg-border @3xl:mx-0 @3xl:my-auto @3xl:h-px @3xl:w-4 @3xl:shrink-0"
              />
            ) : null}
            <StepButton
              step={step}
              index={index}
              mode={props.mode}
              expanded={openId === step.id}
              onToggle={() => setOpenId(openId === step.id ? null : step.id)}
            />
          </li>
        ))}
        {props.lane.connectGitHub ? (
          <li className="flex min-w-0 flex-1 flex-col @3xl:flex-row @3xl:items-stretch">
            <span
              aria-hidden
              className="mx-auto h-3 w-px border-l border-dashed border-border @3xl:mx-0 @3xl:my-auto @3xl:h-px @3xl:w-4 @3xl:shrink-0 @3xl:border-t @3xl:border-l-0"
            />
            <button
              type="button"
              disabled={props.onConnectGitHub === undefined}
              onClick={props.onConnectGitHub}
              className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-muted-foreground disabled:cursor-not-allowed"
            >
              <span className="text-sm font-medium">Connect GitHub</span>
              <span className="text-xs">Keep a copy online. Coming soon.</span>
            </button>
          </li>
        ) : null}
      </ol>
      {open ? (
        <div className="mt-2 rounded-lg bg-muted/60 px-3 py-2">
          <p
            id={`git-lane-explainer-${open.id}`}
            role="status"
            className="text-sm text-muted-foreground"
          >
            {open.explainer}
          </p>
          {props.renderActions?.(open.id)}
        </div>
      ) : null}
    </div>
  );
}

function StepButton(props: {
  readonly step: LaneStep;
  readonly index: number;
  readonly mode: WordsMode;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const { step } = props;
  const beginner = props.mode === "beginner";
  const title = beginner ? step.plainTerm : step.gitTerm;
  const subtitle = beginner && step.plainTerm !== step.gitTerm ? step.gitTerm : null;
  const hasWork = (step.count ?? 0) > 0;
  return (
    <button
      type="button"
      aria-expanded={props.expanded}
      aria-controls={`git-lane-explainer-${step.id}`}
      onClick={props.onToggle}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring",
        props.expanded && "border-primary/50",
      )}
    >
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
      >
        {props.index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium break-words">{title}</span>
        {subtitle ? (
          <span className="block text-xs break-words text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            "block text-lg leading-none font-semibold tabular-nums",
            hasWork ? "text-warning-foreground" : "text-muted-foreground",
          )}
        >
          {step.count ?? "-"}
        </span>
        <span className="block text-2xs text-muted-foreground">{step.countLabel}</span>
      </span>
    </button>
  );
}
