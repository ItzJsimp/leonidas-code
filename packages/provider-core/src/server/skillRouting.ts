/** Shared skill selection rule for every provider. */
export const MAX_SKILLS_PER_TASK = 5;

export const SKILL_ROUTING_INSTRUCTIONS = `<skill_routing>
Before substantive work, compare the task with the skills available in this session. Load the best matches, including design skills for UI work, even without a user command.
- Load at most ${MAX_SKILLS_PER_TASK} skills per task, best matches first. Read each once and follow it. Explicit user requests and required skills override this default.
- Use the session's skill list or supported discovery tools. Report missing skills; do not invent access.
- For each skill you choose, write: \`Using <skill>: <reason, 10 words or fewer>\`. Announce use only after you load it. User-named skills are manual; your choices are automatic.
</skill_routing>`;
