import type { WorkspaceOrg, WorkspaceOrgResult } from "@t3tools/contracts";
import { ShieldIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Dialog, DialogPopup } from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { workspaceOrgQuery } from "~/state/taskBoard";

import { RailWindow, WindowEmpty, WindowError, type WindowTab } from "../../twoState/RailWindow";
import { RolesEditor } from "../../team/RolesEditor";
import { TeamLensProvider } from "../../team/TeamLensContext";
import { TeamView } from "../../team/TeamView";
import { buildTeamGroups } from "../../team/teamView.logic";
import { roleWords } from "./team.logic";

const TABS: readonly WindowTab[] = [
  { id: "members", label: "Members" },
  { id: "roles", label: "Roles" },
  { id: "areas", label: "Areas" },
];
const NO_TABS: readonly WindowTab[] = [];

function Roles({
  org,
  canEdit,
  environmentId,
  scope,
  onChanged,
}: {
  readonly org: WorkspaceOrg;
  readonly canEdit: boolean;
  readonly environmentId: NonNullable<ReturnType<typeof usePrimaryEnvironmentId>>;
  readonly scope: { readonly workspaceId?: string };
  readonly onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {canEdit ? (
        <div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <ShieldIcon aria-hidden />
            Edit roles
          </Button>
        </div>
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {org.roles.map((role) => (
          <li key={role.name} className="px-4 py-3">
            <p className="text-sm font-medium">{role.name}</p>
            <p className="text-xs text-muted-foreground">
              {roleWords(role)}
              {role.basedOn && role.basedOn !== role.name ? ` · Based on ${role.basedOn}` : ""}
            </p>
          </li>
        ))}
      </ul>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogPopup className="max-w-2xl">
          {editing ? (
            <RolesEditor
              environmentId={environmentId}
              scope={scope}
              org={org}
              onDone={(changed) => {
                setEditing(false);
                if (changed) onChanged();
              }}
            />
          ) : null}
        </DialogPopup>
      </Dialog>
    </div>
  );
}

function Areas({ org }: { readonly org: WorkspaceOrg }) {
  const groups = buildTeamGroups(org).filter((group) => group.areas.length > 0);
  if (groups.length === 0) {
    return (
      <WindowEmpty
        icon={UsersIcon}
        title="No areas yet"
        line="The areas of the business and who owns each one show here."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.name || "No department"}>
          <h2 className="mb-1.5 text-xs font-medium text-muted-foreground">
            {group.name || "No department"}
            {group.leads.length > 0 ? ` · Led by ${group.leads.join(", ")}` : ""}
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {group.areas.map((area) => (
              <li key={area.slug} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-sm font-medium">{area.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {[area.sensitivity, area.status].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div role="status" aria-label="Loading your team" className="flex flex-col gap-3">
      <Skeleton className="h-16 w-full" shape="card" />
      <Skeleton className="h-16 w-full" shape="card" />
    </div>
  );
}

/** The Team window: Members, Roles and Areas of a business workspace. */
export function TeamWindow() {
  const environmentId = usePrimaryEnvironmentId();
  const { active, scope, scopeReady } = useActiveAiosWorkspace();
  const business = active?.type === "business";
  const org = useEnvironmentQuery(
    environmentId && scopeReady && business
      ? workspaceOrgQuery({ environmentId, input: scope })
      : null,
  );
  const result: WorkspaceOrgResult | null = org.data;
  const scopeRef = scope as { readonly workspaceId?: string };
  return (
    <RailWindow title="Team" tabs={business ? TABS : NO_TABS}>
      {(tab) => {
        if (!scopeReady) return <Loading />;
        if (!business) {
          return (
            <WindowEmpty
              icon={UsersIcon}
              title="No team in a personal workspace"
              line="Team is for business workspaces. Switch to a business workspace to see members and roles."
            />
          );
        }
        if (result === null) {
          return org.error === null ? (
            <Loading />
          ) : (
            <WindowError
              message="Your team did not load. Check that Leonidas is running, then try again."
              onRetry={org.refresh}
            />
          );
        }
        if (tab === "members" || tab === undefined) {
          return (
            <TeamLensProvider scopeKey={active?.id ?? "workspace"}>
              <TeamView />
            </TeamLensProvider>
          );
        }
        if (result.org === null) {
          return (
            <WindowEmpty
              icon={UsersIcon}
              title="No one is on this team yet"
              line="Ask the business AI to add the first member, or send an invite."
            />
          );
        }
        return tab === "roles" && environmentId ? (
          <Roles
            org={result.org}
            canEdit={result.me?.canDecide ?? false}
            environmentId={environmentId}
            scope={scopeRef}
            onChanged={org.refresh}
          />
        ) : (
          <Areas org={result.org} />
        );
      }}
    </RailWindow>
  );
}
