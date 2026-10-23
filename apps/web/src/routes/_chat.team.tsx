import { createFileRoute } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";

import { StubWindow, type StubTab } from "../components/twoState/StubWindow";

const TABS: readonly StubTab[] = [
  {
    id: "members",
    label: "Members",
    emptyTitle: "No members listed yet",
    emptyLine: "The people on your team show here. This page is not built yet.",
  },
  {
    id: "roles",
    label: "Roles",
    emptyTitle: "No roles listed yet",
    emptyLine: "What each person on your team is in charge of shows here.",
  },
  {
    id: "areas",
    label: "Areas",
    emptyTitle: "No areas listed yet",
    emptyLine: "The areas of the business and who owns each one show here.",
  },
];

export const Route = createFileRoute("/_chat/team")({
  component: () => <StubWindow title="Team" icon={UsersIcon} tabs={TABS} />,
});
