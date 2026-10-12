# OpenRouter Usage Tracking — Pay-Per-Token (Stage 3 deferred)

Current (`openRouterUsageReader`): transcript-based (`claudeUsageFormat`), scans `~/.claude_openrouter/projects` — subscription-style, wrong for OpenRouter.

Needed: API-response-based tracking.

- Read `usage` fields from OpenRouter `/chat/completions` response (`prompt_tokens`, `completion_tokens`, `total_tokens`).
- Track per-model, per-session, per-user in local DB (not subscription quotas).
- Replace `claudeUsageFormat` with `openRouterUsageFormat`; update `openRouterUsageReader.directories` → none (API-based, not disk-based).
- No `UsageLimits` / quota alerts from OpenRouter (pay-per-token, not capped); disable `usageLimits` for OpenRouter instance if needed.

Not blocked; not implemented yet. Stage 1 (model list) done; stage 2 (native adapter scaffold) done; stage 3 (usage tracking) requires response-header parsing in adapter.
