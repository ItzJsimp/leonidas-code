import type { EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";
import { ComposerVoiceButton } from "../voice/ComposerVoiceButton";
import { VoiceSetup } from "../voice/VoiceSetup";
import { Button } from "../ui/button";

export function VoiceStep({
  environmentId,
  onBack,
  onContinue,
}: {
  environmentId: EnvironmentId | undefined;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [transcript, setTranscript] = useState("");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Use your voice</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up dictation before your first conversation. You can type at any time.
        </p>
      </div>
      {environmentId ? (
        <>
          {!ready && <VoiceSetup environmentId={environmentId} onReady={() => setReady(true)} />}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-medium">Try one sentence</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Press the mic, say “Help me plan my first project,” then press Stop.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <ComposerVoiceButton
                environmentId={environmentId}
                disabled={false}
                onText={(text) => {
                  setTranscript(text);
                  setReady(true);
                  return true;
                }}
              />
              <p role="status" className="text-sm">
                {transcript || "Your words will appear here."}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p role="status">Connect a computer before you set up voice.</p>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onContinue}>
            Set up later
          </Button>
          <Button type="button" disabled={!transcript} onClick={onContinue}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
