import * as Effect from "effect/Effect";
import * as ClientTracer from "../../observability/clientTracer";
import { useEffect, useEffectEvent, useState, useRef, useMemo } from "react";
import {
  cacheActionImpact,
  cacheStatus,
  collectExpiryNotices,
  type CacheImpact,
  type CacheObservation,
} from "@t3tools/client-runtime/cache-awareness";
import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import {
  cacheClock,
  isCacheSessionSnoozed,
  observeCacheChat,
  recentCacheChats,
  setCacheSessionSnooze,
  useCacheClock,
} from "../../lib/cacheAwarenessStore";
import type { ModelSelection } from "@t3tools/contracts";
import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import { formatContextWindowTokens } from "../../lib/contextWindow";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { composerFloatingLayerProps } from "./composerEventScope";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "../ui/alert-dialog";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "../ui/select";

export function cacheObservation(usage: ContextWindowSnapshot | null): CacheObservation | null {
  return usage
    ? {
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        reportedAt: Date.parse(usage.updatedAt),
        ttlMs: usage.promptCacheTtlMs,
        anchorAt: usage.promptCacheAnchorAt ? Date.parse(usage.promptCacheAnchorAt) : undefined,
      }
    : null;
}

export function CacheNoticeControls() {
  const settings = useClientSettings();
  const update = useUpdateClientSettings();
  const now = useCacheClock();
  const paused = isCacheSessionSnoozed() || settings.cacheNoticesSnoozedUntil > now;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={paused ? "paused" : "on"}
        onValueChange={(value) => {
          if (value === "paused" || value === null) return;
          setCacheSessionSnooze(value === "restart");
          void update({
            cacheNoticesSnoozedUntil:
              value === "1h"
                ? Date.now() + 3_600_000
                : value === "4h"
                  ? Date.now() + 14_400_000
                  : 0,
          });
        }}
      >
        <SelectTrigger size="sm" aria-label="Snooze cache expiry notices">
          <SelectValue>{paused ? "Expiry notices paused" : "Pause expiry notices"}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="on">Resume notices</SelectItem>
          <SelectItem value="1h">Pause for 1 hour</SelectItem>
          <SelectItem value="4h">Pause for 4 hours</SelectItem>
          <SelectItem value="restart">Pause until app restart</SelectItem>
        </SelectPopup>
      </Select>
      {!settings.cacheMutedWarnings.includes("expiry") ? (
        <Button
          size="xs"
          variant="ghost"
          onClick={() =>
            void update({ cacheMutedWarnings: [...settings.cacheMutedWarnings, "expiry"] })
          }
        >
          Don't remind again
        </Button>
      ) : null}
    </div>
  );
}

