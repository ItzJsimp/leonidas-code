import {
  type OrchestrationV2LimitRecovery,
  type OrchestrationV2LimitRecoveryUpdate,
  type RunId,
} from "@t3tools/contracts";
import { ChevronDownIcon, GaugeIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  continueWithProvider,
  createTargetForModel,
  type ProviderFailoverTarget,
} from "./providerFailover";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/group";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";

type RecoveryProps = {
  runId: RunId;
  resetAt: string | null;
  stoppedAt: string;
  snoozedUntil: string | null;
  recovery: OrchestrationV2LimitRecovery | null;
  onChange: (recovery: OrchestrationV2LimitRecoveryUpdate) => Promise<void>;
  failoverTargets: ReadonlyArray<ProviderFailoverTarget>;
  failoverDisabled: boolean;
  /** The thread can switch providers but no other subscription is ready, so say why there is no button. */
  failoverUnavailable: boolean;
  onFailover: (target: ProviderFailoverTarget) => Promise<void>;
};

export function usageLimitRecoveryBannerItem(props: RecoveryProps): ComposerBannerStackItem {
  const { runId, resetAt, stoppedAt } = props;
  const canSchedule = resetAt !== null && Date.parse(resetAt) > Date.parse(stoppedAt);
  return {
    id: `usage-limit-recovery:${runId}`,
    variant: "warning",
    priority: "urgent",
    icon: <GaugeIcon />,
    title: "You used all of your AI account limit",
    description:
      (resetAt
        ? `Resets ${new Date(resetAt).toLocaleString()}`
        : "The reset time is not known. Try again later.") +
      (props.failoverUnavailable ? ". No other AI account is ready to take over." : ""),
    actions: <RecoveryActions key={`${runId}:${resetAt}`} {...props} canSchedule={canSchedule} />,
  };
}

function RecoveryActions(props: RecoveryProps & { canSchedule: boolean }) {
  const {
    runId,
    resetAt,
    recovery,
    snoozedUntil,
    onChange,
    canSchedule,
    failoverTargets,
    failoverDisabled,
  } = props;
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  async function continueWith(target: ProviderFailoverTarget, modelSlug?: string) {
    if (pendingRef.current) return;
    setPending(true);
    setError(null);
    try {
      const selectedTarget = modelSlug ? createTargetForModel(target, modelSlug) : target;
      await continueWithProvider({
        pending: pendingRef,
        targets: failoverDisabled ? [] : failoverTargets,
        target: selectedTarget,
        continueWith: props.onFailover,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not switch AI accounts. Try again.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  useEffect(() => {
    const delay = Date.parse(resetAt ?? "") - Math.max(nowMs, Date.now());
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = window.setTimeout(() => setNowMs(Date.now()), Math.min(delay + 1, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [resetAt, nowMs]);

  const scheduled =
    recovery?.runId === runId && recovery.resetAt === resetAt && recovery.autoResume;
  const snoozed =
    recovery?.snooze === true &&
    recovery.runId === runId &&
    recovery.resetAt === resetAt &&
    resetAt !== null &&
    snoozedUntil !== null &&
    Date.parse(snoozedUntil) === Date.parse(resetAt);

  async function toggle(action: "resume" | "snooze") {
    if (resetAt === null || pendingRef.current) return;
    if (action === "snooze" && !snoozed && Date.parse(resetAt) <= Date.now()) {
      setError("The reset time has passed. Send your message again.");
      setNowMs(Date.now());
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onChange({
        runId,
        resetAt,
        ...(action === "resume" ? { autoResume: !scheduled } : { snooze: !snoozed }),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this choice. Try again.");
    }
    pendingRef.current = false;
    setPending(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {failoverTargets.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          No other AI account is ready. Add one in Settings.
        </span>
      ) : (
        failoverTargets.map((target) => {
          const hasMultipleModels = target.availableModels.length > 1;
          const currentModelName =
            target.availableModels.find((m) => m.slug === target.modelSelection.model)?.name ??
            target.modelSelection.model;
          return (
            <ButtonGroup key={target.instanceId}>
              <Button
                size="xs"
                variant="ghost"
                disabled={pending || failoverDisabled}
                onClick={() => void continueWith(target)}
                title={`Continue in this chat using ${currentModelName} on ${target.label} and the chat history`}
              >
                {pending ? "Starting..." : `Continue with ${target.label}`}
              </Button>
              {hasMultipleModels ? (
                <Menu>
                  <MenuTrigger
                    render={
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={pending || failoverDisabled}
                        aria-label={`Choose model for ${target.label}`}
                        title={`Choose model for ${target.label}`}
                      />
                    }
                  >
                    <ChevronDownIcon className="size-3" />
                  </MenuTrigger>
                  <MenuPopup align="start" className="min-w-44">
                    <div className="px-2 py-1 text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Models for {target.label}
                    </div>
                    {target.availableModels.map((model) => (
                      <MenuItem
                        key={model.slug}
                        onClick={() => void continueWith(target, model.slug)}
                      >
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="truncate">{model.name}</span>
                          {model.slug === target.modelSelection.model ? (
                            <span className="shrink-0 text-3xs font-medium text-muted-foreground">
                              Default
                            </span>
                          ) : null}
                        </span>
                      </MenuItem>
                    ))}
                  </MenuPopup>
                </Menu>
              ) : null}
            </ButtonGroup>
          );
        })
      )}
      {canSchedule ? (
        <Button size="xs" variant="ghost" disabled={pending} onClick={() => void toggle("resume")}>
          {pending
            ? "Saving..."
            : scheduled
              ? "Cancel automatic restart"
              : "Restart when the limit resets"}
        </Button>
      ) : null}
      {canSchedule && !snoozed ? (
        <Button
          size="xs"
          variant="ghost"
          disabled={pending || Date.parse(resetAt!) <= nowMs}
          onClick={() => void toggle("snooze")}
        >
          {pending ? "Saving..." : "Wait until the limit resets"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="basis-full text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
