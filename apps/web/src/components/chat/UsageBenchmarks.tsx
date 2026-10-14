import type { EnvironmentId, ModelSelection } from "@t3tools/contracts";
import { ChartScatterIcon } from "lucide-react";
import { useState } from "react";

import type { BenchmarkCandidate } from "../../lib/modelBenchmarks";
import { BenchmarkExplorer, type StartBenchmarkArena } from "./BenchmarkExplorer";

/** The card's one benchmark entry: a row that opens the explorer window. */
export function UsageBenchmarks({
  environmentId,
  candidates,
  onStartChat,
  onStartArena,
}: {
  readonly environmentId: EnvironmentId;
  readonly candidates: ReadonlyArray<BenchmarkCandidate>;
  readonly onStartChat: ((selection: ModelSelection) => void) | null;
  readonly onStartArena: StartBenchmarkArena | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-center gap-2 border-t border-border/60 pt-3 text-xs font-medium text-foreground transition-colors hover:text-primary"
      >
        <ChartScatterIcon aria-hidden className="size-3.5 text-muted-foreground" />
        Compare model benchmarks
      </button>
      {open ? (
        <BenchmarkExplorer
          open
          onOpenChange={setOpen}
          environmentId={environmentId}
          candidates={candidates}
          onStartChat={onStartChat}
          onStartArena={onStartArena}
        />
      ) : null}
    </>
  );
}
