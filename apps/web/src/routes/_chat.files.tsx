import { createFileRoute } from "@tanstack/react-router";

import { FilesWindow } from "../components/windows/files/FilesWindow";

export const Route = createFileRoute("/_chat/files")({
  component: FilesWindow,
});
