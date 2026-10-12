import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";

export function FolderCheckNotice({
  lines,
  onConfirm,
  onCancel,
  confirmLabel = "Use this folder anyway",
}: {
  readonly lines: readonly string[];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly confirmLabel?: string;
}) {
  return (
    <Alert variant="warning">
      <TriangleAlertIcon />
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
              Choose another folder
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
