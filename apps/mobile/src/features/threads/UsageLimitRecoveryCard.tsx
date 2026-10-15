import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  selectProviderFailoverTargets,
  type ProviderFailoverTarget,
} from "@t3tools/client-runtime/state/provider-failover";
import { type EnvironmentId, MessageId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "../../components/AppText";
import { uuidv4 } from "../../lib/uuid";
import { useServerConfigs } from "../../state/entities";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";

export function UsageLimitRecoveryCard({
  thread,
  environmentId,
  canSwitchProvider,
}: {
  thread: EnvironmentThreadShell;
  environmentId: EnvironmentId;
  /** Whether the thread's session can hand its conversation to another provider. */
  canSwitchProvider: boolean;
}) {
  const updateMetadata = useAtomCommand(threadEnvironment.updateMetadata);
  const startTurn = useAtomCommand(threadEnvironment.startTurn);
  const providers = useServerConfigs().get(environmentId)?.providers;
  const failoverTargets = useMemo(
    () =>
      selectProviderFailoverTargets({
        providers: providers ?? [],
        current: thread.modelSelection,
        supportsHandoff: canSwitchProvider,
      }),
    [canSwitchProvider, providers, thread.modelSelection],
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resetAt = thread.runtime?.usageLimitResetAt ?? null;
  const canSchedule =
    resetAt !== null &&
    Date.parse(resetAt) > Date.parse(thread.latestRun?.completedAt ?? thread.updatedAt);
  const runId = thread.latestRun?.runId;
  const recovery = thread.limitRecovery;
  const scheduled =
    recovery?.runId === runId && recovery?.resetAt === resetAt && recovery?.autoResume;
  if (
    thread.runtime?.status !== "failed" ||
    thread.runtime.lastErrorClass !== "usage_limit" ||
    !runId
  )
    return null;
  const snoozed =
    recovery?.snooze === true &&
    recovery.runId === runId &&
    recovery.resetAt === resetAt &&
    resetAt !== null &&
    thread.snoozedUntil !== null &&
    Date.parse(thread.snoozedUntil) === Date.parse(resetAt);
  async function continueWith(target: ProviderFailoverTarget) {
    if (pending || !runId) return;
    setPending(true);
    setError(null);
    try {
      const result = await startTurn({
        environmentId,
        input: {
          creationSource: "mobile",
          threadId: thread.id,
          manualContinuationOfRunId: runId,
          modelSelection: target.modelSelection,
          message: {
            messageId: MessageId.make(uuidv4()),
            role: "user",
            text: "Continue where you left off. Check the saved conversation and unfinished work before taking action.",
            attachments: [],
          },
          runtimeMode: thread.runtimeMode,
          interactionMode: thread.interactionMode,
          dispatchMode: "start",
        },
      });
      if (result._tag === "Failure") throw squashAtomCommandFailure(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not change the AI account. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  async function toggle(action: "resume" | "snooze") {
    if (!resetAt || !runId || !canSchedule) return;
    if (action === "snooze" && !snoozed && Date.parse(resetAt) <= Date.now()) {
      setError("The reset time has passed. Send a new message to try again.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await updateMetadata({
        environmentId,
        input: {
          threadId: thread.id,
          limitRecovery: {
            runId,
            resetAt,
            ...(action === "resume" ? { autoResume: !scheduled } : { snooze: !snoozed }),
          },
        },
      });
      if (result._tag === "Failure") throw squashAtomCommandFailure(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not change this setting. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <View className="mx-3 mb-2 gap-2 rounded-xl border border-warning-foreground/25 bg-screen p-3">
      <Text className="text-sm text-warning-foreground">
        {resetAt
          ? `Usage limit resets ${DateTime.toDateUtc(DateTime.makeUnsafe(resetAt)).toLocaleString()}.`
          : "The AI service did not give a reset time. Send a new message when your usage is available."}
      </Text>
      {failoverTargets.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {failoverTargets.map((target) => (
            <Pressable
              key={target.modelSelection.instanceId}
              accessibilityRole="button"
              accessibilityLabel={`Continue in this chat using ${target.modelSelection.model} with conversation context`}
              disabled={pending}
              onPress={() => void continueWith(target)}
              className="self-start rounded-lg bg-subtle px-3 py-2 active:opacity-70"
            >
              <Text className="text-sm text-foreground">
                {pending ? "Starting..." : `Continue with ${target.label}`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : canSwitchProvider ? (
        <Text className="text-sm text-muted-foreground">
          No other Claude or Codex AI account is ready to continue this chat.
        </Text>
      ) : null}
      {canSchedule ? (
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={() => void toggle("resume")}
            className="self-start rounded-lg bg-subtle px-3 py-2 active:opacity-70"
          >
            <Text className="text-sm text-foreground">
              {scheduled ? "Cancel auto-resume" : "Resume at reset"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={pending || (!snoozed && Date.parse(resetAt!) <= Date.now())}
            onPress={() => void toggle("snooze")}
            className="self-start rounded-lg bg-subtle px-3 py-2 active:opacity-70"
          >
            <Text className="text-sm text-foreground">
              {snoozed ? "Bring back now" : "Snooze until reset"}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
