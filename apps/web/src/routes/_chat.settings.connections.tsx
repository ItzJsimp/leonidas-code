import { createFileRoute } from "@tanstack/react-router";

// Split into /settings/environments; the settings route redirects old links.
export const Route = createFileRoute("/_chat/settings/connections")({});
