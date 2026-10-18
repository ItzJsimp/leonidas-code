import { ShieldCheckIcon } from "lucide-react";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { layaUsageQuery } from "~/state/taskBoard";

const JOB_LABELS: Record<string, string> = {
  bash_gate: "Command checks",
  screen: "Web page checks",
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
      ) : data.status === "missing" ? (
        <p className="text-sm text-muted-foreground">
          Laya is not installed on this computer. Checks run by simple rules only.
        </p>
      ) : data.total === 0 ? (
        <p className="text-sm text-muted-foreground">Laya is ready. No checks have run yet.</p>
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
                className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
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
