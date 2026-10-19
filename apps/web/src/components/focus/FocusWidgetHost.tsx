import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { lazy, Suspense, useEffect } from "react";

import { useFocusWidgetStore } from "./focusWidgetStore";

// Loaded on first show, so chats that never open the widget pay nothing for it.
const FocusWidget = lazy(() => import("./FocusWidget"));

/** Mounts the focus widget over the chat while the user has it turned on. */
export function FocusWidgetHost(props: {
  environmentId: EnvironmentId | null;
  projectId: ProjectId | null;
}) {
  const visible = useFocusWidgetStore((state) => state.visible);
  const registerHost = useFocusWidgetStore((state) => state.registerHost);
  // Tells quick capture that the notepad can open here; without a host it falls back to the dialog.
  const canHost = props.environmentId !== null;
  useEffect(() => (canHost ? registerHost() : undefined), [canHost, registerHost]);
  if (!visible || props.environmentId === null) return null;
  return (
    <Suspense fallback={null}>
      <FocusWidget environmentId={props.environmentId} projectId={props.projectId} />
    </Suspense>
  );
}
