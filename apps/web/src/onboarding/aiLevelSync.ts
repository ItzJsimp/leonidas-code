import { useAtomValue } from "@effect/atom-react";
import { effectiveAiLevel, type AiLevel, type EnvironmentId } from "@t3tools/contracts";
import { useEffect } from "react";
import { serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";
import { toastManager } from "../components/ui/toast";
import type { GuidanceProfile } from "./guidance.logic";
import { AI_LEVELS, localDay, newGuidanceProfile } from "./guidance.logic";

/**
 * The server keeps the level every agent prompt reads. The local guidance profile is
 * where the user picks it. First sync: copy the local level, or start "new" today.
 * Later: a level change restarts the 30-day window.
 */
export function aiLevelSettingsPatch(
  server: { readonly aiLevel: AiLevel; readonly aiLevelSince: string },
  local: Pick<GuidanceProfile, "level" | "startedDay"> | null,
  today: string,
): { aiLevel: AiLevel; aiLevelSince: string } | null {
  if (server.aiLevelSince === "")
    return { aiLevel: local?.level ?? "new", aiLevelSince: local?.startedDay ?? today };
  if (local && local.level !== server.aiLevel) return { aiLevel: local.level, aiLevelSince: today };
  return null;
}

const STEP_UP_NOTICE_KEY = "leonidas:ai-level-step-up-notice";

export function useAiLevelServerSync(
  environmentId: EnvironmentId,
  profile: GuidanceProfile | null,
  setProfile: (profile: GuidanceProfile) => void,
) {
  const server = useAtomValue(serverEnvironment.settingsValueAtom(environmentId)) ?? null;
  const update = useAtomCommand(serverEnvironment.updateSettings, { reportFailure: false });
  const level = profile?.level;
  const startedDay = profile?.startedDay;
  useEffect(() => {
    if (!server) return;
    // The guide (where the level is changed) needs a profile; start an inactive one.
    if (!level) {
      setProfile({ ...newGuidanceProfile(server.aiLevel, new Date()), active: false });
      return;
    }
    const today = localDay(new Date());
    const local = level && startedDay ? { level, startedDay } : null;
    const patch = aiLevelSettingsPatch(server, local, today);
    if (patch) {
      void update({ environmentId, input: { patch } });
      return;
    }
    const effective = effectiveAiLevel(server.aiLevel, server.aiLevelSince, today);
    const notice = `${server.aiLevelSince}:${effective}`;
    if (effective === server.aiLevel || localStorage.getItem(STEP_UP_NOTICE_KEY) === notice) return;
    localStorage.setItem(STEP_UP_NOTICE_KEY, notice);
    const label = AI_LEVELS.find((candidate) => candidate.id === effective)?.label ?? effective;
    toastManager.add({
      type: "success",
      title: `You moved up to ${label}`,
      description:
        effective === "comfortable"
          ? "The agent now also asks before a big guess. Change your level in the guide."
          : "You get fewer tips now. Change your level in the guide.",
    });
  }, [environmentId, level, server, setProfile, startedDay, update]);
}
