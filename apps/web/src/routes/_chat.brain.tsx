import { createFileRoute, redirect } from "@tanstack/react-router";

// The brain map lives on the Memory page now. Old links land on its tab.
export const Route = createFileRoute("/_chat/brain")({
  beforeLoad: () => {
    throw redirect({ to: "/memory", search: { tab: "brain-map" } as never, replace: true });
  },
});
