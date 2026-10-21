import { ScissorsIcon } from "lucide-react";

import type { PonytailUsage } from "@t3tools/contracts";

import { Badge } from "~/components/ui/badge";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { ponytailUsageQuery } from "~/state/taskBoard";

const DRIVER_LABELS: Record<string, string> = {
  claudeAgent: "Claude",
  codex: "Codex",
  antigravity: "Gemini (Antigravity)",
  openrouter: "OpenRouter",
};
const driverLabel = (driver: string) => DRIVER_LABELS[driver] ?? driver;

const usd = (n: number) => `$${n.toFixed(2)}`;
const mins = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)} min`;
const compact = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1)}B`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1000
        ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`
        : `${Math.round(n)}`;
const shortDate = (iso: string) => (iso ? `${iso.slice(5, 7)}-${iso.slice(8, 10)}` : "");

type Totals = PonytailUsage["providers"][number];

/** How many Claude accounts have the plugin on, in words that fit one, two or many accounts. */
function pluginSummary(accounts: PonytailUsage["accounts"]): string {
  const claude = accounts.filter((a) => a.driver === "claudeAgent");
  const on = claude.filter((a) => a.plugin === "on").length;
  if (claude.length === 0) return "Not used: you have no Claude account. The rules still apply.";
  if (claude.length === 1) return on === 1 ? "On in your Claude account." : "Not on yet.";
  if (on === claude.length) return `On in all ${claude.length} Claude accounts.`;
  return `On in ${on} of ${claude.length} Claude accounts.`;
}

function TurnCell(props: { readonly totals: Totals | undefined }) {
  const t = props.totals;
  if (!t || t.turns === 0) return <span className="text-muted-foreground">No turns</span>;
  return (
    <>
      <span className="block">{compact(t.outputTokens / t.turns)} out per turn</span>
      <span className="block text-xs text-muted-foreground">
        {mins(t.agentMinutes / t.turns)} per turn · {t.turns} {t.turns === 1 ? "turn" : "turns"}
      </span>
    </>
  );
}

/**
 * Explains what Ponytail is, where it is on for this user's own accounts, and what the ledger and
 * the app's turn records show. It never estimates a saving: that needs a baseline nobody has.
 */
export function PonytailCard() {
  const environmentId = usePrimaryEnvironmentId();
  const { data, error } = useEnvironmentQuery(
    environmentId ? ponytailUsageQuery({ environmentId, input: {} }) : null,
  );

  return (
    <section
      aria-label="Ponytail"
      className="flex flex-col gap-4 rounded-lg border border-border p-4"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <ScissorsIcon aria-hidden className="size-4 text-muted-foreground" />
            Ponytail
          </h2>
          {data ? (
            <Badge variant="success" size="sm">
              Rules on
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Tells every agent to write the smallest change that fully works, and to say what it
          skipped.
        </p>
      </header>

      {data === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {error ? "Ponytail numbers are not available now. Try again later." : "Loading..."}
        </p>
      ) : (
        <>
          <PonytailWhere data={data} />
          <PonytailCompare data={data} />
          <PonytailLedger data={data} />
        </>
      )}
    </section>
  );
}

function PonytailWhere(props: { readonly data: PonytailUsage }) {
  const { accounts } = props.data;
  const claude = accounts.filter((a) => a.driver === "claudeAgent");
  const missing = claude.some((a) => a.plugin !== "on");
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">Where it is on</h3>
      <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Rules</dt>
        <dd>
          On for all {accounts.length} {accounts.length === 1 ? "account" : "accounts"}. The app
          adds them to every agent.
        </dd>
        <dt className="text-muted-foreground">Plugin</dt>
        <dd>
          {pluginSummary(accounts)}{" "}
          <span className="text-muted-foreground">
            It adds the /ponytail commands and logs each task.
          </span>
        </dd>
      </dl>
      {missing ? (
        <p className="text-xs text-muted-foreground">
          The app installs the plugin about 30 seconds after a Claude account starts. It needs
          Node.js on your PATH.
        </p>
      ) : null}
      {accounts.length > 1 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Show {accounts.length} accounts
          </summary>
          <ul className="mt-1 flex flex-col divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-1">
                <span className="min-w-0 truncate">
                  {a.name === a.driver ? (
                    driverLabel(a.driver)
                  ) : (
                    <>
                      {a.name}{" "}
                      <span className="text-muted-foreground">· {driverLabel(a.driver)}</span>
                    </>
                  )}
                </span>
                <Badge
                  size="sm"
                  variant={
                    a.plugin === "on" ? "success" : a.plugin === "off" ? "warning" : "outline"
                  }
                >
                  {a.plugin === "on"
                    ? "Plugin on"
                    : a.plugin === "off"
                      ? "Plugin off"
                      : "Rules only"}
                </Badge>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function PonytailLedger(props: { readonly data: PonytailUsage }) {
  const { data } = props;
  if (data.tasks === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tasks logged yet. The ledger fills after a Claude task with the plugin on.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        What the plugin logged since {shortDate(data.since)}
      </h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tasks (one prompt each)" value={`${data.tasks}`} />
        <Stat
          label="Tests ran"
          value={data.testsRan === null ? "n/a" : `${data.testsRan} of ${data.tasks}`}
        />
        <Stat label="Agent time" value={mins(data.agentMinutes)} />
        <Stat label="Cost (plugin figure)" value={usd(data.costUsd)} />
      </dl>
      {data.skillRuns.tasks > 0 ? (
        <p className="text-sm text-muted-foreground">
          {data.skillRuns.tasks} of {data.tasks} tasks were skill runs (audit, handoff) and hold{" "}
          {usd(data.skillRuns.costUsd)} of the cost. Ponytail trims code, so it has little to trim
          there.
        </p>
      ) : null}
      <h3 className="text-xs font-medium text-muted-foreground">Latest tasks</h3>
      <ul className="-mt-1 flex flex-col divide-y divide-border">
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
    </div>
  );
}

function PonytailCompare(props: { readonly data: PonytailUsage }) {
  const { data } = props;
  const before = new Map(data.providersBefore.map((p) => [p.provider, p]));
  const after = new Map(data.providers.map((p) => [p.provider, p]));
  const drivers = [...new Set([...after.keys(), ...before.keys()])];
  if (drivers.length === 0) return null;
  const compare = data.providersBefore.length > 0;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">
        {compare
          ? `Per turn: the 30 days before ${shortDate(data.since)}, then since`
          : "Per turn: the last 30 days"}
      </h3>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="pb-1 pr-3 font-normal">Provider</th>
            {compare ? <th className="pb-1 pr-3 font-normal">Before</th> : null}
            <th className="pb-1 font-normal">{compare ? "Since" : "Last 30 days"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {drivers.map((d) => (
            <tr key={d} className="align-top">
              <th scope="row" className="py-1.5 pr-3 font-normal">
                {driverLabel(d)}
              </th>
              {compare ? (
                <td className="py-1.5 pr-3 tabular-nums">
                  <TurnCell totals={before.get(d)} />
                </td>
              ) : null}
              <td className="py-1.5 tabular-nums">
                <TurnCell totals={after.get(d)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        {compare
          ? "The work mix changes too, so a difference here does not prove Ponytail caused it. "
          : ""}
        No saving is shown: it needs a baseline, and the app has none.
      </p>
    </div>
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
