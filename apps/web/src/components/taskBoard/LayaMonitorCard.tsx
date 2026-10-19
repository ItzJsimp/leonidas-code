import { ShieldCheckIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { LayaUsage } from "@t3tools/contracts";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { layaUsageQuery } from "~/state/taskBoard";

const JOB_LABELS: Record<string, string> = {
  bash_gate: "Command checks",
  screen: "Web page checks",
};

const ENGINE_LABELS: Record<LayaUsage["engineStatus"], string> = {
  ready: "Ready",
  "missing-model": "Model missing",
  "missing-pack": "Not installed",
  "missing-runtime": "Python setup needed",
  error: "Check failed",
  paused: "Paused for Game Mode",
};
const JEV_LABELS: Record<LayaUsage["jevState"], string> = {
  off: "Off",
  ready: "Key present",
  paused: "Paused",
};

/** Shows whether Laya is installed and how often its checks ran. Counts only, no command text. */
export function LayaMonitorCard() {
  const environmentId = usePrimaryEnvironmentId();
  const { data, error } = useEnvironmentQuery(
    environmentId ? layaUsageQuery({ environmentId, input: {} }) : null,
  );

  return (
    <section
      aria-label="Laya safety checks"
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheckIcon aria-hidden className="size-4 text-muted-foreground" />
        Laya safety checks
      </h2>
      {data === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {error ? "Laya numbers are not available now. Try again later." : "Loading..."}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            {[
              ["Engine", ENGINE_LABELS[data.engineStatus]],
              ["Model", data.modelHash ?? "Not found"],
              ["Last probe", data.probeMs === null ? "Not measured" : `${data.probeMs} ms`],
              ["Jev backup", JEV_LABELS[data.jevState]],
              ["Game Mode", data.gameMode ? "On" : "Off"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {data.engineStatus !== "ready" && (
            <p className="text-sm text-muted-foreground">
              {data.gameMode
                ? "Local model checks are paused. Rules still run."
                : "Rules still run. Open Settings to check Laya setup."}{" "}
              <Link
                to="/settings/general"
                className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                Open Settings
              </Link>
            </p>
          )}
          <dl
            aria-label="Checks by tier"
            className="grid grid-cols-3 gap-4 border-t border-border pt-3 text-sm"
          >
            {(["rules", "model", "jev"] as const).map((tier) => (
              <div key={tier}>
                <dt className="text-xs text-muted-foreground">
                  {tier === "jev" ? "Jev" : tier === "model" ? "Model" : "Rules"}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">{data.tiers[tier]}</dd>
              </div>
            ))}
          </dl>
          {data.total === 0 ? (
            <p className="text-sm text-muted-foreground">No checks have run yet.</p>
          ) : (
            <>
              <p className="text-sm">
                <span className="font-medium tabular-nums">{data.total}</span>{" "}
                <span className="text-muted-foreground">checks run so far</span>
              </p>
              <Spark days={data.days} />
              <ul className="flex flex-col divide-y divide-border">
                {data.jobs.map((job) => (
                  <li
                    key={job.job}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5 text-sm"
                  >
                    <span>{JOB_LABELS[job.job] ?? job.job}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {job.count} {job.count === 1 ? "run" : "runs"}
                      {job.blocked > 0 ? ` · ${job.blocked} blocked` : ""}
                      {job.asked > 0 ? ` · ${job.asked} asked you` : ""}
                      {job.flagged > 0
                        ? ` · ${job.flagged} ${job.flagged === 1 ? "warning" : "warnings"}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Spark(props: { readonly days: ReadonlyArray<{ date: string; count: number }> }) {
  const max = Math.max(1, ...props.days.map((d) => d.count));
  return (
    <div
      role="img"
      aria-label={`Checks per day, last ${props.days.length} days`}
      className="flex h-8 items-end gap-1"
    >
      {props.days.map((d) => (
        <div
          key={d.date}
          className="flex-1 rounded-sm bg-primary/60"
          style={{ height: `${Math.max(d.count === 0 ? 4 : 12, (d.count / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
