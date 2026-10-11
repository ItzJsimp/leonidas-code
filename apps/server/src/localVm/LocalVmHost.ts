import {
  LocalVmError,
  LocalVmAction,
  type LocalVmScreenshot,
  type LocalVmSummary,
} from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as ProcessRunner from "../processRunner.ts";

export class LocalVmHost extends Context.Service<
  LocalVmHost,
  {
    readonly list: Effect.Effect<
      { available: boolean; reason?: string; vms: readonly LocalVmSummary[] },
      LocalVmError
    >;
    readonly screenshot: (vmId: string) => Effect.Effect<LocalVmScreenshot, LocalVmError>;
    readonly input: (vmId: string, action: LocalVmAction) => Effect.Effect<void, LocalVmError>;
  }
>()("t3/localVm/LocalVmHost") {}

// Constant source, structured stdin. This COM console never sends input to the host desktop.
const mouseScript = `
$ErrorActionPreference = 'Stop'
$p = [Console]::In.ReadToEnd() | ConvertFrom-Json
$vbox = New-Object -ComObject VirtualBox.VirtualBox
$session = New-Object -ComObject VirtualBox.Session
$machine = $vbox.FindMachine([string]$p.vmId)
$locked = $false
try {
  $machine.LockMachine($session, 1)
  $locked = $true
  $mouse = $session.Console.Mouse
  if (-not $mouse.AbsoluteSupported) { throw 'Guest absolute mouse input unavailable.' }
  $x = [int]$p.action.x + 1
  $y = [int]$p.action.y + 1
  $mouse.PutMouseEventAbsolute($x, $y, 0, 0, 0)
  if ($p.action.kind -eq 'click') {
    $mask = [int](@{ left = 1; right = 2; middle = 4 }[[string]$p.action.button])
    try {
      $mouse.PutMouseEventAbsolute($x, $y, 0, 0, $mask)
      Start-Sleep -Milliseconds 80
    } finally { $mouse.PutMouseEventAbsolute($x, $y, 0, 0, 0) }
  } elseif ($p.action.kind -eq 'scroll') {
    $mouse.PutMouseEventAbsolute($x, $y, [int]$p.action.steps, 0, 0)
  }
} finally { if ($locked) { $session.UnlockMachine() } }
`;
const keys = {
  enter: ["1c", "9c"],
  tab: ["0f", "8f"],
  escape: ["01", "81"],
  backspace: ["0e", "8e"],
  delete: ["e0", "53", "e0", "d3"],
  "ctrl+a": ["1d", "1e", "9e", "9d"],
  "ctrl+c": ["1d", "2e", "ae", "9d"],
  "ctrl+v": ["1d", "2f", "af", "9d"],
  "alt+f4": ["38", "3e", "be", "b8"],
  "win+r": ["e0", "5b", "13", "93", "e0", "db"],
} as const;

const isLocalVmError = Schema.is(LocalVmError);
const encodeMouse = Schema.encodeEffect(
  Schema.fromJsonString(Schema.Struct({ vmId: Schema.String, action: LocalVmAction })),
);
const make = Effect.gen(function* () {
  const runner = yield* ProcessRunner.ProcessRunner;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const platform = yield* HostProcess.Platform;
  const env = yield* HostProcess.Environment;
  const executable =
    env.T3CODE_VBOXMANAGE ??
    path.join(
      env.VBOX_MSI_INSTALL_PATH ??
        path.join(env.ProgramFiles ?? "C:\\Program Files", "Oracle", "VirtualBox"),
      "VBoxManage.exe",
    );
  const run = Effect.fn("LocalVmHost.run")(function* (
    command: string,
    args: readonly string[],
    stdin?: string,
  ) {
    if (platform !== "win32") return yield* new LocalVmError({ reason: "unavailable" });
    const result = yield* runner
      .run({
        command,
        args,
        ...(stdin === undefined ? {} : { stdin }),
        timeout: "15 seconds",
        maxOutputBytes: 1024 * 1024,
      })
      .pipe(Effect.mapError((cause) => new LocalVmError({ reason: "operation-failed", cause })));
    if (result.code !== 0)
      return yield* new LocalVmError({
        reason: "operation-failed",
        cause: new Error(result.stderr || `VirtualBox command exited with code ${result.code}`),
      });
    return result.stdout;
  });
  const list = Effect.gen(function* () {
    if (platform !== "win32" || !(yield* fs.exists(executable)))
      return {
        available: false,
        reason: "Install VirtualBox on the Windows machine running this environment's server.",
        vms: [],
      };
    const registered = yield* run(executable, ["list", "vms"]);
    const running = yield* run(executable, ["list", "runningvms"]);
    const vms = registered.split(/\r?\n/).flatMap((line) => {
      const match = /^"(.*)" \{([0-9a-f-]+)\}$/i.exec(line);
      return match
        ? [{ id: match[2]!, name: match[1]!, running: running.includes(`{${match[2]}}`) }]
        : [];
    });
    return { available: true, vms };
  }).pipe(
    Effect.mapError((cause) =>
      isLocalVmError(cause) ? cause : new LocalVmError({ reason: "operation-failed", cause }),
    ),
  );
  const screenshot = Effect.fn("LocalVmHost.screenshot")(
    function* (vmId: string) {
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "leonidas-guest-" });
      const file = path.join(dir, "screen.png");
      yield* run(executable, ["controlvm", vmId, "screenshotpng", file]);
      const bytes = Buffer.from(yield* fs.readFile(file));
      if (
        bytes.length < 24 ||
        bytes.readUInt32BE(0) !== 0x89504e47 ||
        bytes.toString("ascii", 12, 16) !== "IHDR"
      )
        return yield* new LocalVmError({ reason: "operation-failed" });
      const width = bytes.readUInt32BE(16),
        height = bytes.readUInt32BE(20);
      if (width === 0 || height === 0)
        return yield* new LocalVmError({ reason: "operation-failed" });
      return { mimeType: "image/png" as const, data: bytes.toString("base64"), width, height };
    },
    Effect.scoped,
    Effect.mapError((cause) =>
      isLocalVmError(cause) ? cause : new LocalVmError({ reason: "operation-failed", cause }),
    ),
  );
  const input = Effect.fn("LocalVmHost.input")(function* (vmId: string, action: LocalVmAction) {
    if (action.kind === "type")
      yield* run(executable, ["controlvm", vmId, "keyboardputstring", action.text]);
    else if (action.kind === "key")
      yield* run(executable, ["controlvm", vmId, "keyboardputscancode", ...keys[action.key]]);
    else
      yield* run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(mouseScript, "utf16le").toString("base64"),
        ],
        yield* encodeMouse({ vmId, action }).pipe(
          Effect.mapError((cause) => new LocalVmError({ reason: "invalid-input", cause })),
        ),
      );
  });
  return LocalVmHost.of({ list, screenshot, input });
});
export const layer = Layer.effect(LocalVmHost, make);
