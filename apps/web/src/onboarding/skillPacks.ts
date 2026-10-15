export interface BundledSkill {
  readonly name: string;
  readonly description: string;
  readonly body: string;
}

/** Every skill is written to both roots: Claude reads .claude/skills, Codex and others read .agents/skills. */
export const SKILL_ROOTS = [".claude/skills", ".agents/skills"] as const;

const lines = (...rows: readonly string[]): string => rows.join("\n");

export const SKILL_PACKS: Readonly<Record<string, readonly BundledSkill[]>> = {
  "web-apps": [
    {
      name: "plan-before-build",
      description:
        "Use before building a new web app or feature: clarify what it must do, then build the smallest working slice first.",
      body: lines(
        "# Plan before you build",
        "",
        "Use this when the user asks for a new app or a large feature.",
        "",
        "1. Restate the goal in one or two plain sentences and confirm it.",
        "2. Ask at most three questions about anything that would change the design (who uses it, what data it keeps, what it must never do).",
        "3. List the screens the user will see and the data each screen shows or saves.",
        "4. Pick the smallest slice that works from start to finish, for example one screen that saves one record.",
        "5. Build that slice first. Run it and show the user before adding more.",
        "6. Add the next slice only after the previous one works.",
        "7. Keep a short running list of what is done and what is left.",
        "",
        "Done looks like: the user can click through the smallest slice, and the remaining work is a clear list.",
      ),
    },
    {
      name: "ship-checklist",
      description:
        "Use when a web app is nearly ready to share: run a short checklist covering errors, empty states, mobile layout and secrets.",
      body: lines(
        "# Ship checklist",
        "",
        "Use this before telling the user the app is ready to share or deploy.",
        "",
        "1. Run the app from a clean start and click through every main flow once.",
        "2. Check what happens with no data, bad input and a failed network request. Each should show a clear message, not a blank page.",
        "3. Resize to phone width and make sure nothing overflows or is unreachable.",
        "4. Search the code for API keys, passwords and tokens. Move any into environment variables and make sure they are not committed.",
        "5. Run the project's tests, type check and build. Fix failures or explain them.",
        "6. Check that the page has a title and that buttons and fields have readable labels.",
        "7. Write down how to run and deploy the app in a short README section.",
        "",
        "Done looks like: every item is checked or has a note saying why it was skipped.",
      ),
    },
  ],
  websites: [
    {
      name: "landing-page-structure",
      description:
        "Use when building a landing page or marketing site: write the message first, then lay out sections that lead to one action.",
      body: lines(
        "# Landing page structure",
        "",
        "Use this when the user wants a page that convinces visitors to do one thing.",
        "",
        "1. Ask what single action the visitor should take (sign up, call, buy) and who the visitor is.",
        "2. Write the headline and one supporting sentence first. A stranger should understand the offer in five seconds.",
        "3. Lay out sections in this order: headline and action button, the problem, how it works, proof (quotes, logos, numbers), questions, final action.",
        "4. Use real or clearly marked placeholder text, never lorem ipsum.",
        "5. Keep one main action button style and repeat it.",
        "6. Build mobile layout first, then widen it.",
        "7. Show the user the result and adjust copy before polishing visuals.",
        "",
        "Done looks like: one clear action, readable on a phone, and every section earns its place.",
      ),
    },
    {
      name: "site-launch-check",
      description:
        "Use before publishing a website: check speed, links, images, titles, sharing previews and accessibility basics.",
      body: lines(
        "# Site launch check",
        "",
        "Use this right before a website goes live.",
        "",
        "1. Click every link and button. Fix or remove any that go nowhere.",
        "2. Check each page has a unique title and a short description for search results.",
        "3. Add alt text to meaningful images and compress large images so pages load quickly.",
        "4. Set a sharing image and title so links look right when posted.",
        "5. Test at phone, tablet and desktop widths.",
        "6. Check text contrast is readable and the page works with only a keyboard.",
        "7. Confirm a favicon exists and the contact form or email link really works.",
        "8. Report anything you could not check.",
        "",
        "Done looks like: a short list of what passed, what was fixed and what still needs the owner.",
      ),
    },
  ],
  "mobile-apps": [
    {
      name: "mobile-first-screens",
      description:
        "Use when designing a mobile app: map the screens and the thumb-friendly path through them before writing code.",
      body: lines(
        "# Mobile first screens",
        "",
        "Use this at the start of any phone app.",
        "",
        "1. Ask what the one most common task is. The app should make that task quick.",
        "2. List the screens and draw the path between them in plain text, for example Home > Detail > Edit.",
        "3. Keep the main actions within easy thumb reach, near the bottom of the screen.",
        "4. Make touch targets large enough to tap without mistakes.",
        "5. Decide what the app shows with no data, while loading, and when offline.",
        "6. Build the main path first with fake data, then connect real data.",
        "7. Test on a simulator or device after each screen, not only at the end.",
        "",
        "Done looks like: the main task works from start to finish on a phone-sized screen.",
      ),
    },
    {
      name: "app-store-readiness",
      description:
        "Use when preparing a mobile app for the App Store or Google Play: icons, permissions, privacy, crashes and test builds.",
      body: lines(
        "# App store readiness",
        "",
        "Use this when the user wants to publish a mobile app.",
        "",
        "1. List every permission the app asks for. Remove any it does not truly need and explain the rest in plain words.",
        "2. Confirm the app name, icon, splash screen and version number are set.",
        "3. Test on a real device, including a slow connection and no connection.",
        "4. Check the app does not crash on first launch, on rotate, or when returning from the background.",
        "5. Prepare a privacy policy link and describe what data the app collects.",
        "6. Prepare screenshots and a short description for each store.",
        "7. Build a test version and have someone other than the author try it.",
        "8. Note each store's review rules the app might trip, such as sign in requirements and payments.",
        "",
        "Done looks like: a test build installs cleanly and the store listing details are ready.",
      ),
    },
  ],
  automation: [
    {
      name: "automate-safely",
      description:
        "Use when writing a script that changes files, sends messages or calls services: preview first, keep it undoable.",
      body: lines(
        "# Automate safely",
        "",
        "Use this for any script that changes things on the user's behalf.",
        "",
        "1. Ask what the task looks like by hand, step by step, and what a correct result is.",
        "2. Write the script so it can run in dry-run mode that only prints what it would do.",
        "3. Run the dry run on a small sample and show the user the output.",
        "4. Never delete or overwrite without a backup or an easy way to undo.",
        "5. Keep secrets out of the script. Read them from environment variables.",
        "6. Log what happened each run with a time and a plain message.",
        "7. Make it safe to run twice: a second run should not repeat work.",
        "8. Only then run it for real, starting with a few items.",
        "",
        "Done looks like: a dry run, a small real run and a log the user can read.",
      ),
    },
    {
      name: "schedule-and-monitor",
      description:
        "Use when a script should run on a schedule: pick a trigger, handle failures and make problems visible.",
      body: lines(
        "# Schedule and monitor",
        "",
        "Use this once an automation works by hand and should run on its own.",
        "",
        "1. Confirm how often it should run and what should happen if a run is missed.",
        "2. Choose a simple trigger for the user's system, such as Task Scheduler, cron or a hosted scheduler.",
        "3. Make each run finish on its own and exit with a clear success or failure.",
        "4. Handle the common failures: no network, bad login, empty input. Retry briefly, then stop.",
        "5. Write results to a log file or send a short message when something fails.",
        "6. Run the schedule once with a short interval to prove it fires.",
        "7. Write down how to pause, change or remove the schedule.",
        "",
        "Done looks like: it runs without help, and a failure is noticed within a day.",
      ),
    },
  ],
  data: [
    {
      name: "understand-the-data",
      description:
        "Use at the start of any analysis: inspect the data, check quality and state what question is being answered.",
      body: lines(
        "# Understand the data",
        "",
        "Use this before calculating or charting anything.",
        "",
        "1. Ask what question the user wants answered and what decision it supports.",
        "2. Look at the first rows, the columns, the types and the number of rows.",
        "3. Count missing values, duplicates and odd values such as negative ages or future dates.",
        "4. Tell the user what you found and how you plan to handle each problem.",
        "5. Never silently drop or change rows. Keep the original file untouched and work on a copy.",
        "6. Write the cleaning steps as a script so the work can be repeated.",
        "7. Check one or two numbers by hand to confirm the script is right.",
        "",
        "Done looks like: clean data, a list of what changed and why, and a clear question to answer next.",
      ),
    },
    {
      name: "report-with-honest-charts",
      description:
        "Use when turning results into a report or chart: lead with the answer, pick the right chart and avoid misleading scales.",
      body: lines(
        "# Report with honest charts",
        "",
        "Use this when presenting analysis results to a reader.",
        "",
        "1. Start with the answer in one sentence, then show the evidence.",
        "2. Pick the chart by the question: lines for change over time, bars for comparing groups, points for relationships.",
        "3. Start bar charts at zero. Label axes with units.",
        "4. Use few colors and make each one mean something.",
        "5. Give every chart a title that states the takeaway.",
        "6. Say how many rows were used and mention anything excluded.",
        "7. Separate what the data shows from what you guess.",
        "8. Ask the user whether the story matches what they expected, and look again if it does not.",
        "",
        "Done looks like: a reader gets the point in under a minute and could repeat the numbers.",
      ),
    },
  ],
  agents: [
    {
      name: "design-the-agent",
      description:
        "Use when building an AI agent or bot: define its job, its tools and its limits before writing prompts or code.",
      body: lines(
        "# Design the agent",
        "",
        "Use this at the start of any assistant or bot project.",
        "",
        "1. Write the agent's job in one sentence and list three example requests it must handle.",
        "2. List the tools it needs (search, files, email, a database). Give it as few as possible.",
        "3. Decide which actions need human approval, such as sending, paying or deleting.",
        "4. Write clear instructions: its role, what to do, what never to do and how to say it is unsure.",
        "5. Build the simplest loop first: read request, call a tool, answer.",
        "6. Keep secrets and keys out of the prompt.",
        "7. Add logging so every tool call can be reviewed later.",
        "",
        "Done looks like: the three example requests work and risky actions wait for approval.",
      ),
    },
    {
      name: "test-the-agent",
      description:
        "Use after an agent works once: build a small set of test cases, including tricky and hostile inputs, and fix what fails.",
      body: lines(
        "# Test the agent",
        "",
        "Use this to find out how an agent behaves beyond the happy path.",
        "",
        "1. Write 10 test requests: easy ones, vague ones, ones outside its job and ones that try to make it break its rules.",
        "2. For each, write what a good answer looks like before running it.",
        "3. Run all of them and record the real answers.",
        "4. Mark each pass or fail and group the failures by cause.",
        "5. Fix the biggest cause first, usually in the instructions or tool descriptions.",
        "6. Rerun every test after each change so a fix does not break something else.",
        "7. Check that text from web pages or files cannot give it new orders.",
        "8. Keep the test list in the project for future changes.",
        "",
        "Done looks like: a saved test list with results, and known failures written down.",
      ),
    },
  ],
  games: [
    {
      name: "playable-in-one-hour",
      description:
        "Use when starting a game: get a tiny playable loop on screen first, then add features one at a time.",
      body: lines(
        "# Playable in one hour",
        "",
        "Use this at the start of any game.",
        "",
        "1. Ask for the core action in one sentence, for example jump over gaps or match three tiles.",
        "2. Build only that action with plain shapes instead of art.",
        "3. Add a way to win or lose and a way to restart.",
        "4. Play it. Fix anything that feels unfair or slow before adding more.",
        "5. Add features one at a time: score, enemies, levels, sound, art. Play after each one.",
        "6. Keep game rules in one place so they are easy to tune.",
        "7. Save a working copy before each big change.",
        "",
        "Done looks like: someone can play a full round from start to restart in the first version.",
      ),
    },
    {
      name: "game-feel-and-balance",
      description:
        "Use when a game works but feels flat or unfair: tune responsiveness, difficulty and feedback with small experiments.",
      body: lines(
        "# Game feel and balance",
        "",
        "Use this once the basic game loop works.",
        "",
        "1. Check controls respond right away. Fix input lag before anything else.",
        "2. Add feedback for each action: a sound, a small shake, a flash or a number popping up.",
        "3. Move tuning numbers (speed, damage, spawn rate) into one settings object.",
        "4. Change one number at a time and play for a minute after each change.",
        "5. Make the first minute easy and let difficulty rise slowly.",
        "6. Make losses feel fair: the player should know why they lost.",
        "7. Ask someone new to play and watch where they get stuck, without helping.",
        "8. Check the frame rate stays smooth on a modest computer.",
        "",
        "Done looks like: a new player understands the game quickly and wants one more round.",
      ),
    },
  ],
  design: [
    {
      name: "design-review",
      description:
        "Use when asked to improve how an interface looks: check spacing, hierarchy, color and text before changing anything.",
      body: lines(
        "# Design review",
        "",
        "Use this before polishing a screen.",
        "",
        "1. Look at the screen at phone and desktop widths and note the first thing your eye lands on. It should be the most important thing.",
        "2. Check spacing: related things are close together, unrelated things have clear gaps, and gaps repeat from a small set of sizes.",
        "3. Check text: at most two fonts, a clear size order, and lines short enough to read.",
        "4. Check color: one main color, plain neutrals, and enough contrast for text.",
        "5. Check every state: empty, loading, error, hover, focus and disabled.",
        "6. List the three biggest problems and fix them one at a time.",
        "7. Compare before and after side by side and keep only changes that helped.",
        "",
        "Done looks like: a short list of changes made and a screen that reads clearly at a glance.",
      ),
    },
    {
      name: "consistent-design-tokens",
      description:
        "Use when styles look uneven: gather colors, sizes and spacing into shared values and reuse them everywhere.",
      body: lines(
        "# Consistent design tokens",
        "",
        "Use this when a project has many slightly different colors, sizes or gaps.",
        "",
        "1. Search the styles for repeated colors, font sizes, spacing values and corner radii.",
        "2. Group near duplicates and pick one value for each group.",
        "3. Define the chosen values once as named variables, such as color-primary and space-4.",
        "4. Replace hard coded values with the named ones, a file at a time.",
        "5. Check each screen after each file so nothing shifts by mistake.",
        "6. Make dark mode and light mode use the same names with different values.",
        "7. Write a short note on how to add or change a value.",
        "",
        "Done looks like: new styles use the shared names, and changing one value updates the whole app.",
      ),
    },
  ],
  "fix-code": [
    {
      name: "reproduce-then-fix",
      description:
        "Use for any bug: reproduce it first, find the real cause, fix it, and prove the fix with a test.",
      body: lines(
        "# Reproduce, then fix",
        "",
        "Use this whenever something is broken.",
        "",
        "1. Ask what was expected, what happened, and the exact steps. Get any error text.",
        "2. Reproduce the problem yourself. If you cannot, say so and ask for more detail instead of guessing.",
        "3. Write a small failing test or script that shows the bug.",
        "4. Find the cause by reading the code path and checking values. Do not change code at random.",
        "5. Make the smallest change that fixes the cause, not only the symptom.",
        "6. Run the new test and the existing tests. All should pass.",
        "7. Look for the same mistake in similar places.",
        "8. Explain the cause and the fix in plain words.",
        "",
        "Done looks like: the failing test now passes, nothing else broke, and the cause is explained.",
      ),
    },
    {
      name: "safe-refactor",
      description:
        "Use when cleaning up or restructuring code: lock in current behavior with tests, then change in small verified steps.",
      body: lines(
        "# Safe refactor",
        "",
        "Use this to clean up code without changing what it does.",
        "",
        "1. State the goal, such as splitting a long function or removing duplicates, and what must not change.",
        "2. Run the existing tests. If the area has none, write tests for its current behavior first.",
        "3. Make one small change at a time: rename, extract, move, or delete unused code.",
        "4. Run the tests after every step. If one fails, undo that step and try a smaller one.",
        "5. Do not mix refactoring with new features or bug fixes.",
        "6. Commit after each working step with a clear message.",
        "7. Stop when the goal is met. Do not keep tidying unrelated code.",
        "",
        "Done looks like: behavior is unchanged, tests pass and the code is easier to read.",
      ),
    },
  ],
  learning: [
    {
      name: "explain-as-you-go",
      description:
        "Use when the user is learning: explain each step in plain words, define new terms and check understanding as you build.",
      body: lines(
        "# Explain as you go",
        "",
        "Use this when the user wants to understand the code, not only receive it.",
        "",
        "1. Before changing anything, say in one or two sentences what you are about to do and why.",
        "2. Use plain words. The first time a technical term appears, define it in a few words.",
        "3. Make small steps. After each one, say what changed and how to see it working.",
        "4. Point to the exact file and lines that matter instead of dumping everything.",
        "5. Offer a simple picture or analogy when an idea is abstract.",
        "6. Every so often, ask one short question to check the idea landed, and adjust if it did not.",
        "7. When there are two ways to do something, name both and explain why you chose one.",
        "8. End with a short recap of what was learned and what to try next.",
        "",
        "Done looks like: the user can explain in their own words what was built.",
      ),
    },
    {
      name: "small-exercises",
      description:
        "Use to help the user practice: give short exercises on what they just built, with hints before answers.",
      body: lines(
        "# Small exercises",
        "",
        "Use this after finishing a step so the user can try it themselves.",
        "",
        "1. Pick one idea from the work just done, such as a loop, a function or a click handler.",
        "2. Write an exercise that takes about five minutes and changes the existing project slightly.",
        "3. Give the goal and how to check success, but not the solution.",
        "4. If the user is stuck, give a hint first, then a bigger hint, and show the full answer only if asked.",
        "5. When they finish, review their solution kindly: what works, and one thing to improve.",
        "6. Offer a slightly harder follow-up that builds on the same idea.",
        "7. Keep a short list of ideas practiced so the next lesson can build on them.",
        "",
        "Done looks like: the user solved something by themselves and knows what to try next.",
      ),
    },
  ],
};

