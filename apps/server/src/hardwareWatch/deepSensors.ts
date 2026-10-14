/**
 * Deep sensors: LibreHardwareMonitor read from an elevated scheduled task.
 *
 * CPU temperatures, voltages and fans need the PawnIO kernel driver and admin rights. A one-time
 * elevated setup copies the sensor script and libraries into Program Files (admin-writable only)
 * and registers a task that runs them with highest privileges. The task never executes a file a
 * normal user can change, so registering it does not hand user-level code a path to admin. The
 * server then starts the task without a prompt and reads its output from ProgramData.
 */
import type { HardwareDeepSensorsState } from "@t3tools/contracts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const DEEP_SENSORS_TASK = "Leonidas Code Deep Sensors";
const LHM_VERSION = "0.9.6";
const LHM_ZIP_URL = `https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases/download/v${LHM_VERSION}/LibreHardwareMonitor.zip`;
const LHM_ZIP_SHA256 = "086d9f1b5a99e643edc2cfaaac16051685b551e4c5ac0b32a57c58c0e529c001";
/** Windows ERROR_CANCELLED: the user said no to the admin prompt. */
const UAC_DECLINED = 1223;

/** Runs elevated from Program Files; reads only numbers from the user-writable control file. */
const DEEP_SENSORS_SCRIPT = String.raw`param([string]$Control, [string]$Out)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
[void][Reflection.Assembly]::LoadFrom((Join-Path $here 'lib\LibreHardwareMonitorLib.dll'))
$computer = New-Object LibreHardwareMonitor.Hardware.Computer
$computer.IsCpuEnabled = $true
$computer.IsGpuEnabled = $true
$computer.IsMemoryEnabled = $true
$computer.IsMotherboardEnabled = $true
$computer.IsStorageEnabled = $true
$computer.IsControllerEnabled = $true
$computer.IsPsuEnabled = $true
$computer.Open()
$tmp = "$Out.tmp"
try {
  while ($true) {
    $interval = 15000
    $heartbeat = 0
    try {
      $ctl = Get-Content -Raw -LiteralPath $Control | ConvertFrom-Json
      if ($ctl.stop -eq $true) { break }
      $interval = [int]$ctl.intervalMs
      $heartbeat = [double]$ctl.heartbeatAt
    } catch { }
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    # The server refreshes the heartbeat while it runs; without it the task ends on its own.
    if ($now - $heartbeat -gt 120000) { break }
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($hardware in $computer.Hardware) {
      $hardware.Update()
      foreach ($item in @($hardware) + @($hardware.SubHardware)) {
        if ($item -ne $hardware) { $item.Update() }
        foreach ($sensor in $item.Sensors) {
          if ($null -ne $sensor.Value) {
            $rows.Add([pscustomobject]@{ id = $sensor.Identifier.ToString(); hardware = $item.Name; type = $sensor.SensorType.ToString(); name = $sensor.Name; value = [double]$sensor.Value })
          }
        }
      }
    }
    try {
      [pscustomobject]@{ writtenAt = $now; sensors = $rows } | ConvertTo-Json -Depth 3 -Compress | Set-Content -LiteralPath $tmp -Encoding UTF8
      Move-Item -LiteralPath $tmp -Destination $Out -Force
    } catch { }
    Start-Sleep -Milliseconds ([Math]::Max(500, [Math]::Min(60000, $interval)))
  }
} finally {
  $computer.Close()
  Remove-Item -LiteralPath $Out -ErrorAction SilentlyContinue
}
`;

const SETUP_SCRIPT = String.raw`param([string]$Source, [string]$Control, [string]$User)
$ErrorActionPreference = 'Stop'
if (-not (Get-Service -Name PawnIO -ErrorAction SilentlyContinue)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    & winget install --id namazso.PawnIO -e --silent --accept-package-agreements --accept-source-agreements | Out-Null
  }
}
$target = Join-Path $env:ProgramFiles 'Leonidas Code Deep Sensors'
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $target 'lib') | Out-Null
Copy-Item -Path (Join-Path $Source 'lib\*') -Destination (Join-Path $target 'lib') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $Source 'deep-sensors.ps1') -Destination $target -Force
$data = Join-Path $env:ProgramData 'Leonidas Code\deep-sensors'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$arguments = '--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $target 'deep-sensors.ps1') + '" -Control "' + $Control + '" -Out "' + (Join-Path $data 'sensors.json') + '"'
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument $arguments
$principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName '${DEEP_SENSORS_TASK}' -Action $action -Principal $principal -Settings $settings -Force | Out-Null
if (-not (Get-Service -Name PawnIO -ErrorAction SilentlyContinue)) { exit 3 }
exit 0
`;

const REMOVE_SCRIPT = String.raw`$ErrorActionPreference = 'SilentlyContinue'
Stop-ScheduledTask -TaskName '${DEEP_SENSORS_TASK}'
Unregister-ScheduledTask -TaskName '${DEEP_SENSORS_TASK}' -Confirm:$false
Start-Sleep -Seconds 2
Remove-Item -LiteralPath (Join-Path $env:ProgramFiles 'Leonidas Code Deep Sensors') -Recurse -Force
Remove-Item -LiteralPath (Join-Path $env:ProgramData 'Leonidas Code\deep-sensors') -Recurse -Force
exit 0
`;

