import { createFileRoute } from "@tanstack/react-router";

import { InboxWindow } from "../components/windows/inbox/InboxWindow";

export const Route = createFileRoute("/_chat/inbox")({
  component: InboxWindow,
});
