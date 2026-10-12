import { ProviderDriverKind, ProviderInstanceId, RunId } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import type { ProviderFailoverTarget } from "./providerFailover";
import { usageLimitRecoveryBannerItem } from "./UsageLimitRecoveryBanner";

vi.mock("../ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock("../ui/group", () => ({
  ButtonGroup: ({ children, ...props }: any) => (
    <div data-slot="button-group" {...props}>
      {children}
    </div>
  ),
}));
vi.mock("../ui/menu", () => ({
  Menu: ({ children }: any) => <div data-slot="menu">{children}</div>,
  MenuTrigger: ({ render, children }: any) => (
    <div data-slot="menu-trigger">
      {render}
      {children}
    </div>
  ),
  MenuPopup: ({ children }: any) => <div data-slot="menu-popup">{children}</div>,
  MenuItem: ({ children, ...props }: any) => (
    <div data-slot="menu-item" {...props}>
      {children}
    </div>
  ),
}));

describe("UsageLimitRecoveryBanner", () => {
  const defaultProps = {
    runId: RunId.make("run_123"),
    resetAt: "2026-10-31T20:00:00.000Z",
    stoppedAt: "2026-10-10T12:00:00.000Z",
    snoozedUntil: null,
    recovery: null,
    onChange: vi.fn(),
    failoverTargets: [] as ReadonlyArray<ProviderFailoverTarget>,
    failoverDisabled: false,
    onFailover: vi.fn(),
    failoverUnavailable: false,
  };

  it("creates a warning banner item with formatted reset description", () => {
    const item = usageLimitRecoveryBannerItem(defaultProps);
    expect(item.id).toBe("usage-limit-recovery:run_123");
    expect(item.variant).toBe("warning");
    expect(item.priority).toBe("urgent");
    expect(item.title).toBe("Usage limit reached");
    expect(item.description).toContain("Resets");
  });

  it("handles missing reset time in description", () => {
    const item = usageLimitRecoveryBannerItem({ ...defaultProps, resetAt: null });
    expect(item.description).toBe("Reset time unavailable; retry manually");
  });

  it("shows 'No other accounts available to continue' when failoverTargets is empty", () => {
    const item = usageLimitRecoveryBannerItem(defaultProps);
    const html = renderToStaticMarkup(item.actions as any);
    expect(html).toContain("No other accounts available to continue");
  });

  it("renders Continue with button and model menu when failover targets have multiple models", () => {
    const target: ProviderFailoverTarget = {
      instanceId: ProviderInstanceId.make("claude_jake"),
      driverKind: ProviderDriverKind.make("claudeAgent"),
      label: "Claude (Jake)",
      modelSelection: {
        instanceId: ProviderInstanceId.make("claude_jake"),
        model: "claude-sonnet-5-5",
        options: [{ id: "effort", value: "medium" }],
      },
      availableModels: [
        { slug: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", isDefault: true },
        { slug: "claude-opus-5-5", name: "Claude Opus 5.5" },
        { slug: "claude-haiku-5-5", name: "Claude Haiku 5.5" },
      ],
    };

    const item = usageLimitRecoveryBannerItem({
      ...defaultProps,
      failoverTargets: [target],
    });
    const html = renderToStaticMarkup(item.actions as any);

    expect(html).not.toContain("No other accounts available to continue");
    expect(html).toContain("Continue with Claude (Jake)");
    expect(html).toContain('data-slot="menu-trigger"');
    expect(html).toContain("Claude Sonnet 5.5");
    expect(html).toContain("Claude Opus 5.5");
    expect(html).toContain("Default");
  });

  it("renders a single button without model dropdown when only one model exists", () => {
    const target: ProviderFailoverTarget = {
      instanceId: ProviderInstanceId.make("codex_single"),
      driverKind: ProviderDriverKind.make("codex"),
      label: "Codex Single",
      modelSelection: {
        instanceId: ProviderInstanceId.make("codex_single"),
        model: "gpt-6.1-sol",
      },
      availableModels: [{ slug: "gpt-6.1-sol", name: "GPT-6.1 Sol", isDefault: true }],
    };

    const item = usageLimitRecoveryBannerItem({
      ...defaultProps,
      failoverTargets: [target],
    });
    const html = renderToStaticMarkup(item.actions as any);

    expect(html).toContain("Continue with Codex Single");
    expect(html).not.toContain('data-slot="menu-trigger"');
  });

  it("renders auto-resume and snooze controls when canSchedule is true", () => {
    const item = usageLimitRecoveryBannerItem(defaultProps);
    const html = renderToStaticMarkup(item.actions as any);
    expect(html).toContain("Resume at reset");
    expect(html).toContain("Snooze until reset");
  });
});
