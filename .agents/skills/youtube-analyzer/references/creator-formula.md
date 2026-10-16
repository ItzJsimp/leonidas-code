# Creator formula detection

Read when the input is a channel rather than a single video.

## What changes

A channel is not a batch of videos to summarise. **The output is the creator's repeatable pattern, the formula, not per-video summaries.**

## Sampling

Pick **5-8 videos** that span the channel rather than its top performers alone:

- The 2-3 highest-viewed: what worked
- 2-3 recent: what they do _now_, since formulas drift
- 1-2 median performers: the baseline the hits are measured against

Run each at `--detail transcript` or `--detail efficient`. For long videos, `--start 0 --end 90` captures the hook, where most of the formula lives.

## What to extract

1. **Hook structure:** The first 15 seconds, transcribed across every sampled video, compared side by side.
2. **Pacing:** Time to first substantive point. Average scene change interval.
3. **Retention devices:** Open loops, callbacks, pattern interrupts, on-screen countdowns.
4. **Recurring segments:** Cold open, sponsor placement, recap, call to action.
5. **Visual furniture:** Repeated layouts, camera setups, b-roll treatment, on-screen code font.
6. **Monetisation and positioning:** Business model, product/offer ladder, backend services.

## Output

1. **🎙️ Creator Profile**: ≤8 bullets: niche, audience, growth signals, business model, cadence.
2. **🧬 The Formula**: the repeatable pattern as an actionable sequence with timings.
3. **⭐ Sampled Videos**: the 5-8 used with exact links, titles, and contribution.
4. **🌶️ Sauce**: ≤6 extractions tied to specific videos and timestamps.
5. **🔺 Delta**: memory/wiki check against host AIOS context.
6. **🔁 Applied to My Context**: ≤4 bullets mapping what the peer AIOS or Leonidas should adopt.

## Storage

Write the creator dossier to `raw/youtube/creators/<creator-slug>.md`. Log each sampled video under `raw/youtube/<creator-slug>/<video-slug>/`. Update `raw/youtube/youtube-index.md`.
