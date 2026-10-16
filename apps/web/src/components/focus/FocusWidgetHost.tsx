import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { lazy, Suspense } from "react";

import { useFocusWidgetStore } from "./focusWidgetStore";

// Loaded on first show, so chats that never open the widget pay nothing for it.
const FocusWidget = lazy(() => import("./FocusWidget"));

/** Mounts the focus widget over the chat while the user has it turned on. */
export function FocusWidgetHost(props: {
  environmentId: EnvironmentId | null;
  projectId: ProjectId | null;
}) {
  const visible = useFocusWidgetStore((state) => state.visible);
  if (!visible || props.environmentId === null) return null;
  return (
    <Suspense fallback={null}>
      <FocusWidget environmentId={props.environmentId} projectId={props.projectId} />
    </Suspense>
  );
}
