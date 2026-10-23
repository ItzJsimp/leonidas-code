import { createFileRoute } from "@tanstack/react-router";

import { LibraryWindow } from "../components/windows/library/LibraryWindow";

export const Route = createFileRoute("/_chat/library")({ component: LibraryWindow });
