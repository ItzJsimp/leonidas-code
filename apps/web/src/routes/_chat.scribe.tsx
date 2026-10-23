import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { ScribePage, isScribeTabId, type ScribeTabId } from "../components/scribe/ScribePage";

export interface ScribeSearch {
  readonly tab?: ScribeTabId;
}

function ScribeRoute() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/scribe" });
  return (
    <ScribePage
      tab={tab ?? "home"}
      onTabChange={(next) => void navigate({ search: next === "home" ? {} : { tab: next } })}
    />
  );
}

export const Route = createFileRoute("/_chat/scribe")({
  validateSearch: (raw: Record<string, unknown>): ScribeSearch =>
    isScribeTabId(raw.tab) ? { tab: raw.tab } : {},
  beforeLoad: async ({ context }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: ScribeRoute,
});
