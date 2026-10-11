import { Button } from "../ui/button";
import { openReleaseHistoryDialog } from "./ReleaseHistoryDialog";

export function ReleaseHistoryButton({ className }: { readonly className?: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={className}
      onClick={() => openReleaseHistoryDialog()}
    >
      Update history
    </Button>
  );
}
