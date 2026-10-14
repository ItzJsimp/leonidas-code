# Output standard: repo additions

The reply shape (Top / Body / Dock) is injected by the app for every provider. Single source: `LEONIDAS_OUTPUT_STANDARD` in [outputStandard.ts](../../packages/provider-core/src/server/outputStandard.ts); change it there and in the Dock parser together. Personal AIOS files may add a banner line above Focus (for example `**Active Mode:**`). This file holds only what this repo adds.

## Pushed-to-main banner

A successful push to `main` ends the work, so the reply must say so unmistakably. The `PostToolUse` hook `scripts/Hook-PushCompleteSignal.ps1` reminds the agent; the rule applies even if the hook did not fire.

Only when every ask in this chat is done and verified, end the reply with this block in place of `### ⚡ Immediate Next Actions`:

```
════════════════════════════════════════
🏁 SESSION COMPLETE · SHIPPED TO MAIN
════════════════════════════════════════
```

- ✅ **Done:** <each original ask, one line each, max 5>
- 🚀 **Shipped:** commit `<hash>` on `main`; release run `<queued|running|passed>` (state only what you observed)
- 🧼 **Left behind:** <nothing, or uncommitted files that belong to someone else>
- 🔒 **This chat is finished. You can close it now.** Start a fresh chat for the next objective.

If any ask is still open or unverified, end with `⏳ PUSHED, SESSION CONTINUES` and list what is left. Never show both.
