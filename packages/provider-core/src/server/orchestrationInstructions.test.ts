import { assert, describe, it } from "@effect/vitest";

import {
  T3_CODE_ORCHESTRATION_INSTRUCTIONS,
  t3AcpPromptWithInstructions,
  t3OrchestrationPromptForFirstRun,
  t3OrchestrationSystemPrompt,
} from "./orchestrationInstructions.ts";

describe("T3 orchestration provider instructions", () => {
  it("distinguishes delegated subagents from ordinary top-level threads", () => {
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "use `delegate_task`");
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "ordinary top-level T3 conversations");
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "Never use them merely");
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "cross-provider");
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "call `delegate_task` again");
    assert.include(
      T3_CODE_ORCHESTRATION_INSTRUCTIONS,
      "Do not use `t3_thread_send` on `childThreadId`",
    );
  });

  it("guides model discovery, bounded delegation, and review", () => {
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "Tiered orchestration");
    assert.include(
      T3_CODE_ORCHESTRATION_INSTRUCTIONS,
      "The selected model for the current thread is the orchestrator",
    );
    assert.include(
      T3_CODE_ORCHESTRATION_INSTRUCTIONS,
      "Discover child targets at run time with orchestrator_capabilities",
    );
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "Track every delegated task by taskId");
    assert.include(
      T3_CODE_ORCHESTRATION_INSTRUCTIONS,
      "Judge economics from total worker and orchestrator requests",
    );
  });

  it("keeps parallel decision exploration read-only and closes the frontend verification loop", () => {
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "two independent, read-only");
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "delegated children share the workspace");
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "separate worktrees");
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "preview_status");
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "inspect it again");
  });

  it("documents structured schedules instead of JSON strings", () => {
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "structured object, never as JSON text");
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, '"everyMs":3600000');
    assert.include(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "bindToCurrentThread=false");
  });

  it("injects prompt fallback only for an MCP-enabled first run", () => {
    const prompt = "Inspect the repository.";
    const injected = t3OrchestrationPromptForFirstRun({
      prompt,
      runOrdinal: 1,
      hasT3Mcp: true,
    });

    assert.include(injected, "<t3_code_orchestration_instructions>");
    assert.include(injected, `<user_request>\n${prompt}\n</user_request>`);
    assert.equal(
      t3OrchestrationPromptForFirstRun({ prompt, runOrdinal: 2, hasT3Mcp: true }),
      prompt,
    );
    assert.equal(
      t3OrchestrationPromptForFirstRun({ prompt, runOrdinal: 1, hasT3Mcp: false }),
      prompt,
    );
  });

  it("only exposes the system prompt when the T3 MCP server is attached", () => {
    assert.equal(t3OrchestrationSystemPrompt(false), undefined);
    assert.equal(t3OrchestrationSystemPrompt(true), T3_CODE_ORCHESTRATION_INSTRUCTIONS);
  });

  it("gives ACP sessions provider-neutral mode, browser, and orchestration guidance", () => {
    const injected = t3AcpPromptWithInstructions({
      prompt: "Inspect the repository.",
      state: { interactionMode: "default", hasT3Mcp: true },
    });

    assert.include(injected, "Leonidas Code interaction mode: Default");
    assert.include(injected, "Leonidas Code collaborative browser");
    assert.include(injected, "Leonidas Code orchestration");
    assert.include(injected, "<user_request>\nInspect the repository.\n</user_request>");
  });

  it("keeps the terminal ACP fallback out of non-ACP orchestration prompts", () => {
    assert.notInclude(T3_CODE_ORCHESTRATION_INSTRUCTIONS, "T3_ACP_MCP_NODE");
    assert.notInclude(
      t3OrchestrationPromptForFirstRun({ prompt: "x", runOrdinal: 1, hasT3Mcp: true }),
      "T3_ACP_MCP_NODE",
    );
    assert.notInclude(t3OrchestrationSystemPrompt(true) ?? "", "T3_ACP_MCP_NODE");
  });

  it("adds the terminal ACP fallback only to MCP-enabled ACP prompts", () => {
    const withMcp = t3AcpPromptWithInstructions({
      prompt: "x",
      state: { interactionMode: "default", hasT3Mcp: true },
    });
    const withoutMcp = t3AcpPromptWithInstructions({
      prompt: "x",
      state: { interactionMode: "default", hasT3Mcp: false },
    });

    assert.include(withMcp, "ACP fallback:");
    assert.include(withMcp, "acp-mcp-call delegate_task");
    assert.notInclude(withoutMcp, "T3_ACP_MCP_NODE");
  });

  it("reinjects ACP guidance only when mode or tool availability changes", () => {
    const prompt = "Continue.";
    const defaultState = { interactionMode: "default", hasT3Mcp: true } as const;

    assert.equal(
      t3AcpPromptWithInstructions({ prompt, state: defaultState, previousState: defaultState }),
      prompt,
    );
    assert.include(
      t3AcpPromptWithInstructions({
        prompt,
        state: { ...defaultState, interactionMode: "plan" },
        previousState: defaultState,
      }),
      "Leonidas Code interaction mode: Plan",
    );
    const withoutMcp = t3AcpPromptWithInstructions({
      prompt,
      state: { interactionMode: "default", hasT3Mcp: false },
    });
    assert.include(withoutMcp, "Leonidas Code interaction mode: Default");
    assert.notInclude(withoutMcp, "Leonidas Code collaborative browser");
    assert.notInclude(withoutMcp, "Leonidas Code orchestration");
  });
});
