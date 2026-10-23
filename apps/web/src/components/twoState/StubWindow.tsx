import type { ComponentType, SVGProps } from "react";

import { RailWindow, WindowEmpty } from "./RailWindow";

export interface StubTab {
  readonly id: string;
  readonly label: string;
  readonly emptyTitle: string;
  /** What will show here, and why it is empty now. */
  readonly emptyLine: string;
}

/** A rail window whose page is not built yet: its tabs, each saying what will show there. */
export function StubWindow({
  title,
  icon,
  tabs,
}: {
  readonly title: string;
  readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
  readonly tabs: readonly StubTab[];
}) {
  return (
    <RailWindow title={title} tabs={tabs.length > 1 ? tabs : []}>
      {(active) => {
        const tab = tabs.find((candidate) => candidate.id === active) ?? tabs[0];
        return tab ? <WindowEmpty icon={icon} title={tab.emptyTitle} line={tab.emptyLine} /> : null;
      }}
    </RailWindow>
  );
}
