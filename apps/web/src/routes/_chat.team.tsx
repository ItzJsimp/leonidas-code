import { createFileRoute } from "@tanstack/react-router";

import { TeamWindow } from "../components/windows/team/TeamWindow";

export const Route = createFileRoute("/_chat/team")({
  component: TeamWindow,
});
