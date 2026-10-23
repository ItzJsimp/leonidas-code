import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { ScribeHistoryItem } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { CopyIcon, MicIcon, SquareIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useEnvironmentQuery } from "~/state/query";
import { scribeHistoryQuery, scribeStart, scribeStop } from "~/state/scribe";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { commandErrorMessage, dictateButton, rowMeta, shouldRetryHistory } from "./home.logic";
import type { ScribeTabProps } from "./ScribePage";
import { mergeRecent } from "./scribeLive.logic";

export function ScribeHomeTab({ environmentId, live }: ScribeTabProps) {
  const history = useEnvironmentQuery(scribeHistoryQuery({ environmentId, input: { limit: 20 } }));
  const loaded = history.data?.items;
  const items = useMemo(() => mergeRecent(live.saved, loaded ?? []), [live.saved, loaded]);
  const previousConnected = useRef(live.connected);
  const historyFailed = history.error !== null;
  const { refresh } = history;
  useEffect(() => {
    if (shouldRetryHistory(previousConnected.current, live.connected, historyFailed)) refresh();
    previousConnected.current = live.connected;
  }, [live.connected, historyFailed, refresh]);
  return (
    <div className="flex flex-col gap-5">
      <DictateCard environmentId={environmentId} live={live} />
      {live.connected === false ? null : (
        <section aria-labelledby="scribe-recent" className="flex flex-col gap-2">
          <h2 id="scribe-recent" className="text-sm font-medium">
            Recent dictations
          </h2>
          <RecentList
            items={items}
            loading={history.data === null && history.error === null}
            failed={history.error !== null && items.length === 0}
            onRetry={history.refresh}
          />
        </section>
      )}
    </div>
  );
}

function DictateCard({ environmentId, live }: ScribeTabProps) {
  const runStart = useAtomCommand(scribeStart, { reportFailure: false });
  const runStop = useAtomCommand(scribeStop, { reportFailure: false });
  const canStart = useAtomValue(scribeStart.permissionAtom(environmentId));
  const canStop = useAtomValue(scribeStop.permissionAtom(environmentId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const button = dictateButton(live.connected, live.state);
  const allowed = button.action === "stop" ? canStop : canStart;

  const press = async () => {
    if (busy || button.action === "none") return;
    setBusy(true);
    setError(null);
    const result =
      button.action === "start"
        ? await runStart({ environmentId, input: { mode: "toggle" } })
        : await runStop({ environmentId, input: { paste: false } });
    setBusy(false);
    if (result._tag !== "Success" && !isAtomCommandInterrupted(result)) {
      setError(commandErrorMessage(squashAtomCommandFailure(result)));
    }
  };

  const message = live.connected === false ? "Scribe engine is not running." : error;
  return (
    <section
      aria-label="Dictate"
      className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5"
    >
      <Button
        size="xl"
        variant={button.action === "stop" ? "destructive" : "default"}
        disabled={button.disabled || busy || !allowed}
        onClick={() => void press()}
      >
        {button.action === "stop" ? <SquareIcon aria-hidden /> : <MicIcon aria-hidden />}
        {button.label}
      </Button>
      {message ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {live.lastError ? (
        <div role="alert" className="text-sm">
          <p className="font-medium">Microphone problem</p>
          <p className="text-muted-foreground">{live.lastError.message}</p>
        </div>
      ) : null}
      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {live.state === "listening" ? live.partial : live.lastTranscript}
      </p>
    </section>
  );
}

function RecentList(props: {
  readonly items: readonly ScribeHistoryItem[];
  readonly loading: boolean;
  readonly failed: boolean;
  readonly onRetry: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (props.items.length === 0 && props.loading) {
    return (
      <div
        className="flex flex-col gap-2"
        role="status"
        aria-busy="true"
        aria-label="Loading dictations"
      >
        {[0, 1, 2].map((key) => (
          <div key={key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }
  if (props.failed) {
    return (
      <div className="flex flex-col items-start gap-2 text-sm">
        <p>Could not load your dictations.</p>
        <Button size="sm" variant="outline" onClick={props.onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (props.items.length === 0) {
    return (
      <div className="text-sm">
        <p>No dictations yet.</p>
        <p className="text-muted-foreground">Press Start, speak, then press Stop.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {props.items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3 text-sm">{item.cleanedText}</p>
            <p className="mt-1 text-xs text-muted-foreground">{rowMeta(item, now)}</p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Copy dictation"
            onClick={() => void navigator.clipboard.writeText(item.cleanedText)}
          >
            <CopyIcon aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}
