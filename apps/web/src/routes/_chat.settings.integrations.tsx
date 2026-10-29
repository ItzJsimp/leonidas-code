import { createFileRoute } from "@tanstack/react-router";

// Split into /settings/browser; the settings route redirects old links.
export const Route = createFileRoute("/_chat/settings/integrations")({});