/** One bounded registry and one clock for all recently viewed chats. No provider requests. */
export function CacheNoticeCoordinator() {
  const settings = useClientSettings();
  const update = useUpdateClientSettings();
  const check = useEffectEvent(() => {
    const now = Date.now();
    cacheClock.tick(now);
    for (const [key, record] of recentCacheChats) {
      if (now - record.lastViewedAt > 3_600_000) recentCacheChats.delete(key);
    }
    if (settings.cacheMutedWarnings.includes("expiry") || isCacheSessionSnoozed()) return;
    const due = collectExpiryNotices(
      [...recentCacheChats.values()],
      now,
      settings.cacheNoticesSnoozedUntil,
    );
    if (!due.length) return;
    for (const record of due)
      recentCacheChats.set(record.key, {
        ...record,
        notifiedCycle: record.observation.anchorAt ?? null,
      });
    toastManager.add({
      id: "cache-expiry",
      type: "info",
      title:
        due.length === 1
          ? "A recent chat may need its cache rebuilt soon"
          : `${due.length} recent chats may need their caches rebuilt soon`,
      description:
        "Estimated cache time is low. You can leave these chats idle. A later request may cost more.",
      data: {
        hideCopyButton: true,
        expandableContent: <CacheNoticeControls />,
        expandableLabels: { expand: "Pause or mute", collapse: "Hide controls" },
      },
      actionProps: {
        children: "Pause 1 hour",
        onClick: () => {
          void update({ cacheNoticesSnoozedUntil: Date.now() + 3_600_000 });
          toastManager.close("cache-expiry");
        },
      },
    });
  });
  useEffect(() => {
    const timer = window.setInterval(() => {
      Effect.runSync(
        Effect.sync(check).pipe(
          Effect.withSpan("web.cache.notice-check"),
          Effect.provide(ClientTracer.layer),
        ),
      );
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}

export function useCacheActionWarning() {
  const settings = useClientSettings();
  const update = useUpdateClientSettings();
  const [pending, setPending] = useState<{ impact: CacheImpact; action: () => void } | null>(null);
  const [mute, setMute] = useState(false);
  function run(impact: CacheImpact | null, action: () => void) {
    if (!impact || settings.cacheMutedWarnings.includes(impact.category)) {
      action();
      return;
    }
    if (!impact.confirmed) {
      toastManager.add({
        type: "info",
        title: "Cache reuse may change",
        description: impact.message,
        actionProps: {
          children: "Don't remind again",
          onClick: () =>
            void update({ cacheMutedWarnings: [...settings.cacheMutedWarnings, impact.category] }),
        },
      });
      action();
      return;
    }
    setMute(false);
    setPending({ impact, action });
  }
  const dialog = (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Continue with this cache change?</AlertDialogTitle>
          <AlertDialogDescription>{pending?.impact.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-2 px-1 text-sm">
          <Checkbox checked={mute} onCheckedChange={(value) => setMute(value === true)} />
          Don't remind me about this warning type again
        </label>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!pending) return;
              const { impact, action } = pending;
              setPending(null);
              if (mute)
                void update({
                  cacheMutedWarnings: [...settings.cacheMutedWarnings, impact.category],
                });
              action();
            }}
          >
            Continue
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
  return { run, dialog };
}

export function useCacheAwareness({
  usage,
  chatKey,
}: {
  usage: ContextWindowSnapshot | null;
  chatKey?: string | undefined;
}) {
  const now = useCacheClock();
  const observation = useMemo(() => cacheObservation(usage), [usage]);
  const status = cacheStatus(observation, now);
  const previousRef = useRef<{
    key: string | undefined;
    rate: number | null;
    report: string | undefined;
  } | null>(null);
  const settings = useClientSettings();
  const update = useUpdateClientSettings();
  useEffect(() => {
    if (chatKey && observation) observeCacheChat(chatKey, observation, now);
  }, [chatKey, observation, now]);
  useEffect(() => {
    const previous = previousRef.current;
    if (previous?.report === usage?.updatedAt && previous?.key === chatKey) return;
    if (
      previous?.key === chatKey &&
      previous?.rate != null &&
      status.readRate != null &&
      previous.rate >= 0.5 &&
      previous.rate - status.readRate >= 0.4 &&
      (usage?.inputTokens ?? 0) >= 5_000 &&
      !settings.cacheMutedWarnings.includes("reuse-drop")
    ) {
      toastManager.add({
        id: "cache-reuse-drop",
        type: "info",
        title: "Cache reuse fell",
        description:
          "The connection reported fewer saved reads. Expiry, settings, or routing can cause this. The cause is not confirmed.",
        actionProps: {
          children: "Don't remind again",
          onClick: () =>
            void update({ cacheMutedWarnings: [...settings.cacheMutedWarnings, "reuse-drop"] }),
        },
      });
    }
    previousRef.current = { key: chatKey, rate: status.readRate, report: usage?.updatedAt };
  }, [
    chatKey,
    usage?.updatedAt,
    status.readRate,
    settings.cacheMutedWarnings,
    usage?.inputTokens,
    update,
  ]);
  return status;
}

export function CacheStatusDetails({ usage }: { usage: ContextWindowSnapshot | null }) {
  const status = cacheStatus(cacheObservation(usage), useCacheClock());
  return (
    <div className="grid gap-2 border-t border-border pt-2 text-xs">
      <strong>Prompt cache</strong>
      <p>{cacheStatusLabel(status)}</p>
      <p>
        {status.readRate === null
          ? "Cache reads were not reported."
          : `${Math.round(status.readRate * 100)}% of reported input came from cache (${formatContextWindowTokens(usage?.cachedInputTokens ?? null)} tokens).`}
      </p>
      <p className="text-muted-foreground">
        Expiry does not erase your chat. A later request may need to rebuild the cache.
      </p>
      {status.remainingMs === null ? (
        <p className="text-muted-foreground">
          This connection does not report enough timing data for a countdown.
        </p>
      ) : null}
      <p className="text-muted-foreground">
        The provider reuses an identical start of a request. Model, account, instructions, tools,
        effort, and history changes can affect reuse.
      </p>
      <p className="text-muted-foreground">
        Timing uses a conservative turn-start estimate when available. Tool requests can refresh
        caches later. A countdown cannot guarantee reuse.
      </p>
      <p className="text-muted-foreground">
        OpenRouter reuse also depends on its route. Cache prices are not reported here, so costs
        stay in tokens.
      </p>
      <CacheNoticeControls />
    </div>
  );
}

export function cacheStatusLabel(status: ReturnType<typeof cacheStatus>) {
  if (status.state === "estimated")
    return `Cache: ~${Math.ceil((status.remainingMs ?? 0) / 60_000)}m left`;
  if (status.state === "possibly-expired") return "Cache: may have expired";
  if (status.state === "reported") return "Cache: reuse reported";
  if (status.state === "no-reuse") return "Cache: no reuse reported";
  return "Cache: unknown";
}

export function CacheConfigurationNotice({
  from,
  to,
  hasReusableContext,
}: {
  from: ModelSelection | null | undefined;
  to: ModelSelection;
  hasReusableContext: boolean;
}) {
  const muted = useClientSettings((s) => s.cacheMutedWarnings);
  const update = useUpdateClientSettings();
  const impact = cacheActionImpact(from, to, hasReusableContext);
  if (!impact || impact.confirmed || muted.includes(impact.category)) return null;
  return (
    <div
      className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-muted-foreground"
      role="status"
    >
      <span>{impact.message}</span>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => void update({ cacheMutedWarnings: [...muted, impact.category] })}
      >
        Don't remind again
      </Button>
    </div>
  );
}

export function CacheStatusChip({
  usage,
  status,
}: {
  usage: ContextWindowSnapshot | null;
  status: ReturnType<typeof cacheStatus>;
}) {
  const label = cacheStatusLabel(status);
  const text =
    status.state === "estimated"
      ? `Cache ~${Math.ceil((status.remainingMs ?? 0) / 60_000)}m`
      : status.state === "possibly-expired"
        ? "Cache ?"
        : status.readRate !== null
          ? `Cache ${Math.round(status.readRate * 100)}%`
          : "Cache --";
  const color =
    status.state === "possibly-expired"
      ? "var(--color-destructive)"
      : status.remainingMs !== null && status.remainingMs <= 10 * 60_000
        ? "var(--color-warning)"
        : undefined;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="compact"
            variant="ghost-muted"
            aria-label={`${label}. Show cache details`}
          />
        }
      >
        <span className="text-2xs tabular-nums" style={{ color }}>
          {text}
        </span>
      </PopoverTrigger>
      <PopoverPopup {...composerFloatingLayerProps} width="md" side="top" align="end">
        <CacheStatusDetails usage={usage} />
      </PopoverPopup>
    </Popover>
  );
}
