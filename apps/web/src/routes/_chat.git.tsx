import { createFileRoute } from "@tanstack/react-router";

import { GitDashboardPage } from "../components/git/GitDashboardPage";

export const Route = createFileRoute("/_chat/git")({ component: GitDashboardPage });
