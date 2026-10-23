import { createFileRoute } from "@tanstack/react-router";

import { MarketingView } from "../components/marketing/MarketingView";

export const Route = createFileRoute("/_chat/marketing")({ component: MarketingView });
