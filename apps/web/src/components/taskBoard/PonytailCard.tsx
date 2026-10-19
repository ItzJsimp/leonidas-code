import { ScissorsIcon } from "lucide-react";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { ponytailUsageQuery } from "~/state/taskBoard";

const PROVIDER_LABELS: Record<string, string> = {
  claudeAgent: "Claude",
  codex: "Codex",
  antigravity: "Gemini (Antigravity)",
};

const usd = (n: number) => `$${n.toFixed(2)}`;
const mins = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)} min`;
const tokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : `${n}`);

/** Shows whether Ponytail is on, what it logged, and an estimate of what it saved at benchmark rates. */
export function PonytailCard() {
  const environmentId = usePrimaryEnvironmentId();
  const { data, error } = useEnvironmentQuery(
    environmentId ? ponytailUsageQuery({ environmentId, input: {} }) : null,
  );
  const on = data?.accounts.filter((a) => a.enabled).length ?? 0;

  return (
    <section
      aria-label="Ponytail"
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <ScissorsIcon aria-hidden className="size-4 text-muted-foreground" />
        Ponytail
      </h2>
      {data === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {error ? "Ponytail numbers are not available now. Try again later." : "Loading..."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Rules active for every provider. Cost is logged for Claude with the plugin on; other
            providers show turns, time and tokens. Plugin on in {on} of {data.accounts.length}{" "}
            Claude {data.accounts.length === 1 ? "account" : "accounts"}.
          </p>
          {data.providers.length > 0 ? (
            <div>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                Last 30 days, every provider
              </h3>
              <ul className="flex flex-col divide-y divide-border">
                {data.providers.map((p) => (
                  <li
                    key={p.provider}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                  >
                    <span>{PROVIDER_LABELS[p.provider] ?? p.provider}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {p.turns} {p.turns === 1 ? "turn" : "turns"} · {mins(p.agentMinutes)} ·{" "}
                      {tokens(p.outputTokens)} out · {tokens(p.inputTokens)} in (
                      {tokens(p.cachedInputTokens)} cached)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.tasks === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks logged yet. The log fills after a Claude task with the plugin on.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Tasks logged" value={`${data.tasks}`} />
                <Stat label="Cost" value={usd(data.costUsd)} />
                <Stat label="Agent time" value={mins(data.agentMinutes)} />
                <Stat label="Output" value={`${tokens(data.outputTokens)} tokens`} />
              </dl>
              <p className="text-sm">
                <span className="text-muted-foreground">Estimated saved at benchmark rates: </span>
                <span className="font-medium tabular-nums">
                  {usd(data.estimatedSaved.costUsd)} · {mins(data.estimatedSaved.agentMinutes)} ·{" "}
                  {tokens(data.estimatedSaved.outputTokens)} tokens
                </span>
              </p>
              <ul className="flex flex-col divide-y divide-border">
                {data.recent.map((t) => (
                  <li
                    key={`${t.started}-${t.name}`}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate">{t.name || "Untitled task"}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {t.started.slice(5)} · {usd(t.costUsd)} · {mins(t.agentMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Savings are an estimate from the published Ponytail benchmark (26% less cost, 41%
                less time, 45% fewer output tokens), not a measurement of your tasks.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Stat(props: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className="text-sm font-medium tabular-nums">{props.value}</dd>
    </div>
  );
}
