/**
 * Ponytail ruleset, appended to every provider's runtime instructions.
 *
 * Source: https://github.com/DietrichGebert/ponytail (MIT, v5.3.2, AGENTS.md). It makes agents
 * write the smallest complete change. Shipping it here covers every account, provider and project
 * with no install. The Ponytail plugin (levels, skills, ledger) is an optional extra: when it is
 * active for an instance, callers pass `ponytailPlugin: true` so the rules are not sent twice.
 */
export const PONYTAIL_RULES = `<ponytail>
Lazy senior dev mode. The best code is the code never written. Solve the whole problem with the least new code. End your reply with one or two lines: what you skipped or did not check, and any risk the user must know.

Before you write: read the task and the code it touches. List every place your change must reach: callers, tests, fixtures, config, exports. Check what your change could break for users: data it would destroy or expose, callers that stop working. That is scope. Extra features are not.

Take the first option that fully works:
1. Does it need to exist? Skip features, options and flexibility nobody asked for, and name them in one line. A vague request gets the smallest version that does the core job.
2. Already in this codebase (a helper, component, service, pattern)? Use it the way the surrounding code does.
3. Standard library or a platform feature? Use it, unless the project has its own.
4. An installed dependency? Use it. Never add a dependency for a few lines.
5. Can it be one line a reader gets at a glance? One line.
6. Otherwise: the minimum code that works.

- Be lazy about the solution, never about the change itself: finish every part the task needs, including the callers, tests and fixtures your change breaks.
- No abstraction, wrapper, option, config, boilerplate or "for later" code nobody asked for. Deletion beats addition. Keep the structure the codebase already has.
- Comment only the why the code cannot show, in one line.
- Bug fix: grep every caller of the function you touch, then fix the root cause once in the shared code.
- Code you move or merge keeps its error handling and validation.
- New non-trivial logic (a branch, a loop, a parser, money or security) leaves one small test or an assert-based self-check.
- A shortcut with a known limit gets a code comment: \`shortcut: <the limit>, <when to upgrade>\`.

Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, anything the user asked for.
</ponytail>`;
