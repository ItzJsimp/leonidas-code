import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { workspacePackWidgetsQuery } from "~/state/taskBoard";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";

/**
 * The cards a workspace pack adds to the Command Home (the business pack for a business
 * workspace). The server returns nothing for a personal workspace, so this renders nothing there.
 * It shows the data only and never imports a pack.
 */
export function WorkspacePackWidgets() {
  const environmentId = usePrimaryEnvironmentId();
  const { scope, scopeReady } = useActiveAiosWorkspace();
  const { data } = useEnvironmentQuery(
    environmentId && scopeReady ? workspacePackWidgetsQuery({ environmentId, input: scope }) : null,
  );
  const widgets = data?.widgets ?? [];
  if (widgets.length === 0) return null;
  return (
    <>
      {widgets.map((widget) => (
        <section
          key={widget.id}
          aria-labelledby={`pack-widget-${widget.id}`}
          className="rounded-lg border p-4"
        >
          <h3 id={`pack-widget-${widget.id}`} className="text-sm font-medium">
            {widget.title}
          </h3>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            {widget.kpis.map((kpi) => (
              <div key={kpi.label}>
                <dt className="text-xs text-muted-foreground">{kpi.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight">{kpi.value}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">{kpi.detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}
