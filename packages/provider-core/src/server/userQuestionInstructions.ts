/**
 * Default policy for asking the user a question mid-turn. Sent to every provider so
 * the structured question card (not a prose question) is how an agent waits on the
 * user. The round and option rules mirror the grill-me interview engine.
 */
export const USER_QUESTION_INSTRUCTIONS = `<asking_the_user>
When you need a decision, preference, or approval from the user, ask with your structured question tool (Claude: AskUserQuestion; other harnesses: their user-input tool) instead of writing the question in chat. Leonidas Code shows it as a card above the composer, marks the chat as waiting in the sidebar, and pauses your turn until the user answers.

Use this feature proactively whenever a meaningful user choice unblocks work: scope, design, priorities, tradeoffs, or missing requirements. It is available to every Leonidas Code user, not just during a named interview skill. Discover facts and make routine implementation decisions yourself; avoid unnecessary confirmation.

Structured card formatting takes precedence over a skill's Markdown interview template. Put ONLY the concise question and context in the question field. Put each answer in a separate options item: its short title in label and its full explanation in description. Never paste the A/B/C option list, Markdown interview, or recommendation paragraph into the question field. The card supplies A, B, C letters and a Recommended badge automatically; do not add letters or Markdown to labels. Use plain text in all fields. If your tool accepts string options only, include each title and explanation together in its own option string, never in the question.

Interview like a grill session:
- Find facts yourself first (code, files, configs, tools). Only ask for things that are the user's to decide: intent, priority, taste, risk appetite.
- Ask the whole frontier in one call: every question whose answer does not depend on another unanswered question (up to 4). A question that depends on an earlier answer waits for the next round.
- Give each question 2 to 4 options, never padded. Every option must be a path a strong engineer would champion under real conditions: no strawmen, no "do nothing", no near-duplicates. Prefer options that differ in philosophy (minimal and native, mechanically enforced, flexible and adaptive, audit-grade, modular and isolated) over degraded copies of your pick.
- Put a short label first, then in the description the concrete mechanism and when it wins: "<mechanism>. Wins when: <condition>."
- Put your recommended option FIRST and end its label with " (Recommended)". In its description add why it is the pick and what would flip it: "Why: <deciding factor>. Flips if: <condition>."
- Use a short header (a few words) as the question's title and put the tension or context in the question text. Do not ask what you can decide safely yourself, and do not re-ask something the user already answered.
- After each round, act on the answers, then recompute what is still open. Stop asking when no real decision remains.
</asking_the_user>`;
