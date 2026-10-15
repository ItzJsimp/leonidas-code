import { ProjectId, ProviderDriverKind } from "@t3tools/contracts";
import type { OrchestrationV2TurnItemStatus } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  subagentGroupSummary,
  resolveSubagentMetadata,
  subagentDetailPreview,
  resolveSubagentDriverKind,
} from "./subagentDisplay.js";

describe("subagentGroupSummary", () => {
  it.each(["pending", "running", "waiting"] as const)(
    "keeps a mixed group live while a member is %s",
    (status) => {
      expect(subagentGroupSummary([{ status: "completed" }, { status }])).toEqual({
        label: "Working with 2 helpers",
        active: true,
        failed: false,
      });
    },
  );

  it("settles the label without disguising a failed member as success", () => {
    const statuses: OrchestrationV2TurnItemStatus[] = [
      "completed",
      "failed",
      "cancelled",
      "interrupted",
    ];
    expect(subagentGroupSummary(statuses.map((status) => ({ status })))).toEqual({
      label: "Used 4 helpers",
      active: false,
      failed: true,
    });
  });

  it("uses a singular label for one idle member", () => {
    expect(subagentGroupSummary([{ status: "idle" }])).toEqual({
      label: "Used 1 helper",
      active: false,
      failed: false,
    });
  });
});

describe("resolveSubagentMetadata", () => {
  it("resolves provider aliases to catalog names, including custom models", () => {
    expect(
      resolveSubagentMetadata({
        model: "claude-haiku-4-5-20251001",
        provider: {
          driver: ProviderDriverKind.make("claudeAgent"),
          models: [
            {
              slug: "claude-haiku-4-5",
              name: "Claude Haiku 4.5",
              shortName: "Haiku 4.5",
              aliases: ["claude-haiku-4-5-20251001"],
              isCustom: false,
              capabilities: null,
            },
          ],
        },
      }).modelLabel,
    ).toBe("Haiku 4.5");
    expect(
      resolveSubagentMetadata({
        model: "my-model",
        provider: {
          driver: ProviderDriverKind.make("acpRegistry"),
          models: [
            {
              slug: "my-model",
              name: "Cloud+ / My custom model",
              subProvider: "Cloud+",
              isCustom: true,
              capabilities: null,
            },
          ],
        },
      }).modelLabel,
    ).toBe("My custom model");
  });

  it("keeps unknown model identities and does not invent an unreported model", () => {
    expect(resolveSubagentMetadata({ model: " custom/model " }).modelLabel).toBe("custom/model");
    expect(
      resolveSubagentMetadata({
        model: null,
        provider: { driver: ProviderDriverKind.make("codex"), models: [] },
      }).modelLabel,
    ).toBe("Not reported");
    expect(resolveSubagentMetadata({ model: " " }).modelLabel).toBe("Not reported");
  });

  const parentThread = { projectId: ProjectId.make("parent"), worktreePath: null };
  const parentProject = { workspaceRoot: "/repo" };

  it("shows another project and its branch when the child has a different workspace", () => {
    expect(
      resolveSubagentMetadata({
        model: null,
        parentThread,
        parentProject,
        childThread: { branch: "fix/agents", worktreePath: "/worktrees/agents" },
        childProject: {
          id: ProjectId.make("child"),
          title: "Other project",
          workspaceRoot: "/other",
        },
      }).workspace,
    ).toEqual([
      { label: "Project", value: "Other project" },
      { label: "Branch", value: "fix/agents" },
    ]);
  });

  it("labels a detached worktree or another project workspace without a branch", () => {
    expect(
      resolveSubagentMetadata({
        model: null,
        parentThread,
        parentProject,
        childThread: { branch: null, worktreePath: "/worktrees/agents" },
      }).workspace,
    ).toEqual([{ label: "Separate copy", value: "agents" }]);
    expect(
      resolveSubagentMetadata({
        model: null,
        parentThread,
        parentProject,
        childProject: {
          id: parentThread.projectId,
          title: "Same project",
          workspaceRoot: "/other",
        },
      }).workspace,
    ).toEqual([{ label: "Workspace", value: "other" }]);
  });

  it("hides redundant workspace metadata and tolerates unavailable child shells", () => {
    expect(
      resolveSubagentMetadata({
        model: null,
        parentThread,
        parentProject,
        childThread: { branch: "main", worktreePath: "/repo" },
        childProject: { id: parentThread.projectId, title: "Same project", workspaceRoot: "/repo" },
      }).workspace,
    ).toEqual([]);
    expect(resolveSubagentMetadata({ model: null, parentThread, parentProject }).workspace).toEqual(
      [],
    );
  });
});

describe("subagentDetailPreview", () => {
  it("prefers progress for live work and results for settled work", () => {
    const details = { progress: "Reading files", result: "Found two\n  problems" };
    expect(subagentDetailPreview({ ...details, status: "running" })).toBe("Reading files");
    expect(subagentDetailPreview({ ...details, status: "completed" })).toBe("Found two problems");
    expect(
      subagentDetailPreview({ status: "failed", progress: "Last progress", result: " " }),
    ).toBe("Last progress");
    expect(subagentDetailPreview({ status: "pending" })).toBeNull();
  });
});

describe("resolveSubagentDriverKind", () => {
  it("resolves OpenRouter when provider driver is openrouter", () => {
    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        provider: {
          instanceId: "openrouter_default" as any,
          driver: ProviderDriverKind.make("openrouter"),
          displayName: "OpenRouter",
          enabled: true,
          models: [],
        } as any,
      }),
    ).toBe(ProviderDriverKind.make("openrouter"));
  });

  it("resolves OpenRouter when model routes through OpenRouter", () => {
    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        model: "openrouter/opendex-1.1-mini-free",
      }),
    ).toBe(ProviderDriverKind.make("openrouter"));
  });

  it("resolves OpenRouter when subagent routes via OpenRouter provider even with custom model name", () => {
    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        providerInstanceId: "openrouter" as any,
        model: "opendex-1.1-mini-free",
      }),
    ).toBe(ProviderDriverKind.make("openrouter"));
  });

  it("resolves codex (ChatGPT) when model is from the ChatGPT/OpenAI family", () => {
    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        model: "gpt-4o",
      }),
    ).toBe(ProviderDriverKind.make("codex"));

    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        model: "chatgpt-4o-latest",
      }),
    ).toBe(ProviderDriverKind.make("codex"));

    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        model: "o1-mini",
      }),
    ).toBe(ProviderDriverKind.make("codex"));

    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        model: "o3-mini",
      }),
    ).toBe(ProviderDriverKind.make("codex"));
  });

  it("resolves claudeAgent when model is a Claude model", () => {
    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        model: "claude-sonnet-4-6",
      }),
    ).toBe(ProviderDriverKind.make("claudeAgent"));
  });

  it("resolves antigravity when model is a Gemini model", () => {
    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        model: "gemini-2.5-flash",
      }),
    ).toBe(ProviderDriverKind.make("antigravity"));
  });

  it("falls back to supplied driver if no override matches", () => {
    expect(
      resolveSubagentDriverKind({
        driver: ProviderDriverKind.make("claudeAgent"),
        model: null,
      }),
    ).toBe(ProviderDriverKind.make("claudeAgent"));
  });
});
