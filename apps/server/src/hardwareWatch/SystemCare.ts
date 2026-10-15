// @effect-diagnostics globalDate:off globalDateInEffect:off preferSchemaOverJson:off
/**
 * Prepares PC Tuning agent prompts (internal id: System Care). Every investigation and checkup is meant to run in one
 * dedicated project rooted in the T3 home, so incident notes accumulate in one place and never land
 * in a code repository. The project's AGENTS.md carries the approve-first rule, so it holds for every
 * provider. This service only writes the context files and returns the prompt: it never starts a
 * thread or sends a message.
 */
import {
  CommandId,
  HardwareWatchError,
  ProjectId,
  type HardwareInventory,
  type HardwarePrepareAgentInput,
  type HardwarePrepareAgentResult,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import * as ServerConfig from "../config.ts";
import * as Projects from "../project/ProjectService.ts";
import { ServerSettingsService } from "../serverSettings.ts";
import { findAiosRoot } from "../taskBoard/aiosCards.ts";
import { HardwareWatch, type AgentContext } from "./HardwareWatch.ts";

export class SystemCare extends Context.Service<
  SystemCare,
  {
    readonly prepareAgent: (
      input: HardwarePrepareAgentInput,
    ) => Effect.Effect<HardwarePrepareAgentResult, HardwareWatchError>;
  }
>()("t3/hardwareWatch/SystemCare") {}

const GiB = 1024 ** 3;
const gb = (bytes: number | null) =>
  bytes === null ? "unknown" : `${(bytes / GiB).toFixed(1)} GB`;

const SYSTEM_CARE_RULES = `# PC Tuning

You are helping the owner of this computer keep it fast and healthy. The owner may not know
what a CPU, GPU or power supply is: explain every finding in plain words. This folder is your
notebook: \`MACHINE.md\` describes the hardware, \`incidents/\` holds one file per run,
\`benchmark.ps1\` measures speed, \`benchmarks.jsonl\` keeps every result, and \`LOG.md\` is a
running log you append to.

## Rules

1. Measure first. Run \`benchmark.ps1\` before you change anything, and again after the last
   change, so every claim of a gain has a before and after number.
2. Diagnose read-only. Use system tools (PowerShell \`Get-Process\`, \`Get-CimInstance\`,
   \`Get-Counter\`, \`powercfg\`, \`winget list\`, event logs) to find the cause.
3. If the owner's AI operating system has a mode or skills about PCs or Windows, read them
   before you plan, and follow them where they are stricter than these rules.
4. Never change the system without asking. Before every change (ending a process, changing a
   power plan, editing the registry, updating or removing drivers or software, changing startup
   apps, deleting files) explain what you will do, why, the risk, and how to undo it, then wait
   for the owner to approve that specific change.
5. Create a restore point before the first change (\`Checkpoint-Computer\`, needs admin). Never
   turn off security features (Defender, Memory Integrity, VBS, firewall, UAC) for speed.
6. One change at a time. Prefer reversible fixes. Note the undo step in \`LOG.md\` for every
   change. If a change shows no measured gain, say so and offer to undo it.
7. Never remove Microsoft.DesktopAppInstaller, Microsoft.WindowsStore, Microsoft.VCLibs,
   Microsoft.UI.Xaml, Microsoft.NET, Microsoft.SecHealthUI or anything Windows marks as not
   removable. An app you cannot identify stays. Never use third-party debloat scripts.
8. Physical causes (dust, fans, thermal paste, airflow, an old power supply) cannot be fixed
   from software: say so plainly and give the owner simple steps.
9. Finish with a short summary: the cause, what changed, the before and after numbers, what to
   watch, and append it to \`LOG.md\` with the date.
`;

export function machineSummary(inventory: HardwareInventory): string {
  const lines = [
    "# This machine",
    "",
    `- **System:** ${inventory.os.name} ${inventory.os.version} (${inventory.os.architecture}), host ${inventory.os.hostname}`,
    `- **CPU:** ${inventory.cpu.name}, ${inventory.cpu.cores ?? "?"} cores / ${inventory.cpu.threads} threads${inventory.cpu.baseClockMhz ? `, base ${inventory.cpu.baseClockMhz} MHz` : ""}`,
    ...inventory.gpus.map(
      (gpu) =>
        `- **GPU:** ${gpu.name}${gpu.driverVersion ? `, driver ${gpu.driverVersion}${gpu.driverDate ? ` (${gpu.driverDate})` : ""}` : ""}`,
    ),
    `- **Memory:** ${gb(inventory.memory.totalBytes)}${inventory.memory.modules.length ? ` in ${inventory.memory.modules.length} modules (${inventory.memory.modules.map((m) => `${gb(m.capacityBytes)} ${m.configuredSpeedMts ?? m.speedMts ?? "?"} MT/s`).join(", ")})` : ""}`,
    ...inventory.disks.map(
      (disk) =>
        `- **Drive ${disk.id}:** ${disk.model}, ${gb(disk.sizeBytes)} ${disk.mediaType.toUpperCase()}${disk.busType ? ` ${disk.busType}` : ""}, health ${disk.health}${disk.powerOnHours !== null ? `, ${disk.powerOnHours} power-on hours` : ""}`,
    ),
    `- **Board:** ${[inventory.board.manufacturer, inventory.board.product].filter(Boolean).join(" ") || "unknown"}${inventory.board.biosVersion ? `, BIOS ${inventory.board.biosVersion} (${inventory.board.biosDate ?? "?"})` : ""}`,
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * What an `investigate` agent should look at first, by the part the alert is about.
 * The prompt layout (Goal, Context, Checks, Output, Done when) follows the prompt-composer skill;
 * `promptAudit.ts` scores every generated prompt against that rubric in tests, so a wording change
 * that breaks it fails the build. Edit prompts here, then run the System Care tests.
 */
const INVESTIGATE_FOCUS: ReadonlyArray<readonly [prefix: string, check: string]> = [
  [
    "cpu",
    "Top CPU processes now (Get-Process sorted by CPU), recent critical events, the active power plan (powercfg /getactivescheme), and cooling clues in the history.",
  ],
  [
    "gpu",
    "Processes using the GPU (nvidia-smi), GPU driver version and date, power limit and fan behaviour in the history.",
  ],
  [
    "memory",
    "Top memory processes (Get-Process sorted by working set), commit charge, and startup apps that load at sign-in.",
  ],
  [
    "volume",
    "Largest folders on the drive (read-only listing), temp and cache sizes, Recycle Bin size, and what grew fastest in the history.",
  ],
  [
    "drive",
    "Drive health counters (Get-StorageReliabilityCounter), recent heavy disk activity, and airflow clues in the history.",
  ],
];

/**
 * Built-in speed test, written into the PC Tuning folder. It needs no download and no admin, runs in
 * about 30 seconds on Windows PowerShell 5.1 or 7, and appends one JSON line to benchmarks.jsonl so a
 * before and after run can be compared. Higher is better for every score except the timings.
 */
export const BENCHMARK_SCRIPT = `param([string]$Label = "manual")
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
public static class LeonidasBench {
  static double Work(int n) { double x = 0; for (int i = 1; i < n; i++) { x += Math.Sqrt(i) * Math.Sin(i); } return x; }
  public static double CpuSingle() { double best = double.MaxValue; for (int r = 0; r < 3; r++) { var sw = Stopwatch.StartNew(); Work(20000000); best = Math.Min(best, sw.Elapsed.TotalSeconds); } return 20.0 / best; }
  public static double CpuMulti() { int t = Environment.ProcessorCount; double best = double.MaxValue; for (int r = 0; r < 3; r++) { var sw = Stopwatch.StartNew(); Parallel.For(0, t, i => Work(20000000)); best = Math.Min(best, sw.Elapsed.TotalSeconds); } return 20.0 * t / best; }
  public static double MemoryGBs() { var a = new byte[256 << 20]; var b = new byte[a.Length]; double best = double.MaxValue; for (int r = 0; r < 5; r++) { var sw = Stopwatch.StartNew(); Buffer.BlockCopy(a, 0, b, 0, a.Length); best = Math.Min(best, sw.Elapsed.TotalSeconds); } return a.Length / best / 1e9; }
  public static double DiskWriteMBs(string path) { var buf = new byte[4 << 20]; new Random(1).NextBytes(buf); var sw = Stopwatch.StartNew(); using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None, 1 << 20, FileOptions.WriteThrough)) { for (int i = 0; i < 128; i++) fs.Write(buf, 0, buf.Length); fs.Flush(true); } double s = sw.Elapsed.TotalSeconds; File.Delete(path); return 512.0 / s; }
}
"@
$boot = $null
try { $event = Get-WinEvent -FilterHashtable @{ LogName = "Microsoft-Windows-Diagnostics-Performance/Operational"; Id = 100 } -MaxEvents 1; $boot = [int](([xml]$event.ToXml()).Event.EventData.Data | Where-Object Name -eq "BootTime")."#text" } catch {}
$os = Get-CimInstance Win32_OperatingSystem
$result = [ordered]@{
  at = (Get-Date).ToString("o")
  label = $Label
  host = $env:COMPUTERNAME
  cpuSingleScore = [math]::Round([LeonidasBench]::CpuSingle(), 1)
  cpuMultiScore = [math]::Round([LeonidasBench]::CpuMulti(), 1)
  memoryCopyGBs = [math]::Round([LeonidasBench]::MemoryGBs(), 2)
  diskWriteMBs = [math]::Round([LeonidasBench]::DiskWriteMBs((Join-Path $env:TEMP "leonidas-bench.tmp")), 0)
  lastBootMs = $boot
  processes = (Get-Process).Count
  startupApps = @(Get-CimInstance Win32_StartupCommand).Count
  memoryUsedPct = [math]::Round(100 * (1 - $os.FreePhysicalMemory / $os.TotalVisibleMemorySize), 1)
}
$line = $result | ConvertTo-Json -Compress
Add-Content -Path (Join-Path $PSScriptRoot "benchmarks.jsonl") -Value $line
$line
`;

const BENCHMARK = (label: string) =>
  `powershell -NoProfile -ExecutionPolicy Bypass -File benchmark.ps1 -Label ${label}`;

const CHECKUP_CHECKS = [
  `Baseline: run \`${BENCHMARK("checkup")}\` first and report its scores, plus the last run in benchmarks.jsonl if one exists.`,
  "Alerts: for each open alert in the snapshot, give the most likely cause.",
  "Temperatures: CPU, GPU and each drive over the last 24 hours against their limits. Give the peak, when it happened, and the trend against the 7-day and 90-day history.",
  "Startup and background: top CPU and memory processes and startup entries (Get-Process sorted by CPU and memory, Get-CimInstance Win32_StartupCommand).",
  "Power plan: powercfg /getactivescheme, and for a laptop the battery state (powercfg /batteryreport).",
  "Drivers: GPU and chipset driver version and date (see MACHINE.md) against the latest available from the maker.",
  "Storage: free space per drive and drive health (Get-PhysicalDisk, Get-StorageReliabilityCounter).",
  "Windows Update: pending updates, last install date, reboot pending.",
];

const tuneChecks = (notesPath: string) => [
  `Benchmark before: run \`${BENCHMARK("before")}\` 3 times with other heavy apps closed, and keep the median of each score as the baseline.`,
  "Exact parts: from MACHINE.md and Get-CimInstance, list the CPU, graphics, memory sticks (rated and running speed), drives, board and BIOS, and whether this is a laptop or a desktop.",
  "Research: for each part, look up the maker's current driver and BIOS, the speed the memory is rated for (XMP or EXPO), and the settings the maker recommends. Cite the source link for each fact.",
  "Software load: startup entries, automatic services, background apps and scheduled tasks, ranked by measured cost. Mark each one keep, remove or unknown.",
  "Limits: temperatures and throttling in the last 24 hours, free space and health per drive, active power plan, pending Windows updates.",
  `Save: write ${notesPath} with the parts, the research and its links, the chosen strategy and why it fits this machine, and the ranked plan. Create the folder if needed.`,
];

export function buildAgentPrompt(
  kind: HardwarePrepareAgentInput["kind"],
  context: AgentContext,
  incidentPath: string,
  notesPath = "notes/machine.md",
): string {
  const alert = context.alert;
  const investigating = kind === "investigate" && alert;
  const tuning = kind === "tune";
  const goal = investigating
    ? `Find why this alert fired and how to fix it: ${alert.message} It started at ${new Date(alert.startedAt).toLocaleString()} and peaked at ${Math.round(alert.peak)}${alert.unit === "%" ? "%" : ` ${alert.unit}`}. Work read-only, then propose fixes. Change nothing until I approve each fix.`
    : tuning
      ? "Make this Windows PC as fast as it can safely be. Measure it, research its exact parts, plan the best fixes, apply each fix only after I approve it, then measure again to prove the gain. I may not know computer terms, so explain each step in plain words."
      : "Produce a read-only health checkup of this Windows PC, then a ranked list of fixes that make it faster, cooler and more reliable. Change nothing until I approve each fix.";
  const checks = investigating
    ? [
        "Evidence: read the alert, its readings and its limit in the snapshot, then compare the same metric against the 7-day and 90-day history to show whether this is new or normal.",
        `Cause: ${INVESTIGATE_FOCUS.find(([prefix]) => alert.metric.startsWith(prefix))?.[1] ?? "Find what changed around the time the alert started."}`,
        "Context: check the other open alerts and the last 24 hours for readings that moved together with this one.",
      ]
    : tuning
      ? tuneChecks(notesPath)
      : CHECKUP_CHECKS;
  const topFixes = investigating ? "3" : tuning ? "8" : "5";
  return [
    `Goal: ${goal}`,
    "",
    "Context",
    "- Rules: read AGENTS.md first. It defines the approve-first protocol and LOG.md.",
    "- Hardware summary: MACHINE.md",
    `- Snapshot (current readings, limits, open alerts, last 24 hours): ${incidentPath}`,
    `- History (NDJSON; minute points for 7 days, hour points for 90 days): ${context.historyDir}`,
    ...(investigating ? [] : ["- Speed test: benchmark.ps1, results in benchmarks.jsonl"]),
    ...(tuning ? [`- Notes for this machine (read first if it exists): ${notesPath}`] : []),
    "",
    `Checks (read-only${investigating ? "" : " except the speed test log"}; cite the number or file behind every finding)`,
    ...checks.map((check, index) => `${index + 1}. ${check}`),
    "",
    "Output",
    "1. Plain-English read of what the data shows, 5 sentences at most.",
    "2. Table: Area | Evidence | Status (ok / watch / fix) | Proposed fix | Risk.",
    `3. The top ${topFixes} fixes in order. For each: one action, expected gain, how to undo it. Then stop and wait for my yes.`,
    ...(tuning
      ? [
          `4. After my yes: make a restore point, apply one fix at a time, and log each in LOG.md. Then run \`${BENCHMARK("after")}\` 3 times and show a table of medians: Test | Before | After | Change. Call a change under 5% noise. Add the result to ${notesPath}.`,
        ]
      : []),
    "",
    "Done when",
    investigating
      ? "- The cause is named with the evidence for it, or marked unknown with the next thing to check."
      : tuning
        ? `- ${notesPath} holds the parts, the research links and the strategy, and benchmarks.jsonl has a before and an after run.`
        : '- Every check above has a finding, or "no issue" with its evidence.',
    tuning
      ? "- No file, setting or process was modified before my yes."
      : "- No file, setting or process was modified.",
    "- After I approve a change and it is made, LOG.md gets one dated entry for it.",
  ].join("\n");
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

const make = Effect.gen(function* () {
  const watch = yield* HardwareWatch;
  const projects = yield* Projects.ProjectService;
  const config = yield* ServerConfig.ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(config.baseDir, "system-care");

  const fail = (reason: HardwareWatchError["reason"]) => (cause: unknown) =>
    new HardwareWatchError({
      reason,
      detail: cause instanceof Error ? cause.message : String(cause),
    });

  const settings = yield* Effect.serviceOption(ServerSettingsService);

  // Research about this machine belongs in the owner's AIOS when one is connected, so every agent
  // that loads the AIOS knows the machine. Without an AIOS it stays in the PC Tuning folder.
  const notesPath = (inventory: HardwareInventory) =>
    Effect.gen(function* () {
      const current = Option.isSome(settings)
        ? yield* settings.value.getSettings.pipe(Effect.option)
        : Option.none();
      const aiosRoot = findAiosRoot([
        Option.isSome(current) ? current.value.aiosRoot : undefined,
        process.env.LEONIDAS_AIOS_ROOT,
        process.env.AIOS_ROOT,
      ]);
      const file = `${slug(inventory.os.hostname) || "this-pc"}.md`;
      return aiosRoot ? path.join(aiosRoot, "domains", "pc", file) : `notes/${file}`;
    });

  const ensureProject = Effect.gen(function* () {
    const saved = yield* watch.systemCareProjectId;
    if (saved) {
      const existing = yield* projects.getById(ProjectId.make(saved));
      if (Option.isSome(existing)) return existing.value.id;
    }
    const byRoot = yield* projects.getByWorkspaceRoot(root);
    const project = Option.isSome(byRoot)
      ? byRoot.value
      : yield* projects.create({
          commandId: CommandId.make(`system-care:project:${Date.now()}`),
          projectId: ProjectId.make(`system-care-${Date.now()}`),
          title: "PC Tuning",
          workspaceRoot: root,
          createWorkspaceRootIfMissing: true,
        });
    yield* watch.setSystemCareProjectId(project.id);
    return project.id;
  });

  const prepareAgent = (input: HardwarePrepareAgentInput) =>
    Effect.gen(function* () {
      if (input.kind === "investigate" && !input.alertId)
        return yield* new HardwareWatchError({
          reason: "invalid_input",
          detail: "alertId is required",
        });
      const context = yield* watch.agentContext(
        input.kind === "investigate" ? input.alertId : undefined,
      );
      yield* fs.makeDirectory(path.join(root, "incidents"), { recursive: true });
      yield* fs.writeFileString(path.join(root, "AGENTS.md"), SYSTEM_CARE_RULES);
      yield* fs.writeFileString(path.join(root, "CLAUDE.md"), "@AGENTS.md\n");
      yield* fs.writeFileString(path.join(root, "benchmark.ps1"), BENCHMARK_SCRIPT);
      yield* fs.writeFileString(path.join(root, "MACHINE.md"), machineSummary(context.inventory));
      if (!(yield* fs.exists(path.join(root, "LOG.md"))))
        yield* fs.writeFileString(path.join(root, "LOG.md"), "# PC Tuning log\n\n");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const incident = `incidents/${stamp}-${slug(context.alert?.label ?? "checkup")}.json`;
      yield* fs.writeFileString(
        path.join(root, incident),
        JSON.stringify(
          {
            kind: input.kind,
            alert: context.alert,
            openAlerts: context.alerts.filter((alert) => alert.resolvedAt === null),
            latestSample: context.sample,
            limits: context.limits,
            last24h: context.history,
          },
          null,
          1,
        ),
      );
      const projectId = yield* ensureProject;
      const title =
        input.kind === "investigate" && context.alert
          ? `Investigate: ${context.alert.label}`
          : input.kind === "tune"
            ? "Tune this PC"
            : "PC checkup";
      return {
        projectId,
        workspaceRoot: root,
        title,
        prompt: buildAgentPrompt(
          input.kind,
          context,
          incident,
          yield* notesPath(context.inventory),
        ),
      };
    }).pipe(
      Effect.mapError((cause) =>
        Schema.is(HardwareWatchError)(cause) ? cause : fail("launch")(cause),
      ),
    );

  return SystemCare.of({ prepareAgent });
});

export const layer = Layer.effect(SystemCare, make);
