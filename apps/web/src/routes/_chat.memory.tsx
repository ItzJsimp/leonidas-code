import { createFileRoute } from "@tanstack/react-router";

import { MemoryWindow } from "../components/windows/memory/MemoryWindow";

export const Route = createFileRoute("/_chat/memory")({ component: MemoryWindow });
