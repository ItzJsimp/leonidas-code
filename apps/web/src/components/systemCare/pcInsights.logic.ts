import type {
  HardwareAlert,
  HardwareInventory,
  HardwareLimit,
  HardwareSample,
} from "@t3tools/contracts";

import { isDiscreteGpu } from "@t3tools/shared/hardwareWatch";

import { formatBytes, limitLevel, openAlerts } from "./systemCare.logic";

const DAY_MS = 24 * 60 * 60_000;

export interface HealthScore {
  readonly score: number | null;
  readonly headline: string;
  /** The readings that cost points, worst first, in plain words. */
  readonly reasons: ReadonlyArray<string>;
}

/**
 * One 0 to 100 number a beginner can read: every reading starts at full marks and loses points
 * when it is past its warn or critical limit, or when an alert is still open.
 */
export function healthScore(
  sample: HardwareSample | null,
  limits: ReadonlyMap<string, HardwareLimit>,
  alerts: ReadonlyArray<HardwareAlert>,
): HealthScore {
  if (!sample) return { score: null, headline: "Waiting for the first reading", reasons: [] };
  const penalties: Array<readonly [points: number, reason: string]> = [];
  const check = (metric: string, value: number | null | undefined, what: string) => {
    const level = limitLevel(value, limits.get(metric));
    if (level === "critical") penalties.push([20, `${what} is past its safe limit`]);
    else if (level === "warning") penalties.push([8, `${what} is close to its limit`]);
  };
  check("cpu.temp", sample.cpu.packageTempC ?? sample.cpu.maxCoreTempC, "Processor heat");
  sample.gpus.forEach((gpu) => check(`gpu.${gpu.index}.temp`, gpu.tempC, "Graphics heat"));
  check(
    "memory.load",
    (sample.memory.usedBytes / Math.max(1, sample.memory.totalBytes)) * 100,
    "Memory use",
  );
  for (const volume of sample.volumes) {
    const used = (volume.usedBytes / Math.max(1, volume.totalBytes)) * 100;
    check(`volume.${volume.mount}.used`, used, `Drive ${volume.label ?? volume.mount} space`);
  }
  if (sample.gpus.some((gpu) => gpu.thermalThrottling))
    penalties.push([10, "Graphics is slowing down to cool off"]);
  for (const alert of openAlerts(alerts).filter((entry) => !entry.acknowledged))
    penalties.push([alert.severity === "critical" ? 15 : 5, alert.message]);

  penalties.sort((a, b) => b[0] - a[0]);
  const score = Math.max(0, 100 - penalties.reduce((sum, [points]) => sum + points, 0));
  const headline =
    score >= 90
      ? "Your PC is in great shape"
      : score >= 70
        ? "Good, with a few things to tune"
        : score >= 50
          ? "Needs attention soon"
          : "Struggling: tune it now";
  return { score, headline, reasons: penalties.map(([, reason]) => reason) };
}

export interface QuickWin {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly impact: "high" | "medium" | "low";
}

/** Reads ISO dates and the `/Date(ms)/` form that Windows management data uses. */
export function parseDriverDate(text: string | null): number | null {
  if (!text) return null;
  const wmi = /\/Date\((-?\d+)/.exec(text);
  const at = wmi ? Number(wmi[1]) : Date.parse(text);
  return Number.isFinite(at) ? at : null;
}

export function driverDateText(text: string | null): string | null {
  const at = parseDriverDate(text);
  return at === null ? text : new Date(at).toLocaleDateString();
}

/** Gains the data already proves, so the user sees what tuning would do before asking an agent. */
export function quickWins(
  inventory: HardwareInventory | null,
  sample: HardwareSample | null,
  now: number,
): QuickWin[] {
  const wins: QuickWin[] = [];
  if (inventory) {
    const slow = inventory.memory.modules.filter(
      (module) =>
        module.speedMts !== null &&
        module.configuredSpeedMts !== null &&
        module.configuredSpeedMts < module.speedMts * 0.95,
    );
    if (slow.length > 0) {
      const first = slow[0]!;
      wins.push({
        id: "memory-speed",
        title: "Memory runs slower than it is rated for",
        detail: `Your memory runs at ${first.configuredSpeedMts} MT/s but is rated for ${first.speedMts} MT/s. Turning on its speed profile (XMP or EXPO) in the BIOS can make games and apps faster.`,
        impact: "high",
      });
    }
    const realGpus = inventory.gpus.some(isDiscreteGpu)
      ? inventory.gpus.filter(isDiscreteGpu)
      : inventory.gpus;
    for (const gpu of realGpus) {
      const at = parseDriverDate(gpu.driverDate);
      if (at !== null && now - at > 180 * DAY_MS)
        wins.push({
          id: `gpu-driver-${gpu.name}`,
          title: "Graphics driver is more than 6 months old",
          detail: `${gpu.name} uses a driver from ${new Date(at).toLocaleDateString()}. New drivers often fix bugs and speed up new games.`,
          impact: "medium",
        });
    }
    const booted = inventory.os.bootedAt;
    if (booted !== null && now - booted > 7 * DAY_MS)
      wins.push({
        id: "uptime",
        title: `On for ${Math.floor((now - booted) / DAY_MS)} days without a restart`,
        detail:
          "A restart clears leaked memory and finishes pending updates. It is the easiest fix there is.",
        impact: "low",
      });
    if (inventory.disks.some((disk) => disk.health !== "healthy" && disk.health !== "unknown"))
      wins.push({
        id: "disk-health",
        title: "A drive reports a health problem",
        detail:
          "Back up your files from it soon. A failing drive slows the whole computer and can lose data.",
        impact: "high",
      });
  }
  for (const volume of sample?.volumes ?? []) {
    const free = volume.totalBytes - volume.usedBytes;
    if (free / Math.max(1, volume.totalBytes) < 0.1)
      wins.push({
        id: `space-${volume.mount}`,
        title: `Drive ${volume.label ?? volume.mount} is almost full`,
        detail: `Only ${formatBytes(free, 0)} is free. Windows slows down when a drive has less than 10% free.`,
        impact: "medium",
      });
  }
  const order = { high: 0, medium: 1, low: 2 } as const;
  return wins.toSorted((a, b) => order[a.impact] - order[b.impact]);
}

/** How long the computer has been on, in plain words. */
export function uptimeText(bootedAt: number | null, now: number): string | null {
  if (bootedAt === null) return null;
  const minutes = Math.max(0, Math.floor((now - bootedAt) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} days`;
}

/** Power-on hours as years and days, so a beginner can tell an old drive from a new one. */
export function ageText(hours: number | null): string | null {
  if (hours === null) return null;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days} days of use`;
  const years = days / 365;
  return years < 1 ? `${Math.round(days / 30)} months of use` : `${years.toFixed(1)} years of use`;
}

/** One line on what a part does, for people who do not know the words. */
export const PART_EXPLAINER = {
  cpu: "The brain. It runs every app and decides how fast things feel.",
  gpu: "Draws everything on screen. Games, video and AI depend on it.",
  memory: "Short-term workspace. More room means more apps open at once without slowing down.",
  storage: "Long-term storage for your files and apps. Fast drives make loading quick.",
  board: "Connects every part. Its BIOS holds settings like memory speed.",
} as const;
