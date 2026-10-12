import { ArrowRightIcon } from "lucide-react";

import { useLocalStorage } from "../../hooks/useLocalStorage";
import {
  LEONIDAS_GOALS,
  LEONIDAS_GOALS_STORAGE_KEY,
  LeonidasGoalsSchema,
  normalizeGoalIds,
  toggleGoal,
} from "../../onboarding/leonidasSetup.logic";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea } from "../ui/scroll-area";

export function LeonidasGoalsStep({ onContinue }: { readonly onContinue: () => void }) {
  const [stored, setStored] = useLocalStorage(LEONIDAS_GOALS_STORAGE_KEY, [], LeonidasGoalsSchema);
  const selected = normalizeGoalIds(stored);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Welcome to Leonidas Code
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        What will you mostly use it for? Pick any that fit. We will tailor skills and setup to
        match.
      </p>
      <ScrollArea scrollFade className="mt-5 h-auto max-h-[min(32rem,55dvh)]">
        <div className="grid grid-cols-1 gap-1 pr-3 sm:grid-cols-2">
          {LEONIDAS_GOALS.map((goal) => (
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
      </ScrollArea>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onContinue}>
          Skip
        </Button>
        <Button autoFocus onClick={onContinue}>
          Continue
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </>
  );
}
