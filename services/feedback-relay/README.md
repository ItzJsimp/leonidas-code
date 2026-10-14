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
