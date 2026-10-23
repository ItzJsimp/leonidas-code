import { createFileRoute } from "@tanstack/react-router";
import { TerminalSquareIcon } from "lucide-react";

import { StubWindow, type StubTab } from "../components/twoState/StubWindow";

const TABS: readonly StubTab[] = [
  {
    id: "git",
    label: "Git",
    emptyTitle: "No Git data yet",
    emptyLine: "Your branches and changes show here. This page is not built yet.",
  },
  {
    id: "pull-requests",
    label: "Pull requests",
    emptyTitle: "No pull requests yet",
    emptyLine: "Pull requests you opened or need to review show here.",
  },
  {
    id: "terminals",
    label: "Terminals",
    emptyTitle: "No terminals yet",
    emptyLine: "The terminals you have open show here.",
  },
];

export const Route = createFileRoute("/_chat/developer")({
  component: () => <StubWindow title="Developer" icon={TerminalSquareIcon} tabs={TABS} />,
});
