import type { EnvironmentId } from "@t3tools/contracts";
import { AI_LEVELS, decodeAiLevel, newGuidanceProfile } from "../../onboarding/guidance.logic";
import { useGuidanceProfile } from "../../onboarding/useGuidanceProfile";
import { Button } from "../ui/button";
import { Radio, RadioGroup } from "../ui/radio-group";

export function AiLevelStep({
  environmentId,
  onBack,
  onContinue,
}: {
  environmentId: EnvironmentId | undefined;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [profile, setProfile] = useGuidanceProfile(environmentId);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How much have you used AI?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This sets your guidance level. Everyone gets the basic tour. You can change this later.
        </p>
      </div>
      <RadioGroup
        aria-label="AI experience"
        value={profile?.level ?? "new"}
        onValueChange={(value) => {
          const level = decodeAiLevel(value);
          setProfile((current) =>
            current
              ? { ...current, level }
              : { ...newGuidanceProfile(level, new Date()), active: false },
          );
        }}
      >
        {AI_LEVELS.map((level) => (
          <label
            key={level.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4"
          >
            <Radio value={level.id} />
            <span className="space-y-1 text-sm">
              <span className="block font-medium">{level.label}</span>
              <span className="block text-muted-foreground">{level.description}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <p className="text-sm text-muted-foreground">
        For thirty days, your guide gives written tips, daily practice, and weekly checks. AI
        explanations run only when you request them.
      </p>
      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          title="Save your AI level and continue setup"
          onClick={() => {
            if (!profile) setProfile({ ...newGuidanceProfile("new", new Date()), active: false });
            onContinue();
          }}
        >
          Save AI level
        </Button>
      </div>
    </div>
  );
}
