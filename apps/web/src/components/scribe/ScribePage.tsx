import type { EnvironmentId } from "@t3tools/contracts";
import { MicOffIcon } from "lucide-react";

import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { scribeLive } from "~/state/scribe";
import { Badge } from "../ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { ScribeDictionaryTab } from "./ScribeDictionaryTab";
import { ScribeHomeTab } from "./ScribeHomeTab";
import { ScribeMeetingsTab } from "./ScribeMeetingsTab";
import { ScribeRewriteTab } from "./ScribeRewriteTab";
import { ScribeSettingsTab } from "./ScribeSettingsTab";
import { ScribeTranscriptsTab } from "./ScribeTranscriptsTab";
import { useBuilderMode } from "../twoState/useBuilderMode";
import { WindowHeader } from "../twoState/WindowHeader";
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
  { id: "rewrite", label: "Rewrite", render: ScribeRewriteTab },
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
      {environmentId ? (
        <ScribeBody environmentId={environmentId} {...props} />
      ) : (
        <>
          <WindowHeader title="Scribe" />
          <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4 sm:p-6">
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
          </div>
        </>
      )}
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
      <WindowHeader
        title="Scribe"
        actions={
          <Badge
            variant={strip.tone === "muted" ? "outline" : strip.tone}
            size="lg"
            aria-live="polite"
          >
            {strip.label}
          </Badge>
        }
        tabs={TABS}
        active={active.id}
        onSelect={(id) => {
          if (isScribeTabId(id)) props.onTabChange(id);
        }}
        idBase="scribe"
      />
      <div
        role="tabpanel"
        id="scribe-panel"
        aria-labelledby={`scribe-tab-${active.id}`}
        className="min-h-0 flex-1 overflow-y-auto bg-background scrollbar-gutter-both"
      >
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            Speak instead of typing, and rewrite any text you select.
          </p>
          <Tab environmentId={props.environmentId} live={live} />
        </div>
      </div>
    </>
  );
}
