import { createFileRoute } from "@tanstack/react-router";
import { BrainIcon } from "lucide-react";

import { StubWindow, type StubTab } from "../components/twoState/StubWindow";

const TABS: readonly StubTab[] = [
  {
    id: "areas",
    label: "Areas",
    emptyTitle: "No areas listed yet",
    emptyLine: "The areas of your life and work that Leonidas keeps notes on show here.",
  },
  {
    id: "brain-map",
    label: "Brain map",
    emptyTitle: "No map yet",
    emptyLine: "A map of what Leonidas knows and how it connects shows here.",
  },
  {
    id: "decisions",
    label: "Decisions",
    emptyTitle: "No decisions yet",
    emptyLine: "Decisions you made, with the reason, show here once they are saved.",
  },
  {
    id: "logs",
    label: "Logs",
    emptyTitle: "No history yet",
    emptyLine: "A record of what changed and when shows here.",
  },
  {
    id: "wiki",
    label: "Wiki",
    emptyTitle: "No notes yet",
    emptyLine: "Reference notes that Leonidas keeps for you show here.",
  },
];

export const Route = createFileRoute("/_chat/memory")({
  component: () => <StubWindow title="Memory" icon={BrainIcon} tabs={TABS} />,
});
