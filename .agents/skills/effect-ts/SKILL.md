---
name: effect-ts
description: "Use this skill when setting up a repository that uses the Effect Typescript library."
scope: structural
distribution: template
type: skill
id: skill-effect-ts
title: "Effect Ts"
kind: procedure
load: on-demand
owner: shared
verified: 2026-10-12
source: "https://github.com/effect-ts/skills (skills/effect-ts, MIT, commit 155c50c)"
category: code
disable-model-invocation: true
license: MIT
---

# Step 1: Install effect

Use the users preferred package manager:

```
pnpm add effect@latest
```

If in a monorepo, install it as a dev dependency at the root, so you can access
the source code from `node_modules/effect/src`.

```
pnpm add -D effect@latest
```

# Step 2: Update AGENTS.md / CLAUDE.md

Ensure that the agent instructions contain the following:

```md
# Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.
```

Credit: adapted from [effect-ts/skills](https://github.com/effect-ts/skills) (MIT). See [LICENSE](LICENSE).
