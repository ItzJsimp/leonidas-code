import { InfoIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";

export function FolderCheckNotice({
  lines,
  onConfirm,
  onCancel,
  confirmLabel = "Use this folder anyway",
  cancelLabel = "Choose another folder",
  tone = "warning",
}: {
  readonly lines: readonly string[];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly confirmLabel?: string | undefined;
  readonly cancelLabel?: string | undefined;
  /** `info` explains a normal case; `warning` flags a real risk. */
  readonly tone?: "info" | "warning";
}) {
  return (
    <Alert variant={tone}>
      {tone === "info" ? <InfoIcon /> : <TriangleAlertIcon />}
      <AlertDescription>
        <div className="space-y-2">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button size="compact" onClick={onConfirm}>
              {confirmLabel}
            </Button>
            <Button size="compact" variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
