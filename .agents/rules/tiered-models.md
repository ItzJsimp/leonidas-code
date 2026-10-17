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

## Before you spawn

1. Call `orchestrator_capabilities` and read each account's quota windows (5-hour session and weekly).
2. Skip every account at 85% or more in any window. A child there stops at the limit and loses its work.
3. Rank the remaining accounts by headroom, then by tier fit. Prefer the cheapest tier that can do the work.
4. State the choice in one line before you spawn: account, model, and its highest window percent.
5. If no account has room, do the work yourself or ask the user. Do not spawn and hope.

The app enforces two gates on every `delegate_task`, not only on named subagents:

- **Quota guard:** a spawn on an account at the `subagentQuotaBlockPercent` setting (default 90%) fails, and the error names the accounts with room.
- **Confirm tier (ADR-0082):** a model outside the free tier (Haiku, Luna, Flash Low and Medium) waits for the user's approval card.

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
