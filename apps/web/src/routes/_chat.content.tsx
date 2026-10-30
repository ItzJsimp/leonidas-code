import { createFileRoute } from "@tanstack/react-router";

import { ContentView } from "../components/content/ContentView";

export const Route = createFileRoute("/_chat/content")({ component: ContentView });
