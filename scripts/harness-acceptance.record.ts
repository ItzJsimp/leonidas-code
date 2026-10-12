// @effect-diagnostics nodeBuiltinImport:off - Opt-in, isolated acceptance artifacts.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

/** Called only after the fixture's behavioral assertions succeed. */
export function recordAcceptance(id: string, samplesMs: readonly number[]) {
  const directory = process.env.LEONIDAS_ACCEPTANCE_OUTPUT_DIR;
  if (!directory) return;
  if (samplesMs.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Invalid acceptance measurement");
  }
  NodeFS.appendFileSync(
    NodePath.join(directory, "runtime.jsonl"),
    JSON.stringify({ id, samplesMs }) + "\n",
  );
}

export function recoverySampleCount() {
  const value = Number(process.env.LEONIDAS_ACCEPTANCE_RECOVERY_SAMPLES ?? 1);
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new Error("Recovery sample count must be an integer from 1 through 20");
  }
  return value;
}
