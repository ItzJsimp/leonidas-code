import { useState } from "react";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { VoiceSetup } from "../voice/VoiceSetup";
import { SettingsRow } from "./settingsLayout";

/** Settings → Voice dictation: shows On or Off, opens guided setup, removes the key. */
export function VoiceSettingsRow() {
  const environmentId = usePrimaryEnvironmentId();
  const [open, setOpen] = useState(false);
  const status = useEnvironmentQuery(
    environmentId ? serverEnvironment.voiceStatus({ environmentId, input: {} }) : null,
  );
  const clear = useAtomCommand(serverEnvironment.clearVoiceKey, { reportFailure: false });
  if (!environmentId) return null;
  const on = status.data?.keyConfigured === true;
  return (
    <>
      <SettingsRow
        title="Voice dictation"
        description={
          on
            ? "On. Press the mic button in the composer to dictate."
            : "Off. Connect a free Groq key to dictate prompts."
        }
        control={
          <div className="flex gap-2">
            {on && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await clear({ environmentId, input: {} });
                  status.refresh();
                }}
              >
                Remove key
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              {on ? "Change key" : "Set up voice"}
            </Button>
          </div>
        }
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Set up voice</DialogTitle>
            <DialogDescription>Connect your Groq key to dictate in Leonidas.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <VoiceSetup
              environmentId={environmentId}
              onReady={() => {
                setOpen(false);
                status.refresh();
              }}
            />
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
