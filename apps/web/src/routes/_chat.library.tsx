import { createFileRoute } from "@tanstack/react-router";
import { LibraryIcon } from "lucide-react";

import { StubWindow, type StubTab } from "../components/twoState/StubWindow";

const TABS: readonly StubTab[] = [
  {
    id: "skills",
    label: "Skills",
    emptyTitle: "No skills listed yet",
    emptyLine: "The skills Leonidas can use show here. This page is not built yet.",
  },
  {
    id: "helpers",
    label: "Helpers",
    emptyTitle: "No helpers listed yet",
    emptyLine: "Helpers that take on a job for you show here.",
  },
  {
    id: "reply-styles",
    label: "Reply styles",
    emptyTitle: "No reply styles listed yet",
    emptyLine: "The ways Leonidas can write its answers show here.",
  },
  {
    id: "rules",
    label: "Rules",
    emptyTitle: "No rules listed yet",
    emptyLine: "The rules Leonidas follows show here.",
  },
  {
    id: "packs",
    label: "Packs",
    emptyTitle: "No packs listed yet",
    emptyLine: "Bundles of skills and rules you can add show here.",
  },
  {
    id: "mods",
    label: "Mods",
    emptyTitle: "No mods listed yet",
    emptyLine: "Changes you made to how the app looks and works show here.",
  },
];

export const Route = createFileRoute("/_chat/library")({
  component: () => <StubWindow title="Library" icon={LibraryIcon} tabs={TABS} />,
});
