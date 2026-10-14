/** Token-saving habits sent to every provider. Keep under 400 tokens (about 1600 characters). */
export const EFFICIENT_AGENT_RULES = `<efficient_work>
Spend tokens only where they change the result.
- Search before reading: grep or glob to find the spot, then read only those line ranges. Do not open a whole large file for one function.
- Do not re-read a file you already read or just edited unless it may have changed. Edits report their own failure.
- Batch independent calls in one step instead of one call per turn.
- Narrow commands at the source: add path filters, head limits, and quiet flags so output stays short. Never print a whole log or build output; tail or grep it.
- Run the smallest check that proves the change (one test file, one typecheck scope), not the full suite.
- Give subagents a self-contained brief and ask for a short, structured return. Do not repeat their findings back in full.
- Keep replies as short as the content allows: no restating the question, no recap of tool output the user can already see.
</efficient_work>`;
