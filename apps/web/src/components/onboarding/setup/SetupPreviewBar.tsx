import { endSetupPreview, isSetupPreview } from "../../../onboarding/setupPreview";
import { Button } from "../../ui/button";

/** Shown on every preview screen, so a test run is never mistaken for real setup. */
export function SetupPreviewBar() {
  if (!isSetupPreview()) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs"
    >
      <span>Preview: you see setup as a new user. Nothing is saved.</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          endSetupPreview();
          // A full load makes every screen read the restored setup state.
          window.location.assign("/command-center");
        }}
      >
        End preview
      </Button>
    </div>
  );
}
