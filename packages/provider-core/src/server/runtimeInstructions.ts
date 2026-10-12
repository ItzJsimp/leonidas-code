import { LEONIDAS_OUTPUT_STANDARD } from "./outputStandard.ts";
import { USER_QUESTION_INSTRUCTIONS } from "./userQuestionInstructions.ts";

const PULL_REQUEST_LINKING_INSTRUCTIONS = `<pull_request_linking>
When the t3-code MCP server exposes link_pull_request, register every PR you create or work on for this thread. Call it with the full PR URL immediately after creating a PR or starting work on an existing one, and for every layer of a stack. This also applies to PRs made through gh, gh stack, another CLI, or the host API, which do not register them. Linking an already-linked PR is safe. Before finishing PR work, call list_thread_pull_requests and link any missing PR from your work; do not link PRs mentioned only as background. If a link call fails, report that instead of claiming the PR is linked. When asked to monitor or babysit a PR and watch_pull_request is available, call it and end your turn; Leonidas Code wakes you on checks, comments, or conflicts, so do not poll. When handing work back, call unwatch_pull_request first.
</pull_request_linking>`;

/**
 * Shared runtime context; omit model and effort when the harness manages them dynamically.
 * `modelName` is the display name users see in the model picker; `model` is the slug.
 */
export function buildRuntimeInstructions(runtime: {
  readonly harness: string;
  readonly model?: string | undefined;
  readonly modelName?: string | undefined;
  readonly reasoningEffort?: string | undefined;
}): string {
  const harness = toSingleLine(runtime.harness);
  const model = toSingleLine(runtime.model ?? "");
  const modelName = toSingleLine(runtime.modelName ?? "");
  const effort = toSingleLine(runtime.reasoningEffort ?? "");
  const modelLabel =
    modelName && modelName !== model ? `${modelName} (model slug: ${model})` : model;
  const modelInfo = model && model !== "auto" && model !== "default" ? `, as ${modelLabel}` : "";
  const effortInfo = effort ? ` with ${effort} reasoning effort` : "";
  return `<runtime_info>In case you're asked: you are running in Leonidas Code through the ${harness} harness${modelInfo}${effortInfo}. No need to mention this otherwise. You can embed images and videos in your response using Markdown with absolute file paths.</runtime_info>\n\n${PULL_REQUEST_LINKING_INSTRUCTIONS}\n\n${LEONIDAS_OUTPUT_STANDARD}

${USER_QUESTION_INSTRUCTIONS}`;
}

function toSingleLine(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}
