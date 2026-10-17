import type { LocalModelRow, LocalModelsState } from "@t3tools/contracts";
import { useMemo, useState } from "react";

import { formatBytes } from "../../lib/formatBytes";
import { cn } from "../../lib/utils";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";
import { fitView, pullPercent, rowAction, sortRows, speedLabel } from "./localModels.logic";
import { useLocalModels } from "./useLocalModels";

type Pending = { readonly kind: "delete" | "pull"; readonly row: LocalModelRow };

function Tip({ text, children }: { text: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup side="top">{text}</TooltipPopup>
    </Tooltip>
  );
}

function Pill({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <Tip text={tip}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </span>
    </Tip>
  );
}

function HardwarePills({ state }: { state: LocalModelsState }) {
  const { hardware, modelDrive, ollama } = state;
  // The first hardware reading arrives a few seconds after the server starts.
  const reading = hardware.ramBytes === 0;
  const drive = modelDrive
    ? `${modelDrive.mount} ${modelDrive.mediaType === "unknown" ? "" : modelDrive.mediaType.toUpperCase()} · ${formatBytes(modelDrive.freeBytes)} free`.replace(
        "  ",
        " ",
      )
    : "not found";
  return (
    <div className="flex flex-wrap gap-2">
      <Pill
        label="GPU"
        value={
          reading
            ? "reading"
            : hardware.gpuName
              ? `${hardware.gpuName} · ${formatBytes(hardware.vramBytes)}`
              : "none found"
        }
        tip="Your graphics card and its memory. A model that fits here runs fastest."
      />
      <Pill
        label="Memory"
        value={reading ? "reading" : formatBytes(hardware.ramBytes)}
        tip="Your total computer memory. A big model can spill into it, but it runs slower."
      />
      <Pill
        label="Model drive"
        value={reading ? "reading" : drive}
        tip="The drive that holds your model files. Downloads need free space here. A hard disk is blocked because it loads models too slowly."
      />
      <Pill
        label="Ollama"
        value={ollama.running ? "running" : "not running"}
        tip={
          ollama.running
            ? `Ollama answers at ${ollama.baseUrl}.`
            : `Ollama does not answer at ${ollama.baseUrl}. Start Ollama to see and download models.`
        }
      />
    </div>
  );
}

function ModelActions({
  row,
  busy,
  onRun,
  onStop,
  onAskDelete,
  onGet,
  onCancel,
}: {
  row: LocalModelRow;
  busy: boolean;
  onRun: () => void;
  onStop: () => void;
  onAskDelete: () => void;
  onGet: () => void;
  onCancel: () => void;
}) {
  const action = rowAction(row);
  if (action.kind === "pulling") {
    return (
      <Tip text="Stop this download. Files already downloaded are kept.">
        <Button size="xs" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </Tip>
    );
  }
  if (action.kind === "get") {
    const button = (
      <Button
        size="xs"
        disabled={action.disabledReason !== null || busy}
        onClick={onGet}
        aria-label={`Download ${row.name}`}
      >
        Get
      </Button>
    );
    return action.disabledReason !== null ? (
      <Tip text={action.disabledReason}>
        <span className="inline-flex">{button}</span>
      </Tip>
    ) : (
      <Tip
        text={
          row.sizeBytes === null
            ? "Download this model."
            : `Download ${formatBytes(row.sizeBytes)} to your model drive.`
        }
      >
        {button}
      </Tip>
    );
  }
  return (
    <div className="flex justify-end gap-1.5">
      {action.canStop ? (
        <Tip text="Unload this model from memory to free it for other apps.">
          <Button size="xs" variant="outline" disabled={busy} onClick={onStop}>
            Stop
          </Button>
        </Tip>
      ) : (
        <Tip text="Load this model into memory now, so the first chat reply is fast. Choose it in the model picker to chat.">
          <Button size="xs" disabled={busy} onClick={onRun}>
            Run
          </Button>
        </Tip>
      )}
      <Tip text="Delete this model from your disk. You can download it again later.">
        <Button size="xs" variant="destructive-outline" disabled={busy} onClick={onAskDelete}>
          Delete
        </Button>
      </Tip>
    </div>
  );
}

