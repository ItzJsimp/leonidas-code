import { decide, Decision } from "./decider.js";
import { JevClientProtocol } from "./typesafeClient.js";

export type RecoveryAction =
  | "retry_unchanged"
  | "retry_after_install"
  | "fix_path_and_retry"
  | "switch_tool"
  | "escalate_to_opus"
  | "stop_and_report";

export const RECOVERY_OPTIONS: RecoveryAction[] = [
  "retry_unchanged",
  "retry_after_install",
  "fix_path_and_retry",
  "switch_tool",
  "escalate_to_opus",
  "stop_and_report",
];

export interface RecoveryPlan {
  action: RecoveryAction;
  decision: Decision;
  attempt: number;
  tool: string;
  command: string;
  remediationCmd?: string;
  suggestedFix?: string;
  requiresHuman: boolean;
  requiresOpus: boolean;
}

export function extractMissingPackage(errorText: string): { pkg: string; manager: string } | null {
  const nodeMatch = errorText.match(/Cannot find module ['"]([^'"\./][^'"]*)['"]/);
  if (nodeMatch) return { pkg: nodeMatch[1].split("/")[0], manager: "npm" };

  const pyMatch = errorText.match(/No module named ['"]([^'"]+)['"]/);
  if (pyMatch) return { pkg: pyMatch[1].split(".")[0], manager: "pip" };

  return null;
}

export async function recoverFailure(
  tool: string,
  command: string,
  error: string,
  attempt: number,
  client: JevClientProtocol,
  maxAttempts = 3,
  threshold = 0.8,
): Promise<RecoveryPlan> {
  // 1. Hard cap in code
  if (attempt >= maxAttempts) {
    const dummyDecision: Decision = {
      answer: "stop_and_report",
      prob: 1.0,
      probs: { stop_and_report: 1.0 },
      confident: true,
      threshold,
      question: "Attempt cap reached",
    };
    return {
      action: "stop_and_report",
      decision: dummyDecision,
      attempt,
      tool,
      command,
      requiresHuman: true,
      requiresOpus: false,
      suggestedFix: `Halt: Max retry attempts (${maxAttempts}) exceeded. Hand off to human engineer.`,
    };
  }

  const context = `TOOL: ${tool}\nCOMMAND: ${command}\nATTEMPT: ${attempt}\nERROR:\n${error.slice(-4000)}`;
  const decision = await decide(
    client,
    context,
    "What is the best next move after this failure?",
    RECOVERY_OPTIONS,
    threshold,
  );

  if (!decision.confident) {
    return {
      action: "escalate_to_opus",
      decision,
      attempt,
      tool,
      command,
      requiresHuman: false,
      requiresOpus: true,
      suggestedFix: "Low confidence: escalate stack trace to Opus 5.5 for root cause analysis.",
    };
  }

  const action = decision.answer as RecoveryAction;
  let remediationCmd: string | undefined;
  let suggestedFix: string | undefined;

  if (action === "retry_after_install") {
    const missing = extractMissingPackage(error);
    if (missing) {
      remediationCmd = `${missing.manager} install ${missing.pkg}`;
      suggestedFix = `Install missing package: \`${remediationCmd}\` then rerun.`;
    } else {
      suggestedFix = "Install missing dependency then retry.";
    }
  } else if (action === "fix_path_and_retry") {
    suggestedFix = "Correct invalid file path or directory parameter and retry.";
  } else if (action === "retry_unchanged") {
    suggestedFix = "Wait brief backoff and retry unchanged (transient network error).";
  } else if (action === "switch_tool") {
    suggestedFix = `Switch from '${tool}' to alternative tool capable of executing this operation.`;
  } else if (action === "stop_and_report") {
    suggestedFix = "Stop execution and report blocking defect to user.";
  }

  return {
    action,
    decision,
    attempt,
    tool,
    command,
    remediationCmd,
    suggestedFix,
    requiresHuman: action === "stop_and_report",
    requiresOpus: action === "escalate_to_opus",
  };
}
