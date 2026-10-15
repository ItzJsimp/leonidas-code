# Leonidas Code: status log (read on demand)

Newest first, one line per session, who and what. Add your line at the top. Keep the newest 3 here; older entries go to [status-log-archive.md](./status-log-archive.md).

- 2026-10-15 Jake's agent (Claude Opus 5.5): grill skills realigned with mattpocock/skills (AIOS ADR-0077). Starter skills now ship `grilling` plus a one-line `grill-me`; grilling asks each round through the question popup. `skillPacks.test.ts` 5/5. Live popup round not yet seen.
- 2026-10-14 Mob's agent (Claude Sonnet 5.5): usage card screenshot on the Trim-fix build showed the breakdown in its estimated fallback (Other / unattributed, Tool calls, Messages), so the Trim MCP rows could not be checked and the setup rows would have called 171k of transcript "setup". `estimateFixedOverheadTokens` now returns 0 when any used category is estimated, which hides the rows. Local commit, not pushed. Trim MCP scaling still unseen live.
- 2026-10-14 Mob's agent (Claude Sonnet 5.5): setup rows verified live on v0.59.1 (39,633 setup + 134,772 chat = the 174k context). Trim MCP rows now scale server schema sizes to the provider's loaded "MCP tools" total (`deriveTrimSuggestions`), shown with `~`, so a deferred server no longer claims tens of thousands of tokens. Waste list and the cache warning's firing case remain tested only, not seen live.
