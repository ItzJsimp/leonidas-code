// @effect-diagnostics nodeBuiltinImport:off globalFetch:off globalDate:off - one-shot installer for the per-user Laya pack. It runs only after the user agrees in onboarding.
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeStream from "node:stream";
import * as NodeStreamPromises from "node:stream/promises";

import type { LayaSetupResult } from "@t3tools/contracts";

const RELEASE_URL = "https://github.com/ItzJsimp/leonidas-code/releases/download/laya-model-v1";
const REQUIRED_PACKAGES = ["onnxruntime", "tokenizers", "numpy"] as const;
const PYTHON_CANDIDATES: ReadonlyArray<ReadonlyArray<string>> = [
  ["python"],
  ["python3"],
  ["py", "-3"],
];

/** Reference SHA-256 values. Keep in step with scripts/laya/MODEL.md in the AIOS. */
export const LAYA_FILES: ReadonlyArray<{
  readonly name: string;
  readonly sha256: string;
  readonly kind: "model" | "pack";
}> = [
  {
    name: "laya_int8.onnx",
    sha256: "50dd3f0a1585fd8bf931faf457921754183603ac0976cc5cce197cb55627233a",
    kind: "model",
  },
  {
    name: "tokenizer.json",
    sha256: "6c8aaa9a542084f2457eab775d4eeb51f92a70c0fd9de28d5edb0ddec3c08d30",
    kind: "model",
  },
  {
    name: "laya-pack.zip",
    sha256: "838e5425b0db3faa51efe332b65f09eb7ba48457933553da9343b2b363ad921d",
    kind: "pack",
  },
];

export const layaPaths = (home: string = NodeOS.homedir()) => ({
  pack: NodePath.join(home, ".leonidas", "laya"),
  model: NodePath.join(home, ".leonidas", "models", "laya"),
});

const run = (
  command: string,
  args: ReadonlyArray<string>,
  timeoutMs = 600_000,
): Promise<{ readonly code: number; readonly out: string }> =>
  new Promise((resolve) => {
    NodeChildProcess.execFile(
      command,
      [...args],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 4_000_000 },
      (error, stdout, stderr) =>
        resolve({
          code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
          out: `${stdout}${stderr}`,
        }),
    );
  });

export interface LayaProbe {
  readonly python: ReadonlyArray<string> | null;
  readonly version: string | null;
  readonly missingPackages: ReadonlyArray<string>;
}

const PROBE_CODE =
  "import sys,importlib.util as u;print('%d.%d'%sys.version_info[:2]);" +
  `print(','.join(m for m in ${JSON.stringify(REQUIRED_PACKAGES)} if u.find_spec(m) is None))`;

/** Finds Python 3.9+ and lists the missing packages. Installs nothing. */
export async function probeLaya(): Promise<LayaProbe> {
  for (const candidate of PYTHON_CANDIDATES) {
    const [command, ...prefix] = candidate;
    if (!command) continue;
    const result = await run(command, [...prefix, "-c", PROBE_CODE], 20_000);
    if (result.code !== 0) continue;
    const [version = "", missing = ""] = result.out.trim().split(/\r?\n/);
    const [major = 0, minor = 0] = version.split(".").map(Number);
    if (major < 3 || (major === 3 && minor < 9)) continue;
    return {
      python: candidate,
      version,
      missingPackages: missing ? missing.split(",") : [],
    };
  }
  return { python: null, version: null, missingPackages: [] };
}

export const sha256OfFile = async (path: string): Promise<string> => {
  const hash = NodeCrypto.createHash("sha256");
  await NodeStreamPromises.pipeline(NodeFS.createReadStream(path), hash);
  return hash.digest("hex");
};

