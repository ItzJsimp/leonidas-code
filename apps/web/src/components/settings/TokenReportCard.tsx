import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, LocalModelsTokenReport } from "@t3tools/contracts";
import { useState } from "react";

import { localModelsTokenReport } from "~/state/localModels";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { tokenReportLines } from "./localModels.logic";

type Days = 7 | 30;

/**
 * Token report. It shows how much of your cloud use a local model could have taken. It reads
 * counts once per click, never message text, and nothing leaves this computer.
 */
export function TokenReportCard({ environmentId }: { environmentId: EnvironmentId }) {
  const run = useAtomCommand(localModelsTokenReport, { reportFailure: false });
  const [days, setDays] = useState<Days>(30);
  const [report, setReport] = useState<LocalModelsTokenReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  const check = async (period: Days) => {
    setDays(period);
    setChecking(true);
    setFailed(false);
    const result = await run({ environmentId, input: { days: period } });
    setChecking(false);
    if (result._tag === "Failure") {
      void squashAtomCommandFailure(result);
      setFailed(true);
      return;
    }
    setReport(result.value);
  };

  return (
    <div className="grid gap-2 rounded-lg border border-border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Token report</div>
        <div className="flex items-center gap-1.5">
          <Button
            size="xs"
            variant={days === 7 ? "default" : "outline"}
            disabled={checking}
            onClick={() => void check(7)}
          >
            7 days
          </Button>
          <Button
            size="xs"
            variant={days === 30 ? "default" : "outline"}
            disabled={checking}
            onClick={() => void check(30)}
          >
            30 days
          </Button>
          <Button size="xs" variant="outline" disabled={checking} onClick={() => void check(days)}>
            {checking ? <Spinner size="sm" /> : null}
            {checking ? "Checking" : report === null ? "Check my usage" : "Check again"}
          </Button>
        </div>
      </div>
      {failed ? (
        <p className="text-sm text-destructive-foreground">
          The report failed. Try again in a moment.
        </p>
      ) : report === null ? (
        <p className="text-sm text-muted-foreground">
          See how many cloud tokens a local model could have taken. It reads counts only, never your
          messages.
        </p>
      ) : (
        <ul className="grid gap-1">
          {tokenReportLines(report).map((line) => (
            <li key={line} className="text-sm tabular-nums">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
