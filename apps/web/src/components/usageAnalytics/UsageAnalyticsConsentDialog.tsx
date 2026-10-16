import { useUsageAnalyticsStore } from "../../lib/usageAnalytics/usageAnalyticsStore";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";

/** First-run question. Nothing is sent until the user chooses Yes. */
export function UsageAnalyticsConsentDialog() {
  const consent = useUsageAnalyticsStore((state) => state.consent);
  const setConsent = useUsageAnalyticsStore((state) => state.setConsent);
  if (consent !== "unknown") return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setConsent("declined");
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help improve Leonidas Code?</DialogTitle>
          <DialogDescription>
            Share anonymous usage counts so we can see what works and what does not.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              We send: the app version, your system type, and how long and how often you use the
              app.
            </li>
            <li>We send: which areas of the app you open, and how long setup took.</li>
            <li>We never send: your messages, replies, code, file names, folder paths or keys.</li>
            <li>We use a random ID. It has no name, email or account.</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            You can change this at any time in Settings, General.
          </p>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConsent("declined")}>
            No thanks
          </Button>
          <Button onClick={() => setConsent("granted")}>Yes, share usage</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
