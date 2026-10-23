import { createFileRoute } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";

import { StubWindow, type StubTab } from "../components/twoState/StubWindow";

const TABS: readonly StubTab[] = [
  {
    id: "all",
    label: "All",
    emptyTitle: "No messages yet",
    emptyLine: "When a chat needs you or finishes, it shows here. Nothing has happened yet.",
  },
  {
    id: "needs-you",
    label: "Needs you",
    emptyTitle: "Nothing needs you",
    emptyLine: "Questions and permission requests from your chats show here when they come.",
  },
  {
    id: "finished",
    label: "Finished",
    emptyTitle: "Nothing finished yet",
    emptyLine: "Chats and tasks that complete show here, newest first.",
  },
];

export const Route = createFileRoute("/_chat/inbox")({
  component: () => <StubWindow title="Inbox" icon={InboxIcon} tabs={TABS} />,
});
