import { createFileRoute } from "@tanstack/react-router";
import { SunIcon } from "lucide-react";

import { StubWindow, type StubTab } from "../components/twoState/StubWindow";

const TABS: readonly StubTab[] = [
  {
    id: "priorities",
    label: "Priorities",
    emptyTitle: "No priorities yet",
    emptyLine: "The few things that matter most today show here once this page reads your tasks.",
  },
  {
    id: "schedule",
    label: "Schedule",
    emptyTitle: "No schedule yet",
    emptyLine: "Your events for today show here once a calendar is connected.",
  },
  {
    id: "briefing",
    label: "Briefing",
    emptyTitle: "No briefing yet",
    emptyLine: "A short summary of your day shows here once Leonidas has written one.",
  },
];

export const Route = createFileRoute("/_chat/today")({
  component: () => <StubWindow title="Today" icon={SunIcon} tabs={TABS} />,
});
