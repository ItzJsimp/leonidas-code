import { createFileRoute } from "@tanstack/react-router";

import { ProjectsWindow } from "../components/windows/projects/ProjectsWindow";

export const Route = createFileRoute("/_chat/projects")({
  component: ProjectsWindow,
});
