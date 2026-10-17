// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { ProviderReadinessControl } from "./ProviderReadinessControl";

const commands = vi.hoisted(() => ({
  install: vi.fn(async () => ({ _tag: "Success" as const, value: {} })),
  signIn: vi.fn(async () => ({ _tag: "Success" as const, value: {} })),
  check: vi.fn(async () => ({ _tag: "Success" as const, value: {} })),
  update: vi.fn(async () => ({ _tag: "Success" as const, value: {} })),
}));
vi.mock("../../state/server", () => ({
  serverEnvironment: {
    startProviderInstall: "install",
    startProviderAuth: "signIn",
    refreshProviders: "check",
    updateProvider: "update",
  },
}));
vi.mock("../../state/use-atom-command", () => ({
  useAtomCommand: (command: keyof typeof commands) => commands[command],
}));
const instanceId = ProviderInstanceId.make("claude_isolated");
const environmentId = EnvironmentId.make("dev");
const provider: ServerProvider = {
  instanceId,
  driver: ProviderDriverKind.make("claudeAgent"),
  enabled: true,
  installed: false,
  status: "error",
  auth: { status: "unknown" },
  version: null,
  checkedAt: "2026-10-16T12:00:00Z",
  models: [],
  skills: [],
  slashCommands: [],
  setup: { canInstall: true, canAuthenticate: true },
};

describe("picker repair", () => {
  it.each([
    [provider, "Install", "install"],
    [
      { ...provider, installed: true, auth: { status: "unauthenticated" as const } },
      "Sign in",
      "signIn",
    ],
    [{ ...provider, installed: true, message: "ECONNREFUSED" }, "Check connection", "check"],
  ] as const)("runs one repair against the selected instance", async (snapshot, label, command) => {
    for (const run of Object.values(commands)) run.mockClear();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const openSetup = vi.fn();
    try {
      await act(async () => {
        root.render(
          <ProviderReadinessControl
            environmentId={environmentId}
            provider={snapshot}
            onOpenProviderSetup={openSetup}
          />,
        );
      });
      expect(host.textContent).toContain(label);
      const buttons = host.querySelectorAll("button");
      expect(buttons).toHaveLength(1);
      await act(async () => {
        buttons[0]!.click();
      });
      expect(commands[command]).toHaveBeenCalledTimes(1);
      expect(commands[command]).toHaveBeenCalledWith(
        expect.objectContaining({ environmentId, input: expect.objectContaining({ instanceId }) }),
      );
    } finally {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    }
  });
});
