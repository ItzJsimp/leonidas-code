import type { ImageCatalogModel } from "@t3tools/contracts";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import { fitView, licenceView } from "./catalog.logic";

export function FitBadge(props: {
  readonly model: Pick<ImageCatalogModel, "fit">;
  readonly size?: "sm" | "default";
}) {
  const view = fitView(props.model.fit);
  return (
    <Badge variant={view.variant} size={props.size ?? "default"}>
      {view.label}
    </Badge>
  );
}

export function LicenceBadge(props: {
  readonly model: Pick<ImageCatalogModel, "commercialUse" | "licenceName" | "licenceVerifiedOn">;
}) {
  const view = licenceView(props.model);
  return <Badge variant={view.variant}>{view.label}</Badge>;
}

export function StateBadge(props: {
  readonly model: Pick<ImageCatalogModel, "state" | "installProgress">;
}) {
  const { model } = props;
  switch (model.state) {
    case "ready":
      return <Badge variant="success">Ready</Badge>;
    case "broken":
      return <Badge variant="error">Broken</Badge>;
    case "not-installed":
      return <Badge variant="outline">Not installed</Badge>;
    case "installing":
      return (
        <Badge variant="info">Installing {Math.round((model.installProgress ?? 0) * 100)}%</Badge>
      );
  }
}

/** Visible help under a control. Works on touch, unlike a tooltip. */
export function HelpText(props: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
}) {
  return (
    <p id={props.id} className={cn("text-xs text-muted-foreground", props.className)}>
      {props.children}
    </p>
  );
}

/** Marks a figure that nobody checked yet. */
export function Unverified() {
  return (
    <span className="text-2xs font-medium text-warning-foreground uppercase tracking-wide">
      Not verified
    </span>
  );
}
