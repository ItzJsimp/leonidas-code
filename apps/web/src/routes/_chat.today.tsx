import { createFileRoute } from "@tanstack/react-router";

import { TodayWindow } from "../components/windows/today/TodayWindow";

export const Route = createFileRoute("/_chat/today")({
  component: TodayWindow,
});
