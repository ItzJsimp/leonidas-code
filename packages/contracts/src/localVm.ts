import * as Schema from "effect/Schema";
import { ThreadId, NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const LocalVmSummary = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: Schema.String,
  running: Schema.Boolean,
});
export type LocalVmSummary = typeof LocalVmSummary.Type;
export const LocalVmSession = Schema.Struct({
  threadId: ThreadId,
  vmId: Schema.String,
  paused: Schema.Boolean,
});
export type LocalVmSession = typeof LocalVmSession.Type;
export const LocalVmState = Schema.Struct({
  available: Schema.Boolean,
  reason: Schema.optional(Schema.String),
  vms: Schema.Array(LocalVmSummary),
  sessions: Schema.Array(LocalVmSession),
});
export type LocalVmState = typeof LocalVmState.Type;
export const LocalVmTarget = Schema.Struct({ threadId: ThreadId });
export const LocalVmConnectInput = Schema.Struct({
  threadId: ThreadId,
  vmId: TrimmedNonEmptyString,
});
export const LocalVmPauseInput = Schema.Struct({ threadId: ThreadId, paused: Schema.Boolean });
export const LocalVmAction = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("click"),
    x: NonNegativeInt,
    y: NonNegativeInt,
    button: Schema.Literals(["left", "right", "middle"]),
  }),
  Schema.Struct({ kind: Schema.Literal("move"), x: NonNegativeInt, y: NonNegativeInt }),
  Schema.Struct({
    kind: Schema.Literal("scroll"),
    x: NonNegativeInt,
    y: NonNegativeInt,
    steps: Schema.Int.check(Schema.isBetween({ minimum: -100, maximum: 100 })),
  }),
  Schema.Struct({
    kind: Schema.Literal("type"),
    text: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(2000),
      Schema.isPattern(/^[\x20-\x7e]+$/),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("key"),
    key: Schema.Literals([
      "enter",
      "tab",
      "escape",
      "backspace",
      "delete",
      "ctrl+a",
      "ctrl+c",
      "ctrl+v",
      "alt+f4",
      "win+r",
    ]),
  }),
]);
export type LocalVmAction = typeof LocalVmAction.Type;
export const LocalVmInput = Schema.Struct({ threadId: ThreadId, action: LocalVmAction });
export const LocalVmScreenshot = Schema.Struct({
  mimeType: Schema.Literal("image/png"),
  data: Schema.String,
  width: NonNegativeInt,
  height: NonNegativeInt,
});
export type LocalVmScreenshot = typeof LocalVmScreenshot.Type;
export const LocalVmScreenshotResult = Schema.Struct({
  session: LocalVmSession,
  screenshot: LocalVmScreenshot,
});
export type LocalVmScreenshotResult = typeof LocalVmScreenshotResult.Type;
export class LocalVmError extends Schema.TaggedError<LocalVmError>()("LocalVmError", {
  reason: Schema.Literals([
    "unavailable",
    "not-running",
    "owned",
    "not-connected",
    "paused",
    "bounds",
    "invalid-input",
    "operation-failed",
  ]),
  cause: Schema.optional(Schema.Defect()),
}) {
  override get message(): string {
    const messages = {
      unavailable: "Local AI Desktop requires VirtualBox on a Windows server host.",
      "not-running": "Start the selected VM in VirtualBox before connecting.",
      owned: "This VM is controlled by another thread. Release it there first.",
      "not-connected": "Connect a VM to this thread in AI Desktop first.",
      paused: "AI input is paused. The user must resume it in AI Desktop.",
      bounds: "Coordinates must be inside the current guest screenshot.",
      "invalid-input": "Use a supported guest key or printable ASCII text.",
      "operation-failed": "VirtualBox guest operation failed. Check the VM and reconnect.",
    };
    return messages[this.reason];
  }
}
