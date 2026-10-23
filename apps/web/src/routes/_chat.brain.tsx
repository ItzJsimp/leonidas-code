import { createFileRoute, redirect } from "@tanstack/react-router";

import { BrainVisualizer } from "../components/brain";

export const Route = createFileRoute("/_chat/brain")({
  beforeLoad: async ({ context }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: BrainPage,
});

function BrainPage() {
  return <BrainVisualizer className="h-full w-full" />;
}
