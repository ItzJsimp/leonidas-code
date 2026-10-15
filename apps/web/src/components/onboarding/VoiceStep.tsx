import type { EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";
import { ComposerVoiceButton } from "../voice/ComposerVoiceButton";
import { VoiceSetup } from "../voice/VoiceSetup";
import { Button } from "../ui/button";
import { useEnvironmentQuery } from "../../state/query";
import { serverEnvironment } from "../../state/server";

export function VoiceStep({
  environmentId,
  onBack,
  onContinue,
}: {
  environmentId: EnvironmentId | undefined;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [configuredFor, setConfiguredFor] = useState<EnvironmentId | null>(null);
  const [spokenTest, setSpokenTest] = useState<{
    environmentId: EnvironmentId;
    text: string;
  } | null>(null);
  const status = useEnvironmentQuery(
    environmentId ? serverEnvironment.voiceStatus({ environmentId, input: {} }) : null,
  );
  const ready =
    environmentId !== undefined &&
    (configuredFor === environmentId || status.data?.keyConfigured === true);
  const transcript =
    spokenTest && spokenTest.environmentId === environmentId ? spokenTest.text : "";
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
          {!ready && (
            <VoiceSetup
              key={environmentId}
              environmentId={environmentId}
              onReady={() => setConfiguredFor(environmentId)}
            />
          )}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-medium">Try one sentence</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Press the mic, say “Help me plan my first project,” then press Stop.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <ComposerVoiceButton
                environmentId={environmentId}
                disabled={!ready}
                onText={(text) => {
                  setSpokenTest({ environmentId, text });
                  return true;
                }}
              />
              <p role="status" className="text-sm">
                {transcript || "Your words will appear here."}
              </p>
            </div>
          </div>
          {!ready && (
            <p role="status" className="text-sm text-muted-foreground">
              {status.isPending
                ? "Checking saved voice setup..."
                : "Add your Groq key above to enable the spoken test."}
            </p>
          )}
          {status.error && !ready && (
            <Button type="button" variant="outline" onClick={status.refresh}>
              Check voice status
            </Button>
          )}
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
