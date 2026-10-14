import * as Schema from "effect/Schema";

import {
  CommandId,
  NonNegativeInt,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";

const NullableNumber = Schema.NullOr(Schema.Number);
const NullableString = Schema.NullOr(Schema.String);

/** Static machine description, collected once per server start and on demand. */
export const HardwareInventory = Schema.Struct({
  collectedAt: NonNegativeInt,
  platform: Schema.String,
  os: Schema.Struct({
    name: Schema.String,
    version: Schema.String,
    architecture: Schema.String,
    hostname: Schema.String,
    bootedAt: Schema.NullOr(NonNegativeInt),
  }),
  cpu: Schema.Struct({
    name: Schema.String,
    vendor: NullableString,
    cores: Schema.NullOr(NonNegativeInt),
    threads: NonNegativeInt,
    baseClockMhz: NullableNumber,
    l2CacheKb: NullableNumber,
    l3CacheKb: NullableNumber,
    socket: NullableString,
    virtualizationEnabled: Schema.NullOr(Schema.Boolean),
  }),
  gpus: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      vendor: NullableString,
      driverVersion: NullableString,
      driverDate: NullableString,
      vramBytes: NullableNumber,
    }),
  ),
  memory: Schema.Struct({
    totalBytes: Schema.Number,
    modules: Schema.Array(
      Schema.Struct({
        slot: NullableString,
        capacityBytes: Schema.Number,
        speedMts: NullableNumber,
        configuredSpeedMts: NullableNumber,
        manufacturer: NullableString,
        partNumber: NullableString,
      }),
    ),
  }),
  disks: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      model: Schema.String,
      sizeBytes: Schema.Number,
      mediaType: Schema.Literals(["ssd", "hdd", "unknown"]),
      busType: NullableString,
      health: Schema.Literals(["healthy", "warning", "unhealthy", "unknown"]),
      firmware: NullableString,
      powerOnHours: NullableNumber,
      wearPct: NullableNumber,
    }),
  ),
  board: Schema.Struct({
    manufacturer: NullableString,
    product: NullableString,
    biosVersion: NullableString,
    biosDate: NullableString,
  }),
});
export type HardwareInventory = typeof HardwareInventory.Type;

export const HardwareGpuSample = Schema.Struct({
  index: NonNegativeInt,
  name: Schema.String,
  loadPct: NullableNumber,
  memoryControllerPct: NullableNumber,
  vramUsedBytes: NullableNumber,
  vramTotalBytes: NullableNumber,
  tempC: NullableNumber,
  hotspotC: NullableNumber,
  /** Hottest temperature before the driver slows the GPU, from the driver's own headroom. */
  slowdownTempC: NullableNumber,
  coreClockMhz: NullableNumber,
  memoryClockMhz: NullableNumber,
  powerW: NullableNumber,
  powerLimitW: NullableNumber,
  fanPct: NullableNumber,
  thermalThrottling: Schema.Boolean,
  powerThrottling: Schema.Boolean,
});
export type HardwareGpuSample = typeof HardwareGpuSample.Type;

export const HardwareVolumeSample = Schema.Struct({
  mount: Schema.String,
  label: NullableString,
  usedBytes: Schema.Number,
  totalBytes: Schema.Number,
});
export type HardwareVolumeSample = typeof HardwareVolumeSample.Type;

export const HardwareSensorReading = Schema.Struct({
  id: Schema.String,
  hardware: Schema.String,
  kind: Schema.String,
  name: Schema.String,
  value: Schema.Number,
  unit: Schema.String,
});
export type HardwareSensorReading = typeof HardwareSensorReading.Type;

/** One point-in-time reading. Every field a source cannot provide is null, never guessed. */
export const HardwareSample = Schema.Struct({
  at: NonNegativeInt,
  cpu: Schema.Struct({
    loadPct: NullableNumber,
    coreLoadPct: Schema.Array(Schema.Number),
    clockMhz: NullableNumber,
    packageTempC: NullableNumber,
    maxCoreTempC: NullableNumber,
    tjMaxC: NullableNumber,
    powerW: NullableNumber,
  }),
  memory: Schema.Struct({
    usedBytes: Schema.Number,
    totalBytes: Schema.Number,
  }),
  gpus: Schema.Array(HardwareGpuSample),
  disk: Schema.Struct({
    readBytesPerSec: NullableNumber,
    writeBytesPerSec: NullableNumber,
    activePct: NullableNumber,
  }),
  volumes: Schema.Array(HardwareVolumeSample),
  driveTemps: Schema.Array(
    Schema.Struct({ diskId: Schema.String, model: Schema.String, tempC: Schema.Number }),
  ),
  /** Raw Deep sensors readings (fans, voltages, every temperature). Empty when off. */
  sensors: Schema.Array(HardwareSensorReading),
});
export type HardwareSample = typeof HardwareSample.Type;

export const HardwareDeepSensorsState = Schema.Literals([
  "off",
  "starting",
  "on",
  "needs-admin",
  "driver-missing",
  "unavailable",
  "error",
]);
export type HardwareDeepSensorsState = typeof HardwareDeepSensorsState.Type;

