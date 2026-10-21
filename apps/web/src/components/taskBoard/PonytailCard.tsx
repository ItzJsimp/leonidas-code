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
const duration = (n: number) => (n >= 120 ? `${(n / 60).toFixed(1)} h` : mins(n));
const compact = (n: number) =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1)}B`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1000
        ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`
        : `${Math.round(n)}`;
const shortDate = (iso: string) => (iso ? `${iso.slice(5, 7)}-${iso.slice(8, 10)}` : "");
const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "n/a";

type Totals = PonytailUsage["providers"][number];
type Account = PonytailUsage["accounts"][number];

/** One plain sentence for how many accounts of a provider have the plugin working. */
function pluginSummary(accounts: ReadonlyArray<Account>, driver: string, noun: string): string {
  const mine = accounts.filter((a) => a.driver === driver);
  const on = mine.filter((a) => a.plugin === "on").length;
  const waiting = mine.filter((a) => a.plugin === "needs-trust").length;
  if (mine.length === 0) return `You have no ${noun} account.`;
  if (waiting > 0) {
    return `Installed, waiting for your OK in ${waiting === 1 ? "one account" : `${waiting} accounts`}.`;
  }
  const scope =
    mine.length === 1
      ? `your ${noun} account`
      : on === mine.length
        ? `all ${mine.length} ${noun} accounts`
        : `${on} of ${mine.length} ${noun} accounts`;
  return on > 0 ? `On in ${scope}.` : `Not on in ${scope} yet.`;
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
 * Says what Ponytail is for, what it is worth, and what it did. Money, time and token savings are a
 * projection from the published benchmark, labelled as one. Everything else is measured.
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
          Every agent follows a short rule set: reuse what already exists, add nothing nobody asked
          for, test risky logic, and say what was skipped. Smaller changes cost less and finish
          sooner.
        </p>
      </header>

      {data === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {error ? "Ponytail numbers are not available now. Try again later." : "Loading..."}
        </p>
      ) : (
        <>
          <PonytailBenefit data={data} />
          <PonytailDone data={data} />
          <PonytailCompare data={data} />
          <PonytailWhere data={data} />
          <PonytailRecent data={data} />
        </>
      )}
    </section>
  );
}

function PonytailBenefit(props: { readonly data: PonytailUsage }) {
  const { data } = props;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        What it is worth to you (estimate)
      </h3>
      {data.code.tasks === 0 ? (
        <p className="text-sm text-muted-foreground">
          This fills in after a Claude task where an agent writes code with the plugin on.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <Stat label="Cost saved" value={`~${usd(data.projected.costUsd)}`} />
            <Stat label="Time saved" value={`~${duration(data.projected.agentMinutes)}`} />
            <Stat label="Tokens saved" value={`~${compact(data.projected.outputTokens)}`} />
          </dl>
          <p className="text-xs text-muted-foreground">
            A projection, not a measurement. The published benchmark (39 tasks, 5 runs each, Opus
            5.5) found 26% lower cost, 41% less time and 45% fewer output tokens. This applies those
            rates to your {data.code.tasks} code {data.code.tasks === 1 ? "task" : "tasks"} since{" "}
            {shortDate(data.since)} ({usd(data.code.costUsd)} and {duration(data.code.agentMinutes)}{" "}
            actually spent). Cost comes from Claude tasks only.
          </p>
        </>
      )}
    </div>
  );
}

function PonytailDone(props: { readonly data: PonytailUsage }) {
  const { code, tasks } = props.data;
  if (code.tasks === 0) return null;
  const pieces = code.reused + code.created;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        What it did on your code tasks (measured)
      </h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Reused existing code"
          value={`${percent(code.reused, pieces)} (${code.reused} of ${pieces})`}
        />
        <Stat
          label="Tests ran"
          value={code.testsRan === null ? "n/a" : `${code.testsRan} of ${code.tasks} tasks`}
        />
        <Stat label="Callers left unchecked" value={`${code.callersOpen}`} />
        <Stat label="Code tasks" value={`${code.tasks} of ${tasks}`} />
      </dl>
      <p className="text-xs text-muted-foreground">
        The other {tasks - code.tasks} logged tasks wrote no code (audits, questions, handoffs), so
        the rules had little to trim there.
      </p>
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
          ? `Per turn: the 30 days before ${shortDate(data.since)}, then since (measured)`
          : "Per turn: the last 30 days (measured)"}
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
      {compare ? (
        <p className="text-xs text-muted-foreground">
          The work mix changes too, so a difference here does not prove Ponytail caused it.
        </p>
      ) : null}
    </div>
  );
}

function PonytailWhere(props: { readonly data: PonytailUsage }) {
  const { accounts } = props.data;
  const hasClaude = accounts.some((a) => a.driver === "claudeAgent");
  const hasCodex = accounts.some((a) => a.driver === "codex");
  const missingClaude = accounts.some((a) => a.driver === "claudeAgent" && a.plugin !== "on");
  const waiting = accounts.some((a) => a.plugin === "needs-trust");
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">Where it is on</h3>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Rules</dt>
        <dd>
          On for all {accounts.length} {accounts.length === 1 ? "account" : "accounts"}. The app
          adds them to every agent.
        </dd>
        {hasClaude ? (
          <>
            <dt className="text-muted-foreground">Claude plugin</dt>
            <dd>
              {pluginSummary(accounts, "claudeAgent", "Claude")}{" "}
              <span className="text-muted-foreground">
                Adds /ponytail commands and the task ledger.
              </span>
            </dd>
          </>
        ) : null}
        {hasCodex ? (
          <>
            <dt className="text-muted-foreground">Codex plugin</dt>
            <dd>
              {pluginSummary(accounts, "codex", "Codex")}{" "}
              <span className="text-muted-foreground">
                Adds /ponytail commands. Codex has no task ledger.
              </span>
            </dd>
          </>
        ) : null}
      </dl>
      {waiting ? (
        <p className="text-xs text-warning-foreground">
          Codex asks you to approve a plugin&apos;s hooks. Open Codex, type /hooks, trust the two
          Ponytail hooks, and start a new thread.
        </p>
      ) : null}
      {missingClaude ? (
        <p className="text-xs text-muted-foreground">
          The app installs the Claude plugin about 30 seconds after an account starts. It needs
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
                    a.plugin === "on" ? "success" : a.plugin === "none" ? "outline" : "warning"
                  }
                >
                  {a.plugin === "on"
                    ? "Plugin on"
                    : a.plugin === "needs-trust"
                      ? "Needs your OK"
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

function PonytailRecent(props: { readonly data: PonytailUsage }) {
  const { data } = props;
  if (data.tasks === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tasks logged yet. The ledger fills after a Claude task with the plugin on.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">
        Latest of {data.tasks} logged tasks (cost is the plugin&apos;s own figure)
      </h3>
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
