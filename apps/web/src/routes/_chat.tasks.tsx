import { createFileRoute } from "@tanstack/react-router";

import { TasksPage } from "../components/taskBoard/TasksPage";

export const Route = createFileRoute("/_chat/tasks")({ component: TasksPage });
