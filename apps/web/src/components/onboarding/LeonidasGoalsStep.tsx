import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";

import { PRIVACY_POLICY_URL } from "../../legalLinks";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import {
  LEONIDAS_GOALS,
  LEONIDAS_GOALS_STORAGE_KEY,
  LeonidasGoalsSchema,
  normalizeGoalIds,
  selectVisibleGoals,
  toggleGoal,
} from "../../onboarding/leonidasSetup.logic";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea } from "../ui/scroll-area";

export function LeonidasGoalsStep({ onContinue }: { readonly onContinue: () => void }) {
  const [stored, setStored] = useLocalStorage(LEONIDAS_GOALS_STORAGE_KEY, [], LeonidasGoalsSchema);
  const selected = normalizeGoalIds(stored);
  const [showAll, setShowAll] = useState(false);
  const visibleGoals = selectVisibleGoals(selected, showAll);
  const hiddenCount = LEONIDAS_GOALS.length - visibleGoals.length;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome to Leonidas</h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        What will you mostly use it for? Pick all that fit. We will pick skills and setup to match.
      </p>
      <ScrollArea scrollFade className="mt-5 h-auto max-h-[min(32rem,55dvh)]">
        <div className="grid grid-cols-1 gap-1 pr-3 sm:grid-cols-2">
          {visibleGoals.map((goal) => (
            <label
              key={goal.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted/40"
            >
              <Checkbox
                checked={selected.includes(goal.id)}
                onCheckedChange={() => setStored([...toggleGoal(selected, goal.id)])}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{goal.label}</span>
                <span className="block text-xs text-muted-foreground">{goal.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {hiddenCount > 0 ? (
          <Button size="xs" variant="ghost-muted" className="mt-1" onClick={() => setShowAll(true)}>
            Show {hiddenCount} more
          </Button>
        ) : null}
      </ScrollArea>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Leonidas collects anonymous usage data to help us improve it. To learn how we use your data
        and how to opt out, read our{" "}
        <a
          className="underline underline-offset-2 hover:text-foreground"
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          privacy policy
        </a>
        .
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button autoFocus onClick={onContinue}>
          Continue
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </>
  );
}
