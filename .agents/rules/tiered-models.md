# Tiered models (every agent, every provider)

Match the model to the work. Procedure for splitting work: the `ceo` skill (`/ceo`). This rule only says which tier does what.

## Tiers

| Work                                                                  | Model tier                     | Examples                                        |
| --------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------- |
| Plan, architecture, integration, final review, ranking and decisions  | Frontier (Opus 5.5, Fable 5.1) | You, as orchestrator                            |
| Bounded code edits and test runs                                      | Mid (Sonnet 5.5)               | One-file or one-area changes with a clear check |
| Read-only scans, searches, summaries, running a command and reporting | Light (Haiku 5.5)              | Branding sweeps, "where is X used", log triage  |
| Web research                                                          | Codex `gpt-6.1-sol`            | Read-only, `role: research`                     |

Pick the exact model from `orchestrator_capabilities`; never assume it exists.

## How

- Split read-only scans by area (web and mobile, desktop and marketing, server and packages) and run the workers in parallel. Parallel light workers matched a single frontier worker on accuracy and covered more ground (2026-10-12 branding scan).
- Give each worker a self-contained brief: goal, files, exclusions, return format, and a word cap. Ask for `file:line | string | fix` rows, not prose.
- You rank, dedupe and decide. Workers do not make product decisions; they flag them.
- Review a worker's diff or findings before building on it. Spot-check line numbers when you act on them.

## Do not delegate

- Tightly coupled or sequential work.
- A change smaller than the brief that would describe it.
- Two workers editing the same files.
- Anything that needs your conversation context.

## Cost claim

Token savings from this setup are **unproven here**: the harness returns no usage per worker, and a whole-repo frontier scan moved a Pro 5-hour meter by under 1%. Do not tell the user it saved a specific amount. Savings only matter on large jobs; measure those with before and after readings if the claim is needed.
