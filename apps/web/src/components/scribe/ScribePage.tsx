import type { EnvironmentId } from "@t3tools/contracts";
import { MicOffIcon } from "lucide-react";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { scribeLive } from "~/state/scribe";
import { Badge } from "../ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import { ScribeDictionaryTab } from "./ScribeDictionaryTab";
import { ScribeHomeTab } from "./ScribeHomeTab";
import { ScribeMeetingsTab } from "./ScribeMeetingsTab";
import { ScribeSettingsTab } from "./ScribeSettingsTab";
import { ScribeTranscriptsTab } from "./ScribeTranscriptsTab";
import { useBuilderMode } from "../twoState/useBuilderMode";
import { INITIAL_SCRIBE_LIVE, engineStrip, type ScribeLiveSnapshot } from "./scribeLive.logic";

export interface ScribeTabProps {
  readonly environmentId: EnvironmentId;
  readonly live: ScribeLiveSnapshot;
}

/** Only built tabs appear. Each later tab adds one row here. */
const TABS = [
  { id: "home", label: "Home", render: ScribeHomeTab },
  { id: "transcripts", label: "Transcripts", render: ScribeTranscriptsTab },
  { id: "dictionary", label: "Dictionary", render: ScribeDictionaryTab },
  { id: "settings", label: "Settings", render: ScribeSettingsTab },
  { id: "meetings", label: "Meetings", render: ScribeMeetingsTab },
] as const;

export type ScribeTabId = (typeof TABS)[number]["id"];

export function isScribeTabId(value: unknown): value is ScribeTabId {
  return TABS.some((tab) => tab.id === value);
}

export function ScribePage(props: {
  readonly tab: ScribeTabId;
  readonly onTabChange: (tab: ScribeTabId) => void;
}) {
  const environmentId = usePrimaryEnvironmentId();
  return (
    <div className="isolate flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-y-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background scrollbar-gutter-both">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 p-4 max-[727px]:pt-14 sm:p-6">
          {environmentId ? (
            <ScribeBody environmentId={environmentId} {...props} />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MicOffIcon />
                </EmptyMedia>
                <EmptyTitle>No server connected</EmptyTitle>
                <EmptyDescription>
                  Scribe runs on the Leonidas server. Connect to a server to see it.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}

function ScribeBody(props: {
  readonly environmentId: EnvironmentId;
  readonly tab: ScribeTabId;
  readonly onTabChange: (tab: ScribeTabId) => void;
}) {
  const live =
    useEnvironmentQuery(scribeLive({ environmentId: props.environmentId, input: {} })).data ??
    INITIAL_SCRIBE_LIVE;
  const builder = useBuilderMode();
  const strip = engineStrip(live, builder);
  const active = TABS.find((tab) => tab.id === props.tab) ?? TABS[0];
  const Tab = active.render;
  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Scribe</h1>
          <p className="text-sm text-muted-foreground">
            Speak instead of type. Scribe writes what you say into the window you use.
          </p>
        </div>
        <Badge
          variant={strip.tone === "muted" ? "outline" : strip.tone}
          size="lg"
          aria-live="polite"
        >
          {strip.label}
        </Badge>
      </header>

      {TABS.length > 1 ? (
        <ToggleGroup
          aria-label="Scribe pages"
          className="w-full *:flex-1 *:pointer-coarse:min-h-11 sm:w-auto sm:*:min-w-24"
          value={[active.id]}
          onValueChange={(next) => {
            const tab = next[0];
            if (isScribeTabId(tab)) props.onTabChange(tab);
          }}
        >
          {TABS.map((tab) => (
            <Toggle key={tab.id} value={tab.id}>
              {tab.label}
            </Toggle>
          ))}
        </ToggleGroup>
      ) : null}

      <Tab environmentId={props.environmentId} live={live} />
    </>
  );
}
