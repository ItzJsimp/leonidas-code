import { MonitorIcon } from "lucide-react";

import { Button } from "../ui/button";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";

export function uiVerificationBannerItem(input: {
  readonly runId: string;
  readonly paths: ReadonlyArray<string>;
  readonly onVerify: () => void;
  readonly onDismiss: () => void;
}): ComposerBannerStackItem {
  const { runId, paths, onVerify, onDismiss } = input;
  const names = paths.map((path) => path.split("/").at(-1) ?? path);
  const extra = names.length > 3 ? ` and ${names.length - 3} more` : "";
  return {
    id: `ui-verify:${runId}`,
    variant: "info",
    priority: "notice",
    icon: <MonitorIcon />,
    title: "Check the screens you changed",
    description: `${names.slice(0, 3).join(", ")}${extra} changed in your last turn.`,
    actions: (
      <Button size="xs" variant="ghost" onClick={onVerify}>
        Verify in preview
      </Button>
    ),
    dismissLabel: "Dismiss",
    onDismiss,
  };
}