/** Single-quoted PowerShell literal. */
const psQuote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export interface DeepSensorsPaths {
  /** User-writable staging folder holding `lib/` and `deep-sensors.ps1` before setup copies them. */
  readonly stagingDir: string;
  /** User-writable control file: interval, heartbeat and stop flag. */
  readonly controlFile: string;
  /** Where the elevated task writes readings (ProgramData). */
  readonly outputFile: string;
}

export const resolveDeepSensorsPaths = (
  hardwareDir: string,
  programData: string,
  path: Path.Path,
) => ({
  stagingDir: path.join(hardwareDir, "deep-sensors"),
  controlFile: path.join(hardwareDir, "deep-sensors-control.json"),
  outputFile: path.join(programData, "Leonidas Code", "deep-sensors", "sensors.json"),
});

export type ElevatedResult = Extract<
  HardwareDeepSensorsState,
  "on" | "needs-admin" | "driver-missing" | "error"
>;

const runPowerShell = (script: string, timeout: Duration.Input) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    return yield* spawner
      .exitCode(
        ChildProcess.make(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
          { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
        ),
      )
      .pipe(
        Effect.timeout(timeout),
        Effect.map(Number),
        Effect.orElseSucceed(() => -1),
      );
  });

/** Runs a script file elevated and waits; one admin prompt. */
const runElevated = (scriptFile: string, args: ReadonlyArray<string>) => {
  const argumentList = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    `"${scriptFile}"`,
    ...args,
  ].join(" ");
  return runPowerShell(
    `try { $p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList ${psQuote(argumentList)}; exit $p.ExitCode } catch { exit ${UAC_DECLINED} }`,
    "10 minutes",
  );
};

export const taskInstalled = runPowerShell(
  `if (Get-ScheduledTask -TaskName ${psQuote(DEEP_SENSORS_TASK)} -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }`,
  "20 seconds",
).pipe(Effect.map((code) => code === 0));

/** Starting a task the user registered needs no prompt, even though it runs elevated. */
export const startTask = runPowerShell(
  `Start-ScheduledTask -TaskName ${psQuote(DEEP_SENSORS_TASK)}`,
  "20 seconds",
).pipe(Effect.map((code) => code === 0));

/** Stages the pinned LibreHardwareMonitor build: the bundled copy if present, else a verified download. */
export const stageLibrary = Effect.fn("hardwareWatch.deepSensors.stageLibrary")(function* (
  paths: DeepSensorsPaths,
  bundledDir: string | null,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const libDir = path.join(paths.stagingDir, "lib");
  yield* fs.makeDirectory(paths.stagingDir, { recursive: true });
  yield* fs.writeFileString(path.join(paths.stagingDir, "deep-sensors.ps1"), DEEP_SENSORS_SCRIPT);
  const marker = path.join(libDir, "LibreHardwareMonitorLib.dll");
  if (yield* fs.exists(marker)) return true;
  if (bundledDir && (yield* fs.exists(path.join(bundledDir, "LibreHardwareMonitorLib.dll")))) {
    yield* fs.copy(bundledDir, libDir);
    return true;
  }
  const zip = path.join(paths.stagingDir, `lhm-${LHM_VERSION}.zip`);
  const code = yield* runPowerShell(
    [
      "$ProgressPreference = 'SilentlyContinue'",
      `Invoke-WebRequest -UseBasicParsing -Uri ${psQuote(LHM_ZIP_URL)} -OutFile ${psQuote(zip)}`,
      `if ((Get-FileHash -Algorithm SHA256 -LiteralPath ${psQuote(zip)}).Hash -ne ${psQuote(LHM_ZIP_SHA256.toUpperCase())}) { Remove-Item -LiteralPath ${psQuote(zip)}; exit 2 }`,
      `Expand-Archive -LiteralPath ${psQuote(zip)} -DestinationPath ${psQuote(libDir)} -Force`,
      `Remove-Item -LiteralPath ${psQuote(zip)}`,
      "exit 0",
    ].join("; "),
    "5 minutes",
  );
  return code === 0 && (yield* fs.exists(marker));
});

export const install = Effect.fn("hardwareWatch.deepSensors.install")(function* (
  paths: DeepSensorsPaths,
  user: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const setup = path.join(paths.stagingDir, "setup.ps1");
  yield* fs.writeFileString(setup, SETUP_SCRIPT);
  const code = yield* runElevated(setup, [
    "-Source",
    `"${paths.stagingDir}"`,
    "-Control",
    `"${paths.controlFile}"`,
    "-User",
    `"${user}"`,
  ]);
  yield* fs.remove(setup).pipe(Effect.ignore);
  const result: ElevatedResult =
    code === 0
      ? "on"
      : code === UAC_DECLINED
        ? "needs-admin"
        : code === 3
          ? "driver-missing"
          : "error";
  return result;
});

export const uninstall = Effect.fn("hardwareWatch.deepSensors.uninstall")(function* (
  paths: DeepSensorsPaths,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const remove = path.join(paths.stagingDir, "remove.ps1");
  yield* fs.makeDirectory(paths.stagingDir, { recursive: true });
  yield* fs.writeFileString(remove, REMOVE_SCRIPT);
  const code = yield* runElevated(remove, []);
  yield* fs.remove(remove).pipe(Effect.ignore);
  return code === 0;
});