async function download(url: string, target: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}).`);
  await NodeStreamPromises.pipeline(
    NodeStream.Readable.fromWeb(response.body as never),
    NodeFS.createWriteStream(target),
  );
}

let current: LayaSetupResult = { status: "idle", message: "", missingPackages: [] };
let running = false;

/** Folders that belong to another AIOS and need the user's explicit yes before any write. */
const PROTECTED_FOLDER = /simplygersi/i;

/**
 * Adds the thin Laya launchers to one project folder. The pack must be installed first.
 * Returns a result and leaves the install state untouched.
 */
export async function wireLayaProject(input: {
  readonly projectPath: string;
  readonly confirmed: boolean;
  readonly home?: string;
}): Promise<LayaSetupResult> {
  const fail = (message: string): LayaSetupResult => ({
    status: "error",
    message,
    missingPackages: [],
  });
  const folder = NodePath.resolve(input.projectPath);
  const isDirectory = await NodeFSP.stat(folder).then(
    (stat) => stat.isDirectory(),
    () => false,
  );
  if (!isDirectory) return fail("That folder does not exist.");
  if (PROTECTED_FOLDER.test(folder) && !input.confirmed) {
    return fail("This folder belongs to another AIOS. Confirm before Laya writes there.");
  }
  const script = NodePath.join(layaPaths(input.home).pack, "install_pack.py");
  const exists = await NodeFSP.stat(script).then(
    () => true,
    () => false,
  );
  if (!exists) return fail("Install Laya first, then add it to a project.");
  const probe = await probeLaya();
  const [python, ...prefix] = probe.python ?? [];
  if (!python) return fail("Laya needs Python 3.9 or newer.");
  const result = await run(python, [...prefix, script, "--wire-only", "--wire", folder], 60_000);
  if (result.code !== 0) return fail("Laya could not be added to that folder.");
  return { status: "ready", message: `Laya is on in ${folder}.`, missingPackages: [] };
}

export const layaSetupState = (): LayaSetupResult => current;

const set = (next: LayaSetupResult): void => {
  current = next;
};

/** Reads state from disk and the probe. Used when no install is running. */
export async function layaStatus(home?: string): Promise<LayaSetupResult> {
  if (running || current.status !== "idle") return current;
  const paths = layaPaths(home);
  const present = await Promise.all([
    NodeFSP.stat(NodePath.join(paths.model, "laya_int8.onnx")).then(
      () => true,
      () => false,
    ),
    NodeFSP.stat(NodePath.join(paths.pack, "engine.py")).then(
      () => true,
      () => false,
    ),
  ]);
  const probe = await probeLaya();
  if (present[0] && present[1]) {
    return { status: "ready", message: "Laya is installed.", missingPackages: [] };
  }
  if (!probe.python) {
    return {
      status: "needs-python",
      message: "Laya needs Python 3.9 or newer. Install Python, then try again.",
      missingPackages: [],
    };
  }
  return {
    status: probe.missingPackages.length > 0 ? "needs-packages" : "idle",
    message:
      probe.missingPackages.length > 0
        ? `Python packages missing: ${probe.missingPackages.join(", ")}.`
        : "",
    missingPackages: probe.missingPackages,
  };
}

/**
 * Starts the install in the background and returns at once. The web step polls
 * `layaSetupState`. Pip runs only when the caller passes `installPackages`.
 */
export function startLayaInstall(input: {
  readonly installPackages: boolean;
  readonly home?: string;
}): LayaSetupResult {
  if (running) return current;
  running = true;
  set({ status: "working", message: "Checking Python.", missingPackages: [] });
  void install(input)
    .catch((error: unknown) => {
      set({
        status: "error",
        message: error instanceof Error ? error.message : "The install failed.",
        missingPackages: [],
      });
    })
    .finally(() => {
      running = false;
    });
  return current;
}

async function install(input: {
  readonly installPackages: boolean;
  readonly home?: string | undefined;
}): Promise<void> {
  const paths = layaPaths(input.home);
  const probe = await probeLaya();
  if (!probe.python) {
    set({
      status: "needs-python",
      message: "Laya needs Python 3.9 or newer. Install Python, then try again.",
      missingPackages: [],
    });
    return;
  }
  const [python, ...prefix] = probe.python;
  if (!python) return;
  if (probe.missingPackages.length > 0) {
    if (!input.installPackages) {
      set({
        status: "needs-packages",
        message: `Python packages missing: ${probe.missingPackages.join(", ")}.`,
        missingPackages: probe.missingPackages,
      });
      return;
    }
    set({ status: "working", message: "Installing Python packages.", missingPackages: [] });
    const pip = await run(python, [
      ...prefix,
      "-m",
      "pip",
      "install",
      "--user",
      ...probe.missingPackages,
    ]);
    if (pip.code !== 0) {
      set({
        status: "error",
        message: "pip could not install the packages. Install them by hand, then try again.",
        missingPackages: probe.missingPackages,
      });
      return;
    }
  }

  const temp = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "laya-"));
  try {
    for (const file of LAYA_FILES) {
      set({ status: "working", message: `Downloading ${file.name}.`, missingPackages: [] });
      const target = NodePath.join(temp, file.name);
      await download(`${RELEASE_URL}/${file.name}`, target);
      if ((await sha256OfFile(target)) !== file.sha256) {
        set({
          status: "error",
          message: `${file.name} did not match its checksum, so Leonidas Code did not use it.`,
          missingPackages: [],
        });
        return;
      }
    }
    set({ status: "working", message: "Installing the safety checks.", missingPackages: [] });
    const staged = NodePath.join(temp, "pack");
    const unzip = await run(python, [
      ...prefix,
      "-c",
      "import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
      NodePath.join(temp, "laya-pack.zip"),
      staged,
    ]);
    if (unzip.code !== 0) throw new Error("The Laya pack could not be unpacked.");
    const setup = await run(python, [
      ...prefix,
      NodePath.join(staged, "laya", "install_pack.py"),
      "--dest",
      paths.pack,
      "--no-model",
    ]);
    if (setup.code !== 0) throw new Error("The Laya pack could not be installed.");
    await NodeFSP.mkdir(paths.model, { recursive: true });
    for (const file of LAYA_FILES.filter((entry) => entry.kind === "model")) {
      await NodeFSP.copyFile(NodePath.join(temp, file.name), NodePath.join(paths.model, file.name));
    }
    const health = await run(
      python,
      [...prefix, NodePath.join(paths.pack, "engine.py"), "health"],
      120_000,
    );
    if (health.code !== 0 || !/ready/i.test(health.out)) {
      set({
        status: "error",
        message: "Laya installed but the health check did not pass.",
        missingPackages: [],
      });
      return;
    }
    set({ status: "ready", message: "Laya is installed and ready.", missingPackages: [] });
  } finally {
    await NodeFSP.rm(temp, { recursive: true, force: true });
  }
}
