import type { EnvironmentId } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { LayoutDashboardIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EventInbox } from "~/components/EventInbox";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { useConnectedUsageAccounts } from "~/hooks/useConnectedUsageAccounts";
import { useNowMinute } from "~/hooks/useNowMinute";

import { isElectron } from "~/env";

import { builtInStats, claudeFiveHour, type HeaderStat } from "./headerStats";
import { slotRegistry } from "./SlotOutlet";
import { entriesFor, type SlotContext, type StatSlotEntry } from "./slots";
import { swapKeyLabel } from "./swapKeys";
import { Tip } from "./Tip";
import { useTwoStateCounts } from "./useTwoStateData";

export const HEADER_HEIGHT = "2.5rem";
const CODE_CONTEXT: SlotContext = { forward: "code" };

/** The Command Center band over the rails and the chat: stats, live work, bell, way back. */
export function TwoStateHeader({ leading }: { readonly leading?: ReactNode }) {
  return (
    <header
      style={{
        height: HEADER_HEIGHT,
        // Clear the native window buttons on desktop.
        paddingRight: "calc(var(--workspace-native-controls-inset) + 0.75rem)",
      }}
      className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-background pl-3 [-webkit-app-region:drag]"
    >
      {leading}
      <HeaderStats />
      <span className="flex-1" />
      <div className="flex items-center gap-1.5 [-webkit-app-region:no-drag]">
        <EventInbox />
        <Tip text="Bring the Command Center forward">
          <Link
            to="/command-center"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <LayoutDashboardIcon aria-hidden className="size-3.5" />
            <span className="hidden sm:inline">Command Center</span>
            <kbd className="hidden rounded-sm border border-border/60 px-1 font-mono text-3xs text-muted-foreground lg:inline">
              {swapKeyLabel(isElectron)}
            </kbd>
          </Link>
        </Tip>
      </div>
    </header>
  );
}

function HeaderStats() {
  const counts = useTwoStateCounts();
  const { environmentId } = useActiveAiosWorkspace();
  const { active, others } = useConnectedUsageAccounts(
    environmentId ?? ("" as EnvironmentId),
    null,
  );
  const now = Date.parse(`${useNowMinute()}Z`);
  const stats = builtInStats(counts, claudeFiveHour([...active, ...others], now));
  return (
    <ul
      aria-label="Command Center stats"
      className="hidden min-w-0 items-center gap-1 md:flex [-webkit-app-region:no-drag]"
    >
      {stats.map((stat) => (
        <StatChip key={stat.id} stat={stat} />
      ))}
      {entriesFor(slotRegistry, "headerStat", CODE_CONTEXT).map((entry) => (
        <SlotStat key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}

/** A plug-in stat. Its hook runs in its own component, so the hook order never changes. */
function SlotStat({ entry }: { readonly entry: StatSlotEntry }) {
  const value = entry.useValue();
  if (value === null) return null;
  return <StatChip stat={{ id: entry.id, label: entry.label, value, tip: entry.label }} />;
}

function StatChip({ stat }: { readonly stat: HeaderStat }) {
  return (
    <li>
      <Tip text={stat.tip}>
        <span
          tabIndex={0}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs whitespace-nowrap text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {stat.label}
          <b className="font-semibold text-foreground tabular-nums">{stat.value}</b>
        </span>
      </Tip>
    </li>
  );
}
