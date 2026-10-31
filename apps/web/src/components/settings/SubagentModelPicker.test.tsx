import type { ServerProvider } from "@t3tools/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { create } from "react-test-renderer";
import { describe, expect, it, vi } from "vite-plus/test";

// The real menu draws in a portal that opens on click. Plain elements keep the test on our wiring.
vi.mock("../ui/menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuTrigger: ({ render, children }: { render: ReactNode; children: ReactNode }) => (
    <div data-testid="trigger">
      {render}
      {children}
    </div>
  ),
  MenuPopup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuGroup: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  MenuGroupLabel: ({ children }: { children: ReactNode }) => <h4>{children}</h4>,
  MenuSeparator: () => <hr />,
  MenuCheckboxItem: (props: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    children: ReactNode;
  }) => (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={props.checked}
      onClick={() => props.onCheckedChange(!props.checked)}
    >
      {props.children}
    </button>
  ),
}));

import { SubagentModelPicker } from "./SubagentModelPicker";

const account = (instanceId: string, label: string, slugs: string[]) =>
  ({
    instanceId,
    driver: "claudeAgent",
    displayName: label,
    enabled: true,
    auth: { label },
    models: slugs.map((slug) => ({ slug, name: slug })),
  }) as unknown as ServerProvider;

describe("SubagentModelPicker", () => {
  it("lists every account's models and flips one on click", async () => {
    const onChange = vi.fn();
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(
        <SubagentModelPicker
          providers={[
            account("a", "Claude (Jake)", ["claude-haiku-5-5", "claude-sonnet-5-5"]),
            account("b", "Claude (Schaak)", ["claude-opus-5-5"]),
          ]}
          selected={["claude-haiku-5-5"]}
          onChange={onChange}
          aria-label="Helper models"
        />,
      );
    });
    const items = tree.root.findAllByProps({ role: "menuitemcheckbox" });
    expect(items.map((item) => item.props["aria-checked"])).toEqual([true, false, false]);
    expect(tree.root.findAllByType("h4").map((node) => node.children.join(""))).toEqual([
      "Claude (Jake)",
      "Claude (Schaak)",
    ]);
    await act(async () => items[2]!.props.onClick());
    expect(onChange).toHaveBeenCalledWith(["claude-haiku-5-5", "claude-opus-5-5"]);
    await act(async () => items[0]!.props.onClick());
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