export const HardwareWatchStatus = Schema.Struct({
  supported: Schema.Boolean,
  cadenceMs: NonNegativeInt,
  gpuSource: Schema.Literals(["nvidia-smi", "deep-sensors", "unavailable"]),
  counterSource: Schema.Literals(["typeperf", "unavailable"]),
  deepSensors: HardwareDeepSensorsState,
  deepSensorsMessage: NullableString,
  /** Drift alerts stay quiet until the machine baseline has this much history. */
  baselineReadyAt: Schema.NullOr(NonNegativeInt),
});
export type HardwareWatchStatus = typeof HardwareWatchStatus.Type;

export const HardwareAlertSeverity = Schema.Literals(["warning", "critical", "drift"]);
export type HardwareAlertSeverity = typeof HardwareAlertSeverity.Type;

export const HardwareAlert = Schema.Struct({
  id: TrimmedNonEmptyString,
  metric: Schema.String,
  label: Schema.String,
  severity: HardwareAlertSeverity,
  unit: Schema.String,
  value: Schema.Number,
  peak: Schema.Number,
  limit: Schema.Number,
  message: Schema.String,
  startedAt: NonNegativeInt,
  lastSeenAt: NonNegativeInt,
  resolvedAt: Schema.NullOr(NonNegativeInt),
  acknowledged: Schema.Boolean,
  threadId: Schema.NullOr(ThreadId),
});
export type HardwareAlert = typeof HardwareAlert.Type;

export const HardwareLimit = Schema.Struct({
  metric: Schema.String,
  label: Schema.String,
  unit: Schema.String,
  warn: Schema.Number,
  critical: Schema.Number,
  /** Seconds a breach must last before it alerts. */
  sustainSeconds: NonNegativeInt,
  source: Schema.Literals(["spec", "default", "user"]),
});
export type HardwareLimit = typeof HardwareLimit.Type;

export const HardwareLiveEvent = Schema.Struct({
  status: HardwareWatchStatus,
  sample: Schema.NullOr(HardwareSample),
  alerts: Schema.Array(HardwareAlert),
});
export type HardwareLiveEvent = typeof HardwareLiveEvent.Type;

export const HardwareHistoryRange = Schema.Literals(["1h", "24h", "7d", "90d"]);
export type HardwareHistoryRange = typeof HardwareHistoryRange.Type;

export const HardwareHistoryPoint = Schema.Struct({
  at: NonNegativeInt,
  avg: Schema.Record(Schema.String, Schema.Number),
  max: Schema.Record(Schema.String, Schema.Number),
});
export type HardwareHistoryPoint = typeof HardwareHistoryPoint.Type;

export const HardwareHistory = Schema.Struct({
  range: HardwareHistoryRange,
  resolutionMs: NonNegativeInt,
  points: Schema.Array(HardwareHistoryPoint),
});
export type HardwareHistory = typeof HardwareHistory.Type;

export const HardwareHistoryInput = Schema.Struct({ range: HardwareHistoryRange });
export const HardwareInventoryInput = Schema.Struct({ refresh: Schema.optional(Schema.Boolean) });

export const HardwareLimitsResult = Schema.Struct({ limits: Schema.Array(HardwareLimit) });
export type HardwareLimitsResult = typeof HardwareLimitsResult.Type;

export const HardwareSetLimitInput = Schema.Struct({
  metric: TrimmedNonEmptyString,
  /** Null clears the override and returns to the spec or default limit. */
  warn: NullableNumber,
  critical: NullableNumber,
});
export type HardwareSetLimitInput = typeof HardwareSetLimitInput.Type;

export const HardwareAcknowledgeAlertInput = Schema.Struct({
  alertId: TrimmedNonEmptyString,
  acknowledged: Schema.Boolean,
});
export type HardwareAcknowledgeAlertInput = typeof HardwareAcknowledgeAlertInput.Type;

export const HardwareSetDeepSensorsInput = Schema.Struct({ enabled: Schema.Boolean });
export type HardwareSetDeepSensorsInput = typeof HardwareSetDeepSensorsInput.Type;

/**
 * Writes the context files an agent needs and returns the prompt text. It never starts a thread or
 * sends anything: the person pastes or sends the prompt themselves.
 */
export const HardwarePrepareAgentInput = Schema.Struct({
  kind: Schema.Literals(["investigate", "checkup"]),
  alertId: Schema.optional(TrimmedNonEmptyString),
});
export type HardwarePrepareAgentInput = typeof HardwarePrepareAgentInput.Type;

export const HardwarePrepareAgentResult = Schema.Struct({
  projectId: ProjectId,
  /** Folder the prompt's file references are relative to. */
  workspaceRoot: Schema.String,
  title: Schema.String,
  prompt: Schema.String,
});
export type HardwarePrepareAgentResult = typeof HardwarePrepareAgentResult.Type;

export class HardwareWatchError extends Schema.TaggedError<HardwareWatchError>()(
  "HardwareWatchError",
  {
    reason: Schema.Literals(["unsupported", "not_found", "invalid_input", "launch", "storage"]),
    detail: Schema.optional(Schema.String),
  },
) {
  override get message(): string {
    return `System Care failed (${this.reason})${this.detail ? `: ${this.detail}` : ""}.`;
  }
}
