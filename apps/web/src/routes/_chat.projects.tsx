import { createFileRoute } from "@tanstack/react-router";
import { FolderKanbanIcon } from "lucide-react";

import { StubWindow, type StubTab } from "../components/twoState/StubWindow";

const TABS: readonly StubTab[] = [
  {
    id: "projects",
    label: "Projects",
    emptyTitle: "No projects listed yet",
    emptyLine: "Your projects and where each one stands show here. This page is not built yet.",
  },
];

export const Route = createFileRoute("/_chat/projects")({
  component: () => <StubWindow title="Projects" icon={FolderKanbanIcon} tabs={TABS} />,
});
