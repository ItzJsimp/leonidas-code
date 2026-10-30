import type { ScribeGoals } from "@t3tools/contracts";
import { CheckIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "~/lib/utils";
import { useEnvironmentQuery } from "~/state/query";
import { scribeGoalsQuery } from "~/state/scribe";
import { Button } from "../ui/button";
import type { ScribeTabProps } from "./ScribePage";
import {
  EmptyNote,
  Glyph,
  Meter,
  StatsPlaceholder,
  StatsSection,
  useRefreshOnDictation,
} from "./StatsParts";
import {
  ACHIEVEMENTS_ON_PHONE,
  STATS_INPUT,
  formatCount,
  levelModel,
  percentOf,
  unlockedCount,
} from "./stats.logic";

export function ScribeGoalsTab({ environmentId, live }: ScribeTabProps) {
  const query = useEnvironmentQuery(scribeGoalsQuery({ environmentId, input: STATS_INPUT }));
  useRefreshOnDictation(`goals:${environmentId}`, live, query.refresh);
  const goals = query.data;
  if (goals === null) {
    return <StatsPlaceholder failed={query.error !== null} onRetry={query.refresh} />;
  }
  const level = levelModel(goals);
  const today = goals.today;
  const started = goals.metrics.dictations > 0;
  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">{goals.rank}</h2>
          <p className="text-sm text-muted-foreground">
            Level {goals.level} · {formatCount(goals.xp)} XP
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            <Meter
              size="md"
              percent={level.percent}
              label={`Progress to level ${goals.level + 1}`}
            />
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {formatCount(level.toNext)} XP to level {goals.level + 1}
              </span>
              {level.nextRank ? <span>{level.nextRank}</span> : null}
            </div>
          </div>
        </header>
        {started ? (
          <>
            <StatsSection title="Today">
              <dl className="flex flex-col gap-3 text-sm">
                <TodayRow
                  label="Words"
                  value={`${formatCount(today.words)} of ${formatCount(today.goal)}`}
                  percent={percentOf(today.words, today.goal)}
                />
                <TodayRow
                  label="Deep prompts"
                  value={`${today.deep} of ${today.deepGoal}`}
                  percent={percentOf(today.deep, today.deepGoal)}
                />
                <TodayRow label="XP earned" value={`+${formatCount(today.xp)}`} />
                <TodayRow
                  label="Streak"
                  value={`${goals.streak} ${goals.streak === 1 ? "day" : "days"} · best ${goals.bestStreak}`}
                />
              </dl>
              <p className="text-xs text-pretty text-muted-foreground">
                A deep prompt is a long message: 100 or more words to an AI app. You earn 1 XP per
                word, and 1.5 XP per word in an AI app.
              </p>
            </StatsSection>
            <StatsSection
              title="Daily quests"
              aside={`${goals.questsDone} of ${goals.quests.length} done`}
            >
              <ul className="flex flex-col divide-y divide-border">
                {goals.quests.map((quest) => (
                  <li key={quest.id} className="flex flex-col gap-1 py-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        {quest.done ? (
                          <CheckIcon
                            aria-label="Done"
                            className="size-4 shrink-0 text-success-foreground"
                          />
                        ) : null}
                        <span className="truncate">{quest.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {quest.done
                          ? ""
                          : `${formatCount(quest.have)} of ${formatCount(quest.need)} · `}
                        +{quest.xp} XP
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{quest.desc}</p>
                    <Meter percent={quest.done ? 100 : percentOf(quest.have, quest.need)} />
                  </li>
                ))}
              </ul>
            </StatsSection>
          </>
        ) : (
          <EmptyNote title="Say something to earn your first XP.">
            Hold your Scribe shortcut and speak. Quests and achievements start counting right away.
          </EmptyNote>
        )}
        {goals.truncated ? (
          <p className="text-xs text-muted-foreground">Based on your latest 5,000 dictations.</p>
        ) : null}
      </div>
      <Achievements achievements={goals.achievements} />
    </div>
  );
}

/** A dt and dd pair. The bar sits inside the dd, so the list stays valid HTML. */
function TodayRow(props: {
  readonly label: string;
  readonly value: string;
  readonly percent?: number;
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3">
      <dt>{props.label}</dt>
      <dd className="col-span-2 grid grid-cols-subgrid items-center">
        <span>{props.percent === undefined ? null : <Meter percent={props.percent} />}</span>
        <span className="text-right text-muted-foreground tabular-nums">{props.value}</span>
      </dd>
    </div>
  );
}

/** Every row keeps the same three lines, so locked and unlocked rows line up. */
function Achievements({ achievements }: { readonly achievements: ScribeGoals["achievements"] }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <StatsSection
      title="Achievements"
      aside={`${unlockedCount(achievements)} of ${achievements.length} unlocked`}
    >
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {achievements.map((achievement, index) => {
          const locked = !achievement.unlocked;
          return (
            <li
              key={achievement.id}
              className={cn(
                "grid grid-cols-[1.75rem_minmax(0,1fr)] content-start items-start gap-x-2.5 gap-y-0.5 py-2",
                !showAll && index >= ACHIEVEMENTS_ON_PHONE && "max-sm:hidden",
              )}
            >
              <span
                className={cn(
                  "row-span-2 grid size-7 place-items-center rounded-lg",
                  locked ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
                )}
              >
                <Glyph name={achievement.glyph} locked={locked} />
              </span>
              <span
                className={cn("text-sm font-medium text-pretty", locked && "text-muted-foreground")}
              >
                {achievement.name}
              </span>
              <span className="text-xs text-pretty text-muted-foreground">{achievement.how}</span>
              <span className="col-start-2 mt-1 grid min-h-4 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                {locked ? (
                  <>
                    <Meter tone="neutral" percent={percentOf(achievement.have, achievement.need)} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatCount(achievement.have)} of {formatCount(achievement.need)}
                    </span>
                  </>
                ) : (
                  <span className="sr-only">Unlocked</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {achievements.length > ACHIEVEMENTS_ON_PHONE ? (
        <Button
          size="sm"
          variant="outline"
          className="self-start sm:hidden"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show fewer" : `Show all ${achievements.length}`}
        </Button>
      ) : null}
    </StatsSection>
  );
}