/**
 * Installed for everyone, whatever goals they picked: the habits that make
 * every other session better (get the plan right first, then hand off cleanly).
 * The grill pair follows mattpocock/skills: grilling does the interview,
 * grill-me is the short command that starts it.
 */
export const CORE_SKILLS: readonly BundledSkill[] = [
  {
    name: "grilling",
    description:
      "Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.",
    body: lines(
      "# Grilling",
      "",
      "Interview the user until you both understand the plan the same way. Every decision can open more decisions that depend on it.",
      "",
      "1. Find facts yourself first (files, code, settings). Ask the user only for decisions: goal, priority, taste and risk.",
      "2. Work in rounds. A round asks every open question that does not depend on another unanswered question.",
      "3. Ask each round with your question tool (Claude: AskUserQuestion; Codex: request_user_input), so the user picks from a popup. Use chat text only when no such tool exists.",
      "4. Give each question 2 to 4 real options. Put your recommended option first, end its label with (Recommended), and say what would change your pick.",
      "5. The tool takes at most 4 questions at a time. If more are open, ask the 4 that unblock the most first.",
      "6. After each round, work out which questions the answers opened, and ask the next round.",
      "7. Stop when no open decision is left. Give a short summary: what we decided, the tradeoffs we accepted, and the first step to build.",
      "",
      "Done looks like: the user confirms the summary, and only then does building start.",
    ),
  },
  {
    name: "grill-me",
    description: "A relentless interview to sharpen a plan or design.",
    body: lines(
      "# Grill me",
      "",
      'Load the "grilling" skill and follow it. If you cannot load skills by name, read ../grilling/SKILL.md.',
    ),
  },
  {
    name: "session-handoff",
    description:
      "Use when ending a chat or running low on context: write a handoff file so a fresh chat can continue exactly where this one stopped.",
    body: lines(
      "# Session handoff",
      "",
      'Use this when the user says "handoff", wants to close the chat, or the conversation has grown long.',
      "",
      "1. Make sure everything worth keeping is saved: finish or clearly mark any half-done edit, and list files you changed.",
      "2. Write one file named handoff-docs/YYYY-MM-DD-short-topic.md in the project folder.",
      "3. Put these headings in it: Goal, What is done, What is left (in order), Decisions and why, Files that matter, Commands to run, Open questions.",
      '4. Write for someone who has seen none of this chat. Use exact file names, commands and error messages, not "as discussed".',
      "5. Keep it under one page. Link to files instead of pasting their contents.",
      '6. Tell the user the file path and give them one sentence to paste into a new chat, such as "Continue from handoff-docs/<file>".',
      "",
      "Done looks like: a new chat can read the file and carry on without asking what happened.",
    ),
  },
];

const escapeYamlDoubleQuoted = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");

export function skillMarkdown(skill: BundledSkill): string {
  return `---\nname: ${skill.name}\ndescription: "${escapeYamlDoubleQuoted(skill.description)}"\n---\n\n${skill.body}\n`;
}

export function skillFiles(
  skill: BundledSkill,
  rootRelativeDir: string,
): readonly { relativePath: string; contents: string }[] {
  const root = rootRelativeDir.replace(/[\\/]+$/, "");
  return [{ relativePath: `${root}/${skill.name}/SKILL.md`, contents: skillMarkdown(skill) }];
}

export function suggestSkills(goalIds: readonly string[]): readonly BundledSkill[] {
  const seen = new Set<string>();
  const result: BundledSkill[] = [];
  const goalSkills = goalIds.flatMap((id) =>
    Object.hasOwn(SKILL_PACKS, id) ? SKILL_PACKS[id]! : [],
  );
  for (const skill of [...CORE_SKILLS, ...goalSkills]) {
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    result.push(skill);
  }
  return result;
}
