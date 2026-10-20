# Feedback relay

A small Cloudflare Worker. The app posts a report to `POST /feedback`; the Worker validates it, rate-limits it (per install and per IP) and files it as an Issue in the private repo `ItzJsimp/leonidas-feedback`. The GitHub token lives only in the Worker's secrets, never in the app.

Not part of the pnpm workspace; deploy with Wrangler.

## One-time setup

1. `cd services/feedback-relay`
2. `npx wrangler login` (free Cloudflare account).
3. `npx wrangler kv namespace create RATE`, then put the printed id into `wrangler.toml`.
4. Create a fine-grained GitHub token limited to `ItzJsimp/leonidas-feedback` with Issues and Contents write, then `npx wrangler secret put GITHUB_TOKEN`.
5. `npx wrangler deploy`. Note the `https://leonidas-feedback-relay.<account>.workers.dev` URL.
6. Build the app with `VITE_LEONIDAS_FEEDBACK_URL=https://<that URL>/feedback`. Until it is set, the app hides every feedback entry point.

Tests: `vp test run services/feedback-relay`. Triage of what arrives: `.agents/skills/feedback-triage/SKILL.md`.

## Community routes (stuck reports, fixed-for-you, friends leaderboard)

These use a free-tier D1 database (`DB`) and random ids only: no names, emails or accounts. The schema is `schema.sql`.

| Route                                                                                 | What it does                                                                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `POST /stuck`                                                                         | Files a state-only "I'm stuck" report as an Issue (labels `stuck`, `needs-triage`). Every field must match a strict code pattern. |
| `GET /fixed?ids=`                                                                     | Returns the fix version for the report ids the app names. Nobody can list reports.                                                |
| `POST /admin/fixed`                                                                   | Marks the report for an issue as fixed in a version. Needs `Authorization: Bearer <ADMIN_TOKEN>`.                                 |
| `POST /board`, `/board/join`, `/board/score`, `/board/leave`, `GET /board/<code>?me=` | Invite-code friends leaderboard. Only joined members can post or read. A member with no nickname shows as "Friend N".             |

One-time setup (needs Jake): `npx wrangler d1 create leonidas-community`, paste the id into `wrangler.toml`, run `npx wrangler d1 execute leonidas-community --remote --file schema.sql`, then `npx wrangler secret put ADMIN_TOKEN`.

Local check: `npx wrangler dev --local --persist-to <dir>` and `npx wrangler d1 execute leonidas-community --local --persist-to <dir> --file schema.sql`. Tests use the same schema on SQLite: `vp test run services/feedback-relay`.
