import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { AuthOrchestrationOperateScope, type ProjectIconOverride } from "@t3tools/contracts";
import { lazy, Suspense, useCallback } from "react";

import { userErrorToastFields } from "~/lib/userErrorToast";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { projectEnvironment } from "../../state/projects";
import { readEnvironmentScope } from "../../state/session";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import {
  canPickExternalProjectFavicon,
  ProjectFaviconPickerDialog,
} from "../settings/ProjectFaviconPickerDialog";
import { toastManager } from "../ui/toast";

const ProjectIconPickerDialog = lazy(() =>
  import("../settings/ProjectIconPickerDialog").then((module) => ({
    default: module.ProjectIconPickerDialog,
  })),
);

export type SidebarProjectIconMode = "icon" | "image";

type ProjectIconInput = { faviconPath: string | null; projectIcon: ProjectIconOverride | null };

/** Writes an icon to every computer the project lives on; null + null resets it. */
export function useProjectIconSave() {
  const updateProject = useOrchestrationCommand(projectEnvironment.update, {
    reportFailure: false,
  });
  return useCallback(
    async (project: SidebarProjectSnapshot, input: ProjectIconInput) => {
      for (const member of project.memberProjects) {
        if (!readEnvironmentScope(member.environmentId, AuthOrchestrationOperateScope)) {
          toastManager.add({
            type: "error",
            title: "Could not change the project icon",
            description: `This connection cannot change projects on ${member.environmentLabel ?? "this computer"}.`,
          });
          return;
        }
        const result = await updateProject({
          environmentId: member.environmentId,
          input: { projectId: member.id, ...input },
        });
        if (result._tag === "Failure") {
          if (!isAtomCommandInterrupted(result)) {
            toastManager.add({
              type: "error",
              title: "Could not change the project icon",
              ...userErrorToastFields(squashAtomCommandFailure(result)),
            });
          }
          return;
        }
      }
    },
    [updateProject],
  );
}

/**
 * Changes a project's icon straight from the rail: an emoji, icon or
 * monogram, or an image file. The same pickers as Project settings, with
 * the change fanned out to every computer the project lives on.
 */
export function SidebarProjectIconEditor(props: {
  project: SidebarProjectSnapshot;
  mode: SidebarProjectIconMode;
  onClose: () => void;
}) {
  const { project, onClose } = props;
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const representative = project.memberProjects[0] ?? project;
  const pickExternal =
    typeof window !== "undefined" &&
    project.memberProjects.every(
      (member) =>
        member.environmentId === primaryEnvironmentId &&
        canPickExternalProjectFavicon(member.workspaceRoot, navigator.platform),
    )
      ? window.desktopBridge?.pickProjectFavicon
      : undefined;

  const saveIcon = useProjectIconSave();
  const save = (input: ProjectIconInput) => {
    onClose();
    return saveIcon(project, input);
  };

  if (props.mode === "image") {
    return (
      <ProjectFaviconPickerDialog
        cwd={representative.workspaceRoot}
        environmentId={representative.environmentId}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        {...(pickExternal
          ? { onPickExternal: () => pickExternal(representative.workspaceRoot) }
          : {})}
        onSelect={(path) => void save({ faviconPath: path, projectIcon: null })}
        open
        projectName={project.displayName}
      />
    );
  }
  return (
    <Suspense fallback={null}>
      <ProjectIconPickerDialog
        current={representative.projectIcon ?? null}
        projectName={project.displayName}
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        onSelect={(icon) => void save({ faviconPath: null, projectIcon: icon })}
      />
    </Suspense>
  );
}

/** Reset is offered only when the project carries a custom icon. */
export function projectHasCustomIcon(project: SidebarProjectSnapshot): boolean {
  return project.memberProjects.some(
    (member) => member.faviconPath != null || member.projectIcon != null,
  );
}
