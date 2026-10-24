import { createFileRoute } from "@tanstack/react-router";

import { SubagentsWindow } from "../components/windows/subagents/SubagentsWindow";

export const Route = createFileRoute("/_chat/subagents")({
  component: SubagentsWindow,
});
