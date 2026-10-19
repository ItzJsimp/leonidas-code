import type { WorkspacePackWidget } from "@t3tools/contracts";

/** What the core needs from the business pack. The pack itself is never imported by name. */
export interface BusinessPack {
  readonly readWidgets: (root: string, now: number) => Promise<ReadonlyArray<WorkspacePackWidget>>;
}

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

// The one seam to packages/business-pack. The bundler turns this glob into a lazy chunk when the
// folder exists and into an empty map when it does not, so the core builds and runs without it.
const packModules = import.meta.glob("../../../../packages/business-pack/src/index.ts");

let pending: Promise<BusinessPack | null> | undefined;

/** The business pack, or null when this build has none. Loaded once, on first use. */
export function loadBusinessPack(): Promise<BusinessPack | null> {
  pending ??= (async () => {
    const load = Object.values(packModules)[0];
    if (!load) return null;
    try {
      const mod = (await load()) as Partial<BusinessPack>;
      return typeof mod.readWidgets === "function" ? (mod as BusinessPack) : null;
    } catch {
      return null;
    }
  })();
  return pending;
}
