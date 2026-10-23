import type { TaskBoardHomeArea } from "@t3tools/contracts";
import { BookOpenIcon, BrainIcon, ScaleIcon, ScrollTextIcon } from "lucide-react";
import { lazy, Suspense, useMemo } from "react";

import {
  RailWindow,
  WindowEmpty,
  WindowError,
  WindowLoading,
  type WindowTab,
} from "~/components/twoState/RailWindow";
import { useAiosHome } from "~/components/twoState/useTwoStateData";
import { useNowMinute } from "~/hooks/useNowMinute";

import { areaCards, folderAreaLine } from "./areaCards";

const BrainVisualizer = lazy(() =>
  import("~/components/brain/BrainVisualizer").then((module) => ({
    default: module.BrainVisualizer,
  })),
);

// The map sizes itself from its box, so the box needs a height.
const MAP_BOX = "h-[70dvh] min-h-80 overflow-hidden rounded-xl border border-border bg-card";

const TABS: readonly WindowTab[] = [
  { id: "areas", label: "Areas" },
  { id: "brain-map", label: "Brain map" },
  { id: "decisions", label: "Decisions" },
  { id: "logs", label: "Logs" },
  { id: "wiki", label: "Wiki" },
];

/** No client read lists the files of one AIOS folder yet, so these tabs show the count and say so. */
const FOLDER_TABS = {
  decisions: {
    icon: ScaleIcon,
    title: "Decisions are saved, but not listed here yet",
    coming: "This tab will list each decision with its reason.",
  },
  logs: {
    icon: ScrollTextIcon,
    title: "Logs are saved, but not listed here yet",
    coming: "This tab will show what changed and when.",
  },
  wiki: {
    icon: BookOpenIcon,
    title: "Wiki pages are saved, but not listed here yet",
    coming: "This tab will list the reference notes Leonidas keeps for you.",
  },
} as const;

/** Memory: what Leonidas knows. The area numbers come from the AIOS folder read the rails use. */
export function MemoryWindow() {
  const home = useAiosHome();
  const now = Date.parse(`${useNowMinute()}Z`);
  const areas = home.data?.areas;
  return (
    <RailWindow title="Memory" tabs={TABS}>
      {(tab) => {
        if (tab === "brain-map") {
          return (
            <Suspense fallback={<WindowLoading label="Opening the map" />}>
              <div className={MAP_BOX}>
                <BrainVisualizer className="h-full w-full" />
              </div>
            </Suspense>
          );
        }
        if (home.error !== null && home.data === null) {
          return <WindowError message="Memory did not load." onRetry={home.refresh} />;
        }
        if (home.data === null) return <WindowLoading label="Reading your AIOS folder" />;
        if (tab === "decisions" || tab === "logs" || tab === "wiki") {
          const view = FOLDER_TABS[tab];
          return (
            <WindowEmpty
              icon={view.icon}
              title={view.title}
              line={`${folderAreaLine(areas ?? [], tab, now)} ${view.coming}`}
            />
          );
        }
        return <AreaCards areas={areas ?? []} now={now} />;
      }}
    </RailWindow>
  );
}

function AreaCards({
  areas,
  now,
}: {
  readonly areas: readonly TaskBoardHomeArea[];
  readonly now: number;
}) {
  const cards = useMemo(() => areaCards(areas, now), [areas, now]);
  if (cards.length === 0) {
    return (
      <WindowEmpty
        icon={BrainIcon}
        title="No AIOS folder connected yet"
        line="Connect your AIOS folder and the areas Leonidas keeps notes on show here."
        action={{ label: "Connect your AIOS folder", to: "/tasks" }}
      />
    );
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
      {cards.map((card) => (
        <li
          key={card.id}
          className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4"
        >
          <span className="text-xs text-muted-foreground">{card.label}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-semibold tabular-nums">{card.number}</span>
            <span className="text-sm text-muted-foreground">{card.unit}</span>
          </span>
          <span className="text-xs text-muted-foreground">Changed {card.changed}</span>
        </li>
      ))}
    </ul>
  );
}
