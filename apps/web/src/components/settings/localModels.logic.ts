import type { LocalModelFit, LocalModelPull, LocalModelRow } from "@t3tools/contracts";

export type FitTone = "success" | "warning" | "error" | "info";

export function fitView(fit: LocalModelFit): { label: string; tone: FitTone; tip: string } {
  switch (fit) {
    case "fits":
      return {
        label: "Fits",
        tone: "success",
        tip: "The whole model fits in your graphics memory. This is the fastest way to run it.",
      };
    case "tight":
      return {
        label: "Tight",
        tone: "warning",
        tip: "Part of the model runs on your processor and memory. It works, but it is slower.",
      };
    case "too_big":
      return {
        label: "Too big",
        tone: "error",
        tip: "This model is larger than your graphics memory and free memory together.",
      };
    case "unknown":
      return {
        label: "Unknown",
        tone: "info",
        tip: "The size or your hardware is not known yet.",
      };
  }
}

/** Whole percent of a running download, or null before the size is known. */
export function pullPercent(pull: LocalModelPull | null): number | null {
  if (pull === null || pull.totalBytes <= 0) return null;
  return Math.min(100, Math.floor((pull.completedBytes / pull.totalBytes) * 100));
}

export function speedLabel(tokensPerSecond: number | null): string {
  if (tokensPerSecond === null) return "Not tested";
  return `${tokensPerSecond >= 10 ? Math.round(tokensPerSecond) : tokensPerSecond.toFixed(1)} tok/s`;
}

export type RowAction =
  | { kind: "installed"; canStop: boolean }
  | { kind: "pulling" }
  | { kind: "get"; disabledReason: string | null; needsConfirm: boolean };

/** Which buttons a row shows. */
export function rowAction(row: LocalModelRow): RowAction {
  if (row.installed) return { kind: "installed", canStop: row.loaded };
  if (row.pull !== null && row.pull.error === null) return { kind: "pulling" };
  return {
    kind: "get",
    disabledReason: row.gate.allowed ? null : row.gate.reason,
    needsConfirm: row.gate.needsConfirm,
  };
}

const FIT_RANK: Readonly<Record<LocalModelFit, number>> = {
  fits: 0,
  tight: 1,
  too_big: 2,
  unknown: 3,
};

/** Installed models first, then by fit. Equal rows keep their order. */
export function sortRows(rows: ReadonlyArray<LocalModelRow>): LocalModelRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .toSorted((a, b) => {
      const installed = Number(b.row.installed) - Number(a.row.installed);
      if (installed !== 0) return installed;
      const fit = FIT_RANK[a.row.fit] - FIT_RANK[b.row.fit];
      return fit !== 0 ? fit : a.index - b.index;
    })
    .map(({ row }) => row);
}
