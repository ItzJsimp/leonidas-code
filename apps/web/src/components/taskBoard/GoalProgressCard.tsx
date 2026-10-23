import { AiosHomeCard } from "./AiosHomeCard";
import { DirectionSection } from "./DirectionSection";

/** One card for where you are headed: the next move, today's priorities, goals and the plan. */
export function GoalProgressCard() {
  return (
    <section
      aria-labelledby="goal-progress-title"
      className="flex flex-col gap-5 rounded-lg border border-border p-5"
    >
      <h2 id="goal-progress-title" className="text-base font-semibold">
        Goal progress
      </h2>
      <AiosHomeCard bare />
      <DirectionSection bare />
    </section>
  );
}
