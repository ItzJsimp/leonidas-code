import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, LocalModelsAdvice } from "@t3tools/contracts";
import { useState } from "react";

import { formatBytes } from "../../lib/formatBytes";
import { localModelsAdvice } from "~/state/localModels";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

function AdviceList({ advice }: { advice: LocalModelsAdvice }) {
  if (!advice.supported) {
    return (
      <p className="text-sm text-muted-foreground">
        This check works on Windows only. Your system is not supported yet.
      </p>
    );
  }
  if (advice.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No program holds a large share of memory. Your PC is ready for a model.
      </p>
    );
  }
  return (
    <ul className="grid gap-1.5">
      {advice.items.map((item) => (
        <li key={`${item.kind}-${item.name}`} className="text-sm">
          <span className="font-medium">{item.name}</span>
          {item.processes > 1 ? (
            <span className="text-muted-foreground"> ({item.processes} processes)</span>
          ) : null}
          <span className="tabular-nums text-muted-foreground">
            {" "}
            · {formatBytes(item.memoryBytes)} {item.kind === "vram" ? "video memory" : "memory"}
          </span>
          {item.hint !== null ? (
            <div className="text-2xs text-muted-foreground">{item.hint}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Read-only PC advisor. It lists the programs that hold the most memory and gives plain hints.
 * It reads once per click: no polling, and it never stops a program.
 */
export function PcAdvisorCard({ environmentId }: { environmentId: EnvironmentId }) {
  const run = useAtomCommand(localModelsAdvice, { reportFailure: false });
  const [advice, setAdvice] = useState<LocalModelsAdvice | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  const check = async () => {
    setChecking(true);
    setFailed(false);
    const result = await run({ environmentId, input: {} });
    setChecking(false);
    if (result._tag === "Failure") {
      void squashAtomCommandFailure(result);
      setFailed(true);
      return;
    }
    setAdvice(result.value);
  };

  return (
    <div className="grid gap-2 rounded-lg border border-border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">PC advisor</div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="xs" variant="outline" disabled={checking} onClick={() => void check()}>
                {checking ? <Spinner size="sm" /> : null}
                {checking ? "Checking" : advice === null ? "Check my PC" : "Check again"}
              </Button>
            }
          />
          <TooltipPopup side="top">
            List the programs that hold the most memory. It only reads. It never stops a program.
          </TooltipPopup>
        </Tooltip>
      </div>
      {failed ? (
        <p className="text-sm text-destructive-foreground">
          The check failed. Try again in a moment.
        </p>
      ) : advice === null ? (
        <p className="text-sm text-muted-foreground">
          See which programs use your video and system memory before you run a large model.
        </p>
      ) : (
        <AdviceList advice={advice} />
      )}
    </div>
  );
}
