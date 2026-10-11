---
name: leonidas-release
description: Choose development versions and write patch notes when preparing or shipping a Leonidas app update, including Code and Scribe.
---

# Leonidas releases

Reserve **1.0.0 for an explicitly approved public launch**. Before launch use 0.MINOR.PATCH: fixes and maintenance advance PATCH; new capabilities and breaking development changes advance MINOR and reset PATCH. After launch, breaking compatibility advances MAJOR. Never skip arbitrary patch numbers to suggest update size.

Use conventional commit subjects: `fix:`, `feat:`, `ci:`, or `feat!:` / `BREAKING CHANGE:`. Existing `Build:` subjects count as features. For a mixed update the largest category wins. Add one `Release-Note: <user-visible change>` trailer per useful bullet, written to the "Writing patch notes" standard below; a commit subject is never a good bullet. Do not include personal paths, credentials, transcripts, or agent scratch notes.

Read the app's current release and publisher before choosing a version. Leonidas Code uses `leonidas-release.json`, `scripts/leonidas-release.ts`, and `.github/workflows/team-release.yml`; the workflow computes the next version from commits since the previous published development release. A workflow-dispatch `release_kind` can override auto classification. Launch uses `launch` while the stage is development; change the stage to public after that launch is published.

Scribe's AIOS publisher is `scripts/Sync-ScribeDistro.ps1`; it defaults to `-ReleaseKind auto` and generates notes from Scribe commits since the previous source commit. Override with patch/minor/major only when the classification needs correction. Use `-ReleaseKind launch` explicitly for public launch. `scripts/LeonidasReleasePolicy.ps1` owns its version calculation. Scribe already stores past notes in release-history.json.

Publishing needs the user's authorization. Run scoped checks and build first. For Code, confirm a complete installer, blockmap, and latest.yml are published for the same source commit. Do not restart a user's live app as verification.

Code's first development release is 0.2.0. Existing legacy 1.0.x installations need a one-time installer migration because automatic updaters reject lower versions. Preserve app identity and user data. Subsequent 0.x releases update normally.

## Writing patch notes

Standard for Leonidas Code, Scribe and anything Jake builds. Adapted from Keep a Changelog (changelogs are for people, never a commit-log dump; group by Added / Changed / Fixed / Removed), the community `changelog-generator` and `writing-changelogs` skills (translate commits into user impact; breaking changes lead; never claim verified what was not), and the Linear and Raycast changelogs (verb-led one-line bullets that name the symptom, not the cause).

**Audience:** someone who has never seen the code and does not know what a provider, adapter or commit is. They read a popup for ten seconds and want to know what they can now do or no longer suffer.

**Bullet rules**

- Start with a verb in past tense: `Added`, `Improved`, `Fixed` (also `Changed`, `Removed`). Active voice. User-visible outcome first, cause never.
- 8 to 18 words. One idea per bullet; two outcomes become two bullets or one is dropped.
- Say what the user sees in the app (the reply label, the update popup, the usage panel), not what you edited. No file names, function names, package names, commit jargon, PR numbers or internal terms (`provider-core`, `RPC`, `contract`, `projection`, `CI`).
- Max 5 highlight bullets per release. Merge related ones or drop the weakest; never pad. A release with no user-visible change gets the single line `Behind-the-scenes reliability improvements`.
- Internal-only work (CI, refactors, tests, docs, dependency bumps) gets no bullet.
- Never claim what you did not run and see work. Unverified means no bullet.
- A change that needs the user to act (restart, re-sign-in, reinstall) says so in the bullet.
- Optional `## Details` for power users: extra specifics (limits, settings paths, edge cases), same verb-led style, no cap but stay terse.

**Rewrites from real Code commits**

| Commit subject (bad bullet)                                                 | Patch note (good)                                                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `fix(provider-core): suppress invented prediction reports and placeholders` | Fixed prompt suggestions sometimes showing invented text or empty placeholders.          |
| `feat(chat): show which model, effort and account ran each turn`            | Added a label on every reply showing which model, effort level and account produced it.  |
| `fix(tokens): rolling averages need a full window and use turn totals only` | Fixed speed averages showing misleading numbers before enough replies had been measured. |
| `fix(activity): keep long filenames inside the composer panel`              | Fixed long file names spilling outside the activity panel.                               |
| `fix(updates): use theme colors for the update notice`                      | Improved the update notice so it follows your chosen theme colors.                       |
| `feat(desktop): track update delivery and safely migrate legacy installs`   | Added a safe one-time switch for older installs so future updates arrive normally.       |
| `fix(ci): cache only the filtered desktop dependency store`                 | (no bullet: internal)                                                                    |

Rewrites are illustrations: check each against the diff or the running app before writing the real bullet.

**Trailer to bullet mapping** (`scripts/leonidas-release.ts` in the Code repo)

- Each `Release-Note:` trailer becomes exactly one bullet, verbatim, so write it in final form (starts with the verb). Put it on the commit that makes the outcome true; several trailers per commit are fine, and any commit type may carry one.
- Order: trailers first (features, then fixes, then the rest), then cleaned subjects of commits with no trailer. The first 5 distinct bullets are highlights; the overflow and every `Release-Detail:` trailer go under `## Details`. The cleaned-subject fallback is a safety net and reads badly: write a trailer on every user-visible `feat:` and `fix:` commit. Commits with no trailer and an internal type (`ci`, `chore`, `refactor`, `test`, `docs`, `style`, `sync`) are skipped.
- Output shape of `notes.md`: `# <version> · Development`, highlight `- ` bullets, optional `## Details` bullets, then one final line `<!-- leonidas-release {"commit":"<full sha>","authors":[...],"coAuthors":[...]} -->`. The update dialog parses it; never hand-edit or change it without telling whoever owns the dialog. Authors come from git author names (ItzJsimp is Jake, Seth Moncada is Mob); coAuthors come from `Co-Authored-By:` trailers (Claude and Anthropic names collapse to Claude), so keep that trailer on agent commits.
- Scribe's generator (`scripts/Sync-ScribeDistro.ps1`) should follow these wording rules; its output shape is still its own until aligned.

**Checklist before writing a `Release-Note:` trailer** (run silently, fix before committing)

1. Can a user see or feel this change? If not, no trailer.
2. Did I run it and see it work? If not, no trailer.
3. Does it start with Added / Improved / Fixed / Changed / Removed, in 8 to 18 words, one idea?
4. Does it open with what the user can now do or no longer suffers, not how it was built?
5. Does it contain zero file names, identifiers, package names, PR numbers or internal terms? Replace each with the thing on screen.
6. Would a friend who has never seen the app understand it without asking a question?
7. Are there already 5 highlights this release? Merge, drop the weakest, or use `Release-Detail:`.
8. Does the user need to act (restart, sign in again)? Say so.
