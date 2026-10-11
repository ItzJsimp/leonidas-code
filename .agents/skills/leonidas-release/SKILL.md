---
name: leonidas-release
description: Choose development versions and write patch notes when preparing or shipping a Leonidas app update, including Code and Scribe.
---

# Leonidas releases

Reserve **1.0.0 for an explicitly approved public launch**. Before launch use 0.MINOR.PATCH: fixes and maintenance advance PATCH; new capabilities and breaking development changes advance MINOR and reset PATCH. After launch, breaking compatibility advances MAJOR. Never skip arbitrary patch numbers to suggest update size.

Use conventional commit subjects: `fix:`, `feat:`, `ci:`, or `feat!:` / `BREAKING CHANGE:`. Existing `Build:` subjects count as features. For a mixed update the largest category wins. Add one `Release-Note: <user-visible change>` trailer per useful bullet when the commit subject is too technical. State what changed for the user; do not include personal paths, credentials, transcripts, or agent scratch notes.

Read the app's current release and publisher before choosing a version. Leonidas Code uses `leonidas-release.json`, `scripts/leonidas-release.ts`, and `.github/workflows/team-release.yml`; the workflow computes the next version from commits since the previous published development release. A workflow-dispatch `release_kind` can override auto classification. Launch uses `launch` while the stage is development; change the stage to public after that launch is published.

Scribe's AIOS publisher is `scripts/Sync-ScribeDistro.ps1`; it defaults to `-ReleaseKind auto` and generates notes from Scribe commits since the previous source commit. Override with patch/minor/major only when the classification needs correction. Use `-ReleaseKind launch` explicitly for public launch. `scripts/LeonidasReleasePolicy.ps1` owns its version calculation. Scribe already stores past notes in release-history.json.

Publishing needs the user's authorization. Run scoped checks and build first. For Code, confirm a complete installer, blockmap, and latest.yml are published for the same source commit. Do not restart a user's live app as verification.

Code's first development release is 0.2.0. Existing legacy 1.0.x installations need a one-time installer migration because automatic updaters reject lower versions. Preserve app identity and user data. Subsequent 0.x releases update normally.