function ModelRowView({
  row,
  busy,
  onRun,
  onStop,
  onAskDelete,
  onGet,
  onCancel,
}: Parameters<typeof ModelActions>[0]) {
  const fit = fitView(row.fit);
  const percent = pullPercent(row.pull);
  const failed = row.pull?.error ?? null;
  return (
    <TableRow>
      <TableCell className="max-w-64">
        <div className="truncate font-medium">
          <Tip text={row.name}>
            <span>{row.name}</span>
          </Tip>
          {row.loaded ? (
            <Badge size="sm" variant="success" className="ml-2 align-middle">
              loaded
            </Badge>
          ) : null}
        </div>
        <div className="truncate font-mono text-2xs text-muted-foreground">
          <Tip text={row.id}>
            <span>{row.id}</span>
          </Tip>
        </div>
        {row.pull !== null && failed === null ? (
          <div className="mt-1 flex items-center gap-2">
            <div
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent ?? undefined}
              aria-label={`Download of ${row.name}`}
            >
              <div
                className={cn(
                  "h-full rounded-full bg-info",
                  percent === null && "w-1/4 animate-pulse",
                )}
                style={percent === null ? undefined : { width: `${percent}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-2xs text-muted-foreground tabular-nums">
              {percent === null
                ? "Starting"
                : `${formatBytes(row.pull.completedBytes)} of ${formatBytes(row.pull.totalBytes)}`}
            </span>
          </div>
        ) : null}
        {failed !== null ? (
          <div className="mt-1 text-2xs text-destructive-foreground">Download failed: {failed}</div>
        ) : null}
      </TableCell>
      <TableCell>
        <Tip text={fit.tip}>
          <Badge variant={fit.tone} size="sm">
            {fit.label}
          </Badge>
        </Tip>
      </TableCell>
      <TableCell>
        <span className="tabular-nums">
          {row.sizeBytes === null ? "Unknown" : formatBytes(row.sizeBytes)}
        </span>
      </TableCell>
      <TableCell>
        <Tip text="Tokens per second from a speed test. Speed tests arrive in a later update.">
          <span className="tabular-nums text-muted-foreground">
            {speedLabel(row.tokensPerSecond)}
          </span>
        </Tip>
      </TableCell>
      <TableCell>
        <Tip text="BenchLM score: a public quality score for this model. Higher is better.">
          <span className="tabular-nums text-muted-foreground">
            {row.benchLm === null ? "n/a" : row.benchLm.toFixed(1)}
          </span>
        </Tip>
      </TableCell>
      <TableCell className="text-right">
        <ModelActions
          row={row}
          busy={busy}
          onRun={onRun}
          onStop={onStop}
          onAskDelete={onAskDelete}
          onGet={onGet}
          onCancel={onCancel}
        />
      </TableCell>
    </TableRow>
  );
}

export function ModelsSettingsPanel() {
  const models = useLocalModels();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const state = models.state;
  const rows = useMemo(() => (state ? sortRows(state.rows) : []), [state]);

  const withBusy = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
    }
  };

  const confirm = async () => {
    if (pending === null) return;
    const { kind, row } = pending;
    setPending(null);
    if (kind === "delete") await withBusy(row.id, () => models.remove(row.id));
    else await withBusy(row.id, () => models.pull(row.id, true));
  };

  return (
    <SettingsPageContainer>
      <SettingsSection id="local-models" title="Local models">
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Models that run on this computer through Ollama. They cost no money per message.
          </p>
          {state === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              {models.isPending ? (
                <>
                  <Spinner size="sm" /> Reading your computer and Ollama
                </>
              ) : (
                <>Could not read the local models. Close this page and open it again.</>
              )}
            </div>
          ) : (
            <>
              <HardwarePills state={state} />
              {!state.ollama.running ? (
                <div className="rounded-lg border border-warning/32 bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
                  Ollama is not running. Start Ollama to see your models and download new ones.
                </div>
              ) : null}
              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
                  No models yet. Start Ollama, then pick one to download.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Fit</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Speed</TableHead>
                      <TableHead>BenchLM</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <ModelRowView
                        key={row.id}
                        row={row}
                        busy={busyId === row.id}
                        onRun={() => void withBusy(row.id, () => models.run(row.id))}
                        onStop={() => void withBusy(row.id, () => models.stop(row.id))}
                        onAskDelete={() => setPending({ kind: "delete", row })}
                        onGet={() =>
                          row.gate.needsConfirm
                            ? setPending({ kind: "pull", row })
                            : void withBusy(row.id, () => models.pull(row.id, false))
                        }
                        onCancel={() => void models.cancelPull(row.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </div>
      </SettingsSection>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "delete" ? "Delete this model?" : "Download this large model?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "delete"
                ? `${pending.row.name} is removed from your disk. You can download it again later.`
                : pending
                  ? `${pending.row.name} is ${pending.row.sizeBytes === null ? "large" : formatBytes(pending.row.sizeBytes)}. It uses your internet and disk space.`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant={pending?.kind === "delete" ? "destructive" : "default"}
              onClick={() => void confirm()}
            >
              {pending?.kind === "delete" ? "Delete" : "Download"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </SettingsPageContainer>
  );
}
