import { createFileRoute, redirect } from "@tanstack/react-router";

import { TerminalsPage } from "../components/windows/developer/TerminalsPage";

/** The Developer icon opens Git; the Terminals tab keeps this page. */
export const Route = createFileRoute("/_chat/developer")({
  validateSearch: (raw: Record<string, unknown>): { tab?: "terminals" } =>
    raw.tab === "terminals" ? { tab: "terminals" } : {},
  beforeLoad: ({ search }) => {
    if (search.tab !== "terminals") throw redirect({ to: "/git", replace: true });
  },
  component: TerminalsPage,
});
