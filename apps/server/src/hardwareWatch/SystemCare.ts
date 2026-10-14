// @effect-diagnostics globalDate:off globalDateInEffect:off preferSchemaOverJson:off
/**
 * Prepares System Care agent prompts. Every investigation and checkup is meant to run in one
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

export const SYSTEM_CARE_RULES = `# System Care

You are helping the owner of this computer keep it healthy. This folder is your notebook:
\`MACHINE.md\` describes the hardware, \`incidents/\` holds one file per investigation, and
\`LOG.md\` is a running log you append to.

## Rules

1. Diagnose first, read-only. Use system tools (Task Manager data, PowerShell \`Get-Process\`,
   \`Get-CimInstance\`, \`Get-Counter\`, \`powercfg\`, event logs) to find the cause.
2. Never change the system without asking. Before every change (ending a process, changing a
   power plan, editing the registry, updating or removing drivers or software, changing startup
   apps, deleting files) explain in plain words what you will do, why, and how to undo it, then
   wait for the owner to approve that specific change.
3. Prefer reversible fixes. Note the undo step in \`LOG.md\` for every change made.
4. Physical causes (dust, fans, thermal paste, airflow) cannot be fixed from software: say so
   plainly and give the owner simple steps.
5. Finish with a short summary: the cause, what changed, what to watch, and append it to
   \`LOG.md\` with the date.
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

export function buildAgentPrompt(
  kind: HardwarePrepareAgentInput["kind"],
  context: AgentContext,
  incidentPath: string,
): string {
  const alert = context.alert;
  const intro =
    kind === "investigate" && alert
      ? [
          `Leonidas Code's System Care watcher raised a ${alert.severity} alert: ${alert.message}`,
          `It started at ${new Date(alert.startedAt).toLocaleString()} and peaked at ${Math.round(alert.peak)}${alert.unit === "%" ? "%" : ` ${alert.unit}`}.`,
          "",
          "Find out why this is happening and how to fix it.",
        ]
      : [
          "Run a full health checkup of this computer and suggest how to make it faster, cooler and more reliable.",
          "Cover: startup apps and background programs using a lot of CPU or memory, the power plan, driver age (especially the GPU and chipset), free disk space, drive health, temperatures over the last day, and Windows Update state.",
        ];
  return [
    ...intro,
    "",
    "Follow the rules in AGENTS.md: diagnose read-only first, then propose fixes and wait for my approval before each change.",
    "",
    `- Hardware summary: MACHINE.md`,
    `- Snapshot of current readings, limits, open alerts and the last 24 hours: ${incidentPath}`,
    `- Full history (minute points for 7 days, hour points for 90 days, NDJSON): ${context.historyDir}`,
    "",
    "Start with a short plain-English read of what the data shows, then your diagnosis steps.",
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
          title: "System Care",
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
      yield* fs.writeFileString(path.join(root, "MACHINE.md"), machineSummary(context.inventory));
      if (!(yield* fs.exists(path.join(root, "LOG.md"))))
        yield* fs.writeFileString(path.join(root, "LOG.md"), "# System Care log\n\n");
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
          : "System checkup";
      return {
        projectId,
        workspaceRoot: root,
        title,
        prompt: buildAgentPrompt(input.kind, context, incident),
      };
    }).pipe(
      Effect.mapError((cause) =>
        Schema.is(HardwareWatchError)(cause) ? cause : fail("launch")(cause),
      ),
    );

  return SystemCare.of({ prepareAgent });
});

export const layer = Layer.effect(SystemCare, make);
