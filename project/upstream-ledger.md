# Upstream ledger (T3 Code to Leonidas Code)

Base: `8d199b4f7b`. Upstream tip: `ab6be13d43`. Generated 2026-10-18. Commits: 1093.

Decision 2026-10-18: Jake skips all mobile-only commits (no mobile release yet).

Classes are automatic suggestions only. A human decision goes in the last column of the table below. SKIP? and TAKE are not final.

| Class  | Count |
| ------ | ----- |
| REVIEW | 625   |
| TAKE   | 241   |
| SKIP?  | 150   |
| DEFER  | 77    |

## By area

| Area                                 | TAKE | REVIEW | DEFER | SKIP? | Total |
| ------------------------------------ | ---- | ------ | ----- | ----- | ----- |
| apps/web                             | 142  | 377    | 26    | 6     | 551   |
| apps/server                          | 48   | 155    | 32    | 9     | 244   |
| apps/mobile                          | 1    | 21     | 14    | 114   | 150   |
| apps/desktop                         | 8    | 15     | 1     | 1     | 25    |
| packages/client-runtime              | 8    | 10     | 2     | 2     | 22    |
| .github                              | 1    | 3      | 1     | 12    | 17    |
| packages/shared                      | 6    | 9      | 0     | 1     | 16    |
| packages/provider-cursor             | 2    | 5      | 0     | 0     | 7     |
| scripts                              | 0    | 7      | 0     | 0     | 7     |
| patches                              | 0    | 3      | 0     | 2     | 5     |
| packages/provider-core               | 0    | 4      | 1     | 0     | 5     |
| packages/provider-opencode           | 1    | 4      | 0     | 0     | 5     |
| packages/source-control-github       | 3    | 1      | 0     | 0     | 4     |
| packages/provider-muse               | 0    | 3      | 0     | 0     | 3     |
| packages/provider-acp                | 3    | 0      | 0     | 0     | 3     |
| packages/source-control-forgejo      | 3    | 0      | 0     | 0     | 3     |
| packages/source-control-bitbucket    | 3    | 0      | 0     | 0     | 3     |
| packages/source-control-gitlab       | 2    | 0      | 0     | 0     | 2     |
| package.json                         | 0    | 2      | 0     | 0     | 2     |
| packages/source-control-core         | 2    | 0      | 0     | 0     | 2     |
| packages/ssh                         | 0    | 2      | 0     | 0     | 2     |
| oxlint-plugin-t3code                 | 0    | 2      | 0     | 0     | 2     |
| infra/relay                          | 0    | 0      | 0     | 2     | 2     |
| pnpm-workspace.yaml                  | 0    | 0      | 0     | 1     | 1     |
| .coderabbit.config.ts                | 1    | 0      | 0     | 0     | 1     |
| packages/provider-pi                 | 0    | 1      | 0     | 0     | 1     |
| packages/contracts                   | 1    | 0      | 0     | 0     | 1     |
| CONTRIBUTING.md                      | 1    | 0      | 0     | 0     | 1     |
| packages/provider-acp-registry       | 1    | 0      | 0     | 0     | 1     |
| packages/provider-grok               | 0    | 1      | 0     | 0     | 1     |
| native                               | 1    | 0      | 0     | 0     | 1     |
| packages/effect-acp                  | 1    | 0      | 0     | 0     | 1     |
| packages/source-control-azure-devops | 1    | 0      | 0     | 0     | 1     |
| packages/tailscale                   | 1    | 0      | 0     | 0     | 1     |

## DEFER

| Commit       | Date       | Area                    | Overlap | Subject                                                                                                | Decision |
| ------------ | ---------- | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------ | -------- |
| `1f6df6bf1f` | 2026-10-11 | apps/web                | 43      | feat(pull-requests): guided reviews, a beta tour of a pull request (#18124)                            |          |
| `18656a3402` | 2026-10-11 | apps/server             | 9       | feat(mcp): agents can write and read pull request review guides (#18143)                               |          |
| `8ac6846a0b` | 2026-10-11 | apps/server             | 49      | feat(settings): providers can be turned on or off per project (#17879)                                 |          |
| `5495cc4445` | 2026-10-11 | apps/mobile             | 29      | feat(mobile): browse and review pull requests natively (#18126)                                        |          |
| `bed923986f` | 2026-10-11 | apps/mobile             | 4       | feat(mobile): guided reviews for pull requests (#18267)                                                |          |
| `d07a07f33c` | 2026-10-11 | apps/mobile             | 4       | feat(mobile): keep pull requests available offline (#18351)                                            |          |
| `c1d528a342` | 2026-10-11 | apps/server             | 2       | feat(provider-muse): native subagents open in their own child threads (#18353)                         |          |
| `c5d7309152` | 2026-10-11 | apps/mobile             | 8       | feat(mobile): replace custom Markdown rendering with Enriched (#16979)                                 |          |
| `808bee7daa` | 2026-10-11 | apps/server             | 8       | chore(typecheck): typecheck with tsc-rs (#16704)                                                       |          |
| `b9ad3daf8d` | 2026-10-11 | apps/server             | 6       | fix(server): cap automatic thread continuations and turn them on by default (#18461)                   |          |
| `c32ade4139` | 2026-10-11 | apps/mobile             | 4       | feat(mobile): stock tab bar, glass filter pills, and saved list filters (#18476)                       |          |
| `e688034b5f` | 2026-10-11 | apps/web                | 1       | feat(web): model options for source control writer and review guide models (#18488)                    |          |
| `d514a8c617` | 2026-10-11 | apps/web                | 7       | refactor(settings): centralize schema-declared secrets and inputs (#18505)                             |          |
| `462e7f4de4` | 2026-10-11 | apps/mobile             | 1       | feat(mobile): native-sized pull request action bar (#18527)                                            |          |
| `5fe7568e87` | 2026-10-11 | apps/web                | 12      | feat: open T3 Code from a link with a prompt ready to send (#18454)                                    |          |
| `d83929ad0b` | 2026-10-12 | apps/web                | 4       | feat(web): one sidebar click updates every machine and provider (#18053)                               |          |
| `ffb4af8d5d` | 2026-10-12 | packages/provider-core  | 4       | feat(server): rename built-in models from settings (#18840)                                            |          |
| `5d6e4192bf` | 2026-10-12 | apps/web                | 12      | fix: show computer-use action titles and align app icons (#18865)                                      |          |
| `265fb7000f` | 2026-10-12 | apps/server             | 7       | fix(server): apply confirmed Claude subagent outcomes (#18778)                                         |          |
| `1af138668b` | 2026-10-13 | apps/mobile             | 11      | fix(mobile): attachment images no longer re-download on every reconnect (#18824)                       |          |
| `98a6246d07` | 2026-10-13 | apps/web                | 6       | fix(web): links in HTML renders open like chat links (#18897)                                          |          |
| `c616e16c8f` | 2026-10-13 | apps/mobile             | 7       | feat(chat): show pending context handoff when selecting a model (#18369)                               |          |
| `25629a76a0` | 2026-10-14 | apps/server             | 13      | feat(server): run delegated tasks in separate worktrees (#19102)                                       |          |
| `aba3a6ddc0` | 2026-10-14 | apps/web                | 3       | feat(web): view visual replies full screen with zoom (#17561)                                          |          |
| `cb65643b07` | 2026-10-13 | apps/server             | 29      | chore(deps): Effect 4.0.4 and OpenCode 2.0.28, dropping the patches they made unnecessary (#19213)     |          |
| `4d73e1d5cd` | 2026-10-13 | apps/server             | 6       | fix(server): persist only changed pull request links (#19248)                                          |          |
| `eeaac49a9d` | 2026-10-14 | apps/server             | 24      | fix: update all no longer runs agents twice or loses background work (#19291)                          |          |
| `90ca6a7758` | 2026-10-14 | apps/server             | 32      | fix(server): new Codex threads no longer miss slow MCP servers' tools (#19368)                         |          |
| `4befc863f5` | 2026-10-14 | apps/server             | 7       | perf(server): traces keep ~40% more history and no longer block the event loop (#19430)                |          |
| `28732b4787` | 2026-10-14 | apps/server             | 3       | feat(observability): SQL spans show lock wait and connection; stalls keep their own history (#19425)   |          |
| `bf8ffe81a6` | 2026-10-14 | apps/server             | 4       | feat(settings): inactivity auto-settle can keep threads with a PR (#14642)                             |          |
| `f87dd14daf` | 2026-10-14 | apps/server             | 9       | fix(muse): Supervised threads ask before commands again (#19558)                                       |          |
| `f4df794777` | 2026-10-14 | packages/client-runtime | 8       | fix(clients): a thread comes back when its subagent needs approval (#19630)                            |          |
| `55dfc5fc4d` | 2026-10-15 | apps/server             | 8       | fix(composer): read dropped threads across environments (#15210)                                       |          |
| `924fb0c4d4` | 2026-10-14 | apps/server             | 8       | fix(server): a delegated task's question ends the parent's blocking wait (#19538)                      |          |
| `21bedfb175` | 2026-10-15 | apps/server             | 13      | feat(storage): clean up settled thread worktrees (#15208)                                              |          |
| `e536bfd33b` | 2026-10-15 | apps/mobile             | 2       | feat(web,mobile): waiting status shows a dot-dashed icon and a timer (#19617)                          |          |
| `339179f50a` | 2026-10-15 | apps/mobile             | 5       | feat(pr): delete branches after merge or close (#19257)                                                |          |
| `cd34df59a1` | 2026-10-15 | apps/web                | 6       | feat(web): setting to open pull request links on GitHub (#19719)                                       |          |
| `81493efb71` | 2026-10-15 | apps/desktop            | 11      | chore: change product branding from Alpha to Beta (#20032)                                             |          |
| `17e1087d36` | 2026-10-15 | apps/web                | 3       | feat(web): open html render images in the image viewer (#20036)                                        |          |
| `df83cfa233` | 2026-10-15 | apps/mobile             | 1       | feat(mobile): map native hosts to the app theme (#18567)                                               |          |
| `3ff9149abd` | 2026-10-15 | apps/mobile             | 1       | feat(mobile): expose themed native Android app bars (#19994)                                           |          |
| `6d73370ef1` | 2026-10-15 | apps/web                | 10      | fix(web): settings stay compact with many connected machines (#19744)                                  |          |
| `2b6611ca01` | 2026-10-15 | apps/server             | 7       | feat(server): t3 doctor reclaims database space (#19436)                                               |          |
| `65d390fc52` | 2026-10-15 | apps/server             | 11      | feat: suggest t3 doctor when the database has space to reclaim (#19437)                                |          |
| `aa35fb3ec6` | 2026-10-15 | apps/web                | 7       | fix(web): folder breadcrumbs navigate to parent folders (#15045)                                       |          |
| `a5d97921f6` | 2026-10-15 | apps/server             | 21      | fix: command output streams live while it runs (#15094)                                                |          |
| `4e85a93b20` | 2026-10-16 | apps/server             | 7       | fix(server): subagents pick up their parent's renamed worktree branch (#20079)                         |          |
| `b67ac65b74` | 2026-10-15 | apps/web                | 4       | feat(web): drag a linked pull request into the composer as a context chip (#20102)                     |          |
| `802b5d7c0b` | 2026-10-15 | apps/mobile             | 1       | feat(mobile): use shared custom segmented controls (#20116)                                            |          |
| `86534db4d3` | 2026-10-16 | apps/web                | 903     | refactor: prune narration and history comments (#19559)                                                |          |
| `a54a44c669` | 2026-10-16 | apps/server             | 8       | fix(orchestration): queue follow-ups sent while a thread compacts (#20184)                             |          |
| `7111501be3` | 2026-10-17 | apps/server             | 8       | fix(server): wake threads whose subagents' background work a restart cut (#19750)                      |          |
| `2993dfc069` | 2026-10-17 | apps/web                | 7       | feat(web): step reasoning effort from the keyboard (#19928)                                            |          |
| `c9b8f21bcf` | 2026-10-16 | packages/client-runtime | 8       | refactor(client-runtime): decide learned routes and session reuse in one place (#20445)                |          |
| `8653c8f09b` | 2026-10-16 | apps/server             | 6       | fix(server): keep sensitive values out of settings reads, startup logs and preview snapshots (#20446)  |          |
| `8e0d5e5e4d` | 2026-10-16 | apps/server             | 7       | refactor(server): resolve project and worktree folders in one place (#20449)                           |          |
| `73d70a444b` | 2026-10-16 | apps/server             | 6       | refactor(server): route git config through one env helper and end option parsing before names (#20440) |          |
| `489d08a054` | 2026-10-17 | apps/web                | 7       | perf(web): router updates no longer re-render thread route consumers (#20837)                          |          |
| `e4fb9f2ccf` | 2026-10-17 | apps/web                | 9       | test(web): hook-harness tests run in a real browser (#20866)                                           |          |
| `b827ca48d7` | 2026-10-17 | apps/web                | 6       | test(web): chat tests run in a real browser (#20870)                                                   |          |
| `52d593c1a1` | 2026-10-17 | apps/web                | 8       | fix(web): chat view no longer renders twice per update (#20847)                                        |          |
| `5c8528fd8a` | 2026-10-17 | apps/web                | 9       | perf(web): a client setting write only re-renders readers whose value changed (#20848)                 |          |
| `edb2155566` | 2026-10-17 | apps/web                | 7       | perf(web): another thread streaming no longer re-renders the app root and thread panels (#20823)       |          |
| `4a5dade3b4` | 2026-10-17 | apps/web                | 19      | perf(client): provider status pushes no longer re-render environment presentation consumers (#20821)   |          |
| `4b1024dafe` | 2026-10-17 | apps/web                | 7       | perf(web): the open thread's chat chrome no longer re-renders on every streaming tick (#20860)         |          |
| `13aa882c22` | 2026-10-17 | apps/server             | 1       | feat(server): t3 doctor can delete the database from before 0.1.0 (#20948)                             |          |
| `e712d97815` | 2026-10-17 | apps/web                | 13      | fix(web): time-based labels update under the React Compiler (#21026)                                   |          |
| `8fbc22ca95` | 2026-10-18 | apps/mobile             | 16      | feat(mobile): link, unlink and watch a thread's pull requests from its sheet (#20394)                  |          |
| `3ff5b3c82a` | 2026-10-18 | apps/server             | 6       | fix(web): a workflow thread opens with its phases and agents instead of its script (#20857)            |          |
| `555fb6f821` | 2026-10-19 | apps/web                | 6       | fix(web): follow configured desktop update repository (#21210)                                         |          |
| `92224ddfa2` | 2026-10-18 | apps/web                | 15      | chore(lint): reject use* functions that call no hooks (#21260)                                         |          |
| `28c32d20c3` | 2026-10-18 | .github                 | 1       | feat(server): send telemetry through ingest.t3.codes (#15028)                                          |          |
| `07d38b8d17` | 2026-10-18 | apps/server             | 9       | fix(server): a failed Codex turn no longer traps the queue behind its subagents (#21366)               |          |
| `9077e818d8` | 2026-10-18 | apps/server             | 3       | feat(server): count which product features people use (#15921)                                         |          |
| `ab6be13d43` | 2026-10-18 | apps/server             | 3       | feat(server): count which T3 MCP tools agents use (#15913)                                             |          |

## REVIEW

| Commit       | Date       | Area                           | Overlap | Subject                                                                                                            | Decision |
| ------------ | ---------- | ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| `ed0f7b908b` | 2026-10-11 | apps/server                    | 2       | fix(server): Sol Ultrafast stops vanishing from the Codex model picker (#18200)                                    |          |
| `2625327090` | 2026-10-11 | packages/shared                | 2       | fix(usage): say resets momentarily in the final minute (#17869)                                                    |          |
| `c09c235129` | 2026-10-11 | packages/provider-cursor       | 1       | fix(server): preserve ambient Cursor MCP servers (#15875)                                                          |          |
| `243c9994d0` | 2026-10-11 | patches                        | 1       | fix(server): skip Windows cleanup for exited child processes (#16007)                                              |          |
| `2e19207b17` | 2026-10-11 | apps/server                    | 1       | fix(client): apply host color scheme to saved MCP apps (#17026)                                                    |          |
| `8de61d4a97` | 2026-10-11 | apps/mobile                    | 5       | fix(client): merge No project filters across environments (#17050)                                                 |          |
| `1d270bec29` | 2026-10-11 | apps/web                       | 1       | fix(web): revert trailing toast icons (#18356)                                                                     |          |
| `f43f6ddde0` | 2026-10-11 | apps/web                       | 1       | fix(web): even 4px inset around rows in the PR badge tooltip (#18352)                                              |          |
| `3f70c831c6` | 2026-10-11 | apps/server                    | 2       | fix(server): Claude 5.1+ text before a tool call shows as assistant text (#18364)                                  |          |
| `55fc13ff68` | 2026-10-11 | apps/web                       | 1       | fix(web): Cite button stays anchored to the selected text (#17650)                                                 |          |
| `c9181d81a8` | 2026-10-11 | apps/web                       | 1       | fix(web): scrolling over the thread minimap scrolls the chat (#17652)                                              |          |
| `f6fa4776e7` | 2026-10-11 | apps/web                       | 2       | perf(web): panel toggles no longer re-render the timeline and composer (#18077)                                    |          |
| `aaf83eedd5` | 2026-10-11 | apps/web                       | 1       | fix(web): center the empty-thread placeholder above the composer (#18331)                                          |          |
| `2c8e85e662` | 2026-10-11 | apps/web                       | 1       | fix(web): PR badge tooltip opens after a thread gains a second PR (#18368)                                         |          |
| `83fbbc18f8` | 2026-10-11 | apps/web                       | 5       | fix(web): timeline keeps live-following after returning from Settings (#17348)                                     |          |
| `1d58b82ead` | 2026-10-11 | apps/web                       | 1       | fix(web): update toast download badge no longer hides behind the provider logo (#18401)                            |          |
| `27839622ef` | 2026-10-11 | apps/server                    | 2       | fix(shared): preserve generated branch namespaces (#15615)                                                         |          |
| `6ba6a0daf4` | 2026-10-11 | packages/provider-muse         | 5       | fix(provider-muse): run on Muse 1.4.6, with linked web search hits and workflow results (#18409)                   |          |
| `07993f39ff` | 2026-10-11 | apps/mobile                    | 1       | chore(mobile): sync Screens fork with upstream v5 fixes (#18396)                                                   |          |
| `7f02b84958` | 2026-10-12 | apps/server                    | 4       | perf(usage): the first usage scan skips decoding transcript lines that carry no usage (#17255)                     |          |
| `821a6d7e06` | 2026-10-12 | apps/web                       | 2       | fix(web): keybinding settings label Focus URL with a capitalized acronym (#18279)                                  |          |
| `fded2cac5f` | 2026-10-11 | apps/web                       | 1       | fix(web): provider Runtime controls follow the settings row layout (#18190)                                        |          |
| `6bbb72c61d` | 2026-10-12 | apps/web                       | 1       | perf(web): Thinking shimmer steps instead of drawing every frame (#18191)                                          |          |
| `9b9792ead5` | 2026-10-11 | apps/server                    | 1       | test(server): finish workflow reads before changing transcripts (#18192)                                           |          |
| `6a99eb3f08` | 2026-10-12 | apps/server                    | 1       | test(server): Claude sign-in message test passes on Windows hosts (#18183)                                         |          |
| `a5331e4c2c` | 2026-10-11 | apps/server                    | 2       | fix(server): checkpoint restore keeps a nested workspace on Windows (#14874)                                       |          |
| `ee2763e9b2` | 2026-10-12 | apps/server                    | 2       | Reject unknown params in t3_thread_read (#17823)                                                                   |          |
| `d45d1a1ede` | 2026-10-11 | apps/web                       | 1       | fix(desktop): Option-click on a chat link opens the system browser (#18238)                                        |          |
| `4a90c1cf5d` | 2026-10-12 | apps/web                       | 1       | fix(web): keep queued threads subscribed (#15293)                                                                  |          |
| `4ff8b077d5` | 2026-10-12 | apps/server                    | 1       | test(server): Claude reset tests are skipped on Windows hosts, where their mock CLI cannot run (#18184)            |          |
| `fd6d9ddaab` | 2026-10-12 | apps/web                       | 1       | fix(web): hide stash menu behind maximized panel (#18115)                                                          |          |
| `df78114360` | 2026-10-12 | apps/web                       | 2       | fix(web): sidebar toggle no longer sits under the macOS window buttons (#18193)                                    |          |
| `37e2acda51` | 2026-10-12 | apps/web                       | 1       | fix(web): terminal colors no longer look washed out (#17168)                                                       |          |
| `48595c787c` | 2026-10-11 | apps/server                    | 2       | fix(server): consolidate browser credential handling (#18509)                                                      |          |
| `eac6ba5ae9` | 2026-10-12 | scripts                        | 2       | ci: fail PRs on invalid allowBuilds entries in pnpm-workspace.yaml (#18564)                                        |          |
| `58d253231d` | 2026-10-12 | apps/web                       | 2       | fix(web): context meter no longer reads 1000k just under a million tokens (#17539)                                 |          |
| `5753207d53` | 2026-10-12 | apps/desktop                   | 1       | fix(desktop): avoid Hyprland 0.48–0.50 Wayland color-manager startup crashes (#18566)                              |          |
| `701fc83169` | 2026-10-12 | apps/mobile                    | 1       | fix(mobile): installs skip the Enriched math download again (#18679)                                               |          |
| `9e552285ba` | 2026-10-12 | apps/web                       | 1       | fix(web): setup wizards follow custom themes (#18725)                                                              |          |
| `b821fa04f1` | 2026-10-12 | apps/server                    | 4       | fix(server): resolve configured PR bases to branch names (#18754)                                                  |          |
| `0e7346ccd9` | 2026-10-12 | apps/web                       | 5       | fix: expose running terminals and prevent setup install stalls (#18740)                                            |          |
| `511d20c6f2` | 2026-10-12 | packages/client-runtime        | 1       | fix(mobile): hide Claude Read image placeholders when previews exist (#18761)                                      |          |
| `b03534fa7b` | 2026-10-12 | apps/web                       | 1       | fix(web): Git actions follow the selected thread (#18862)                                                          |          |
| `979589d6d8` | 2026-10-12 | apps/desktop                   | 2       | fix(desktop): preserve updater failure causes in diagnostics (#18864)                                              |          |
| `34f8458324` | 2026-10-12 | apps/web                       | 2       | fix(web): attach dropped threads to pending answers (#18789)                                                       |          |
| `e2e95a39d3` | 2026-10-12 | apps/server                    | 4       | fix(server): return null for unresolved optional commands (#18871)                                                 |          |
| `df26ef9985` | 2026-10-12 | apps/web                       | 1       | fix(web): a numeric q in the pull requests URL no longer crashes the page (#18666)                                 |          |
| `346247bf1a` | 2026-10-13 | apps/web                       | 1       | fix(web): leaving the home page while the app loads no longer bounces you to a new draft (#18672)                  |          |
| `e24ea1d28e` | 2026-10-13 | apps/server                    | 3       | fix(server): a migration id clash stops startup with a clear error instead of crash-looping (#15925)               |          |
| `5a65169bfc` | 2026-10-13 | apps/server                    | 5       | fix(server): a thread with an event type from a newer build can still resync after a downgrade (#15937)            |          |
| `dc192851f0` | 2026-10-12 | apps/server                    | 2       | fix(server): Codex titles and branch names no longer start the user's MCP servers (#17058)                         |          |
| `06620faf6d` | 2026-10-13 | apps/server                    | 2       | fix(server): Claude thinking before a tool call stays a collapsed Thought (#18887)                                 |          |
| `ae7bed6e40` | 2026-10-12 | apps/server                    | 2       | perf(server): cached branch PR lookups no longer start git processes (#17063)                                      |          |
| `80664d5266` | 2026-10-13 | apps/web                       | 1       | fix(web): compact merge buttons show when they need a second click (#18878)                                        |          |
| `540a3e89ed` | 2026-10-13 | apps/web                       | 1       | perf(web): collect active tool calls without array shifts (#18853)                                                 |          |
| `e9221e44da` | 2026-10-13 | apps/web                       | 1       | fix(web): center the pace icon on the limit card's "left" label (#18580)                                           |          |
| `e82a1ce3f3` | 2026-10-12 | apps/web                       | 1       | fix(web): scheduled task model picker no longer shifts the dialog (#18940)                                         |          |
| `a47decf230` | 2026-10-13 | apps/web                       | 2       | fix(web): remember editor selections before opening folders (#19078)                                               |          |
| `8d75232489` | 2026-10-13 | apps/web                       | 1       | fix(web): let context handoff details use the available width (#19098)                                             |          |
| `05e4f888a0` | 2026-10-13 | apps/server                    | 2       | fix(server): snoozed threads allow queued automatic wakes (#19099)                                                 |          |
| `6a68bee34f` | 2026-10-13 | apps/web                       | 1       | fix(web): merge button fits its label and animates width changes (#18478)                                          |          |
| `446be6933f` | 2026-10-13 | apps/web                       | 1       | fix(web): Cmd+Enter creates the new project while an option is highlighted (#18901)                                |          |
| `4d7683557a` | 2026-10-13 | packages/provider-pi           | 1       | fix(pi): load T3 tool schemas for completion gateways (#18643)                                                     |          |
| `4292720fd9` | 2026-10-13 | apps/server                    | 5       | fix(devices): report agent tool startup failures (#18502)                                                          |          |
| `8ac4b97dae` | 2026-10-13 | apps/web                       | 2       | fix(web): settings warn when an environment silently drops a setting (#18334)                                      |          |
| `380bba368a` | 2026-10-13 | scripts                        | 3       | fix(desktop): stop unsolicited Messages code autofill (#19118)                                                     |          |
| `fb8d0fc19c` | 2026-10-13 | apps/server                    | 1       | fix(server): collect SQLite planner statistics when the database opens (#18471)                                    |          |
| `84cb13412e` | 2026-10-14 | apps/server                    | 5       | fix(server): failed threads no longer scan every tool item for errors (#18628)                                     |          |
| `6947f0d9d8` | 2026-10-13 | apps/web                       | 1       | fix(web): keep clone folder names readable in the setup project picker (#12474)                                    |          |
| `a01c48f862` | 2026-10-13 | apps/web                       | 2       | fix(composer): allow slash skill search within messages (#19107)                                                   |          |
| `8c027980eb` | 2026-10-13 | apps/server                    | 2       | fix(claude): default background text generation to haiku 5.5 (#18781)                                              |          |
| `006c508664` | 2026-10-13 | package.json                   | 2       | chore(typecheck): bump tsc-rs to 0.6.0 (#19187)                                                                    |          |
| `3feae3a940` | 2026-10-13 | packages/provider-opencode     | 1       | fix(server): keep OpenCode timeouts from crashing the error formatter (#12469)                                     |          |
| `a74ce48f96` | 2026-10-13 | apps/server                    | 1       | fix(server): stop fsyncing SQLite on every commit so slow disks no longer drop clients (#19205)                    |          |
| `85272eeeae` | 2026-10-13 | apps/web                       | 4       | fix(chat): make links in agent questions clickable (#19197)                                                        |          |
| `91e93a25ae` | 2026-10-13 | apps/server                    | 2       | fix(usage): show one Antigravity account once, not once per machine (#19207)                                       |          |
| `dff750b1b8` | 2026-10-14 | apps/web                       | 1       | fix(web): stop question answers from resetting the editor caret (#11337)                                           |          |
| `573cec0166` | 2026-10-14 | packages/shared                | 3       | fix(web): app shortcuts keep working after clicking into an HTML render (#18898)                                   |          |
| `9c9ae43d80` | 2026-10-13 | apps/web                       | 1       | fix(web): auto-merge button fits its label and animates width changes (#19111)                                     |          |
| `1ce8089ebd` | 2026-10-14 | apps/web                       | 1       | fix(web): scroll terminal output with touch gestures (#11305)                                                      |          |
| `11fd54fcbb` | 2026-10-14 | apps/web                       | 5       | fix(web): removing a project no longer opens a new thread for it (#15864)                                          |          |
| `d765d03cb7` | 2026-10-14 | apps/server                    | 2       | fix(server): a Claude 403 no longer tells you to log in again (#15872)                                             |          |
| `8b460a3c85` | 2026-10-14 | apps/server                    | 2       | fix(server): delegate_task explains that supervised runtime modes pause the child (#14416)                         |          |
| `30d1010443` | 2026-10-14 | apps/server                    | 2       | fix(server): Claude subagent progress no longer re-stores the unchanged prompt (#18375)                            |          |
| `8659fcf145` | 2026-10-14 | apps/server                    | 2       | fix(server): thread list reads no longer freeze the server on large databases (#19226)                             |          |
| `3b2ebcee2f` | 2026-10-14 | apps/server                    | 2       | perf(server): streamed events no longer rewrite the whole thread row (#18890)                                      |          |
| `570542662a` | 2026-10-14 | apps/server                    | 5       | fix(server): enforce one database owner and guard update rollback (#16102)                                         |          |
| `8855a6dd05` | 2026-10-14 | apps/server                    | 2       | perf(server): reuse stored turn item positions (#19230)                                                            |          |
| `5bba764432` | 2026-10-14 | packages/client-runtime        | 1       | fix(client-runtime): slow config snapshots no longer drop working connections (#14518)                             |          |
| `4cd0076ec6` | 2026-10-14 | packages/shared                | 1       | perf(shared): cached SQLite statements no longer hold large parameters (#19305)                                    |          |
| `acb90279e2` | 2026-10-14 | packages/provider-cursor       | 1       | fix(provider-cursor): Cursor text generation no longer leaks SQLite file handles on every call (#19310)            |          |
| `614b432a79` | 2026-10-14 | apps/server                    | 2       | fix(server): make SQLite checkpoints durable on macOS (#19304)                                                     |          |
| `fd9cdaed17` | 2026-10-14 | apps/server                    | 2       | perf(server): Codex plan streaming no longer commits every token (#19317)                                          |          |
| `2d14185f32` | 2026-10-14 | apps/server                    | 3       | fix(server): large file edits no longer store their full diff twice (#19316)                                       |          |
| `c8a6768f07` | 2026-10-14 | packages/provider-opencode     | 1       | fix(server): HTML and Markdown attachments no longer fail OpenCode turns (#19319)                                  |          |
| `a0ea721c47` | 2026-10-14 | apps/server                    | 1       | fix(server): worktree paths no longer vanish on git before 2.36 (#19315)                                           |          |
| `233e70b3b2` | 2026-10-14 | apps/server                    | 3       | fix(server): Claude no longer shows unavailable when its health check can't run in $HOME (#19320)                  |          |
| `f372c0061f` | 2026-10-14 | apps/server                    | 1       | fix(server): stalled OAuth token requests no longer block credential calls (#19321)                                |          |
| `8d11fe1261` | 2026-10-14 | apps/server                    | 2       | fix(server): steered Claude turns no longer undercount token usage (#19314)                                        |          |
| `3213a0c77b` | 2026-10-14 | apps/server                    | 2       | fix(server): closing a Claude session no longer leaves plugin MCP servers running (#19322)                         |          |
| `6edd44f405` | 2026-10-14 | apps/web                       | 2       | fix(web): settle shortcut moves to the next thread like the sidebar (#19328)                                       |          |
| `3a6ab583d2` | 2026-10-14 | apps/server                    | 3       | fix(acp): Copilot's default agent no longer disappears from the Agent menu (#19330)                                |          |
| `5fc1c5cb4c` | 2026-10-14 | apps/server                    | 2       | perf(server): SQLite checkpoints no longer block the event loop (#19324)                                           |          |
| `9a5dc75648` | 2026-10-14 | apps/web                       | 1       | fix(web): live reasoning stays scrolled to the newest text while it streams (#19334)                               |          |
| `4cf8243f85` | 2026-10-14 | apps/mobile                    | 1       | fix(clients): host images say when the connection lacks file access (#19337)                                       |          |
| `9a01524f3f` | 2026-10-14 | apps/mobile                    | 4       | fix(clients): a resumed subagent no longer moves the later turn's Worked for row (#19338)                          |          |
| `5240897388` | 2026-10-14 | apps/mobile                    | 3       | docs(settings): explain that provider update checks also gate the model catalog (#18208)                           |          |
| `9fb4ddb2d1` | 2026-10-14 | apps/web                       | 3       | fix(web): an unsaved citation comment survives a question or approval (#19350)                                     |          |
| `bc95bbd790` | 2026-10-14 | apps/server                    | 2       | fix(server): changing Claude effort no longer fails while background agents run (#19341)                           |          |
| `3417bc3856` | 2026-10-14 | apps/server                    | 2       | fix(server): service updates no longer fail on full disks or large databases (#19311)                              |          |
| `0425c32571` | 2026-10-14 | apps/mobile                    | 5       | fix(clients): # suggestions include pull requests linked to the thread (#19357)                                    |          |
| `0ae1091d01` | 2026-10-14 | packages/client-runtime        | 3       | fix(clients): pairing a switched-off computer again turns it back on (#19354)                                      |          |
| `ffceb61fcb` | 2026-10-14 | apps/server                    | 3       | fix(cli): t3 triage reports the server's version, not its own, as the user's build (#19359)                        |          |
| `26c48bbc0a` | 2026-10-14 | apps/web                       | 2       | fix(web): action shortcuts recorded in the browser now save (#19365)                                               |          |
| `adb04202b2` | 2026-10-14 | apps/mobile                    | 2       | fix(clients): large pasted images no longer break later Claude image reads (#19364)                                |          |
| `21af72f7a5` | 2026-10-14 | packages/client-runtime        | 1       | perf(client-runtime): merged pull requests are no longer re-read every minute (#19374)                             |          |
| `9688e74112` | 2026-10-14 | apps/server                    | 2       | fix(ssh): SSH launch no longer picks a port another server answers on (#19372)                                     |          |
| `c08093c2b1` | 2026-10-14 | apps/server                    | 3       | fix(shared): Windows .cmd shims no longer print DEP0190 on every spawn (#19385)                                    |          |
| `3062701c24` | 2026-10-14 | apps/server                    | 3       | fix(server): commit and title generation use your custom model when no text model is set (#19386)                  |          |
| `7fd2ba7526` | 2026-10-14 | apps/server                    | 2       | fix(server): failed Claude text generation shows the CLI's own error (#19394)                                      |          |
| `7c43155883` | 2026-10-14 | apps/web                       | 1       | fix(web): keybindings page says to connect an environment when none is connected (#19400)                          |          |
| `0796638512` | 2026-10-14 | packages/shared                | 2       | fix(chat): Codex follow-up suggestions show their label instead of raw markup (#19401)                             |          |
| `cdba9a038e` | 2026-10-14 | apps/server                    | 2       | perf(server): idle servers no longer scan every process every 5 seconds (#19399)                                   |          |
| `7d5a42912a` | 2026-10-14 | package.json                   | 2       | chore(typecheck): bump tsc-rs to 0.7.0 (#19408)                                                                    |          |
| `dd5c7bd09e` | 2026-10-14 | apps/server                    | 1       | fix(server): new worktrees no longer fail when a background fetch runs at the same time (#19411)                   |          |
| `f37f99ca9e` | 2026-10-14 | packages/shared                | 1       | fix(shared): SQLite checkpoints no longer fall back to the main thread silently (#19417)                           |          |
| `737192594f` | 2026-10-14 | apps/server                    | 3       | perf(server): unchanged node updates no longer write to SQLite (#19429)                                            |          |
| `36f91c4568` | 2026-10-14 | packages/ssh                   | 2       | fix(ssh): reconnecting keeps the remote server and its agents running (#19432)                                     |          |
| `d0a73b56c2` | 2026-10-14 | apps/server                    | 2       | fix(server): threads woken by notifications no longer load their whole history (#19423)                            |          |
| `7ac952c630` | 2026-10-14 | apps/server                    | 3       | fix(server): worktree cleanup no longer runs sweeps back to back (#19418)                                          |          |
| `cae6c6627a` | 2026-10-14 | apps/server                    | 2       | fix(server): only Claude progress updates before a tool call show as text (#18923)                                 |          |
| `7897a695e3` | 2026-10-14 | apps/mobile                    | 1       | fix(web): review summary only says optional when it is (#18451)                                                    |          |
| `e093789dd2` | 2026-10-14 | apps/web                       | 3       | fix(web): subagent lists in the composer banner no longer start lines with a comma (#19170)                        |          |
| `cb395ee13b` | 2026-10-14 | apps/mobile                    | 1       | fix(web,mobile): pull request filters no longer offer the Scratch folder (#19179)                                  |          |
| `464fad9a43` | 2026-10-14 | apps/web                       | 3       | fix(web,mobile): pull request project filter follows the sidebar order (#19180)                                    |          |
| `e47bfe4617` | 2026-10-14 | apps/server                    | 4       | fix(server): Claude works next to an enterprise managed-mcp.json (#18706)                                          |          |
| `348f217a85` | 2026-10-14 | apps/web                       | 1       | fix(web,mobile): muse code uses meta's official blue logo (#19562)                                                 |          |
| `22af947e0d` | 2026-10-14 | apps/server                    | 2       | fix(server): restarts no longer stall on old subagent result deliveries (#19631)                                   |          |
| `52ffe0cae6` | 2026-10-14 | apps/server                    | 2       | fix(usage): cold usage scans no longer stall the server (#19446)                                                   |          |
| `39aeaf404a` | 2026-10-14 | apps/server                    | 2       | fix(server): "Always allow this session" stops Codex asking for every command (#19635)                             |          |
| `7bdfed98d7` | 2026-10-14 | apps/web                       | 1       | fix(web): keep vertical cursor stops outside styled markers (#19651)                                               |          |
| `5a4e998053` | 2026-10-14 | apps/web                       | 1       | fix(web): mermaid code toggle stays in place when switching views (#19601)                                         |          |
| `40a7908df5` | 2026-10-14 | apps/server                    | 2       | fix(server): Reveal in File Explorer and browser launches work on Windows again (#19656)                           |          |
| `ab3a3cd162` | 2026-10-14 | apps/server                    | 3       | perf(server): commands on busy threads stop decoding thousands of finished tool nodes (#19675)                     |          |
| `fdacb3a380` | 2026-10-14 | apps/server                    | 1       | fix(server): a delegated task's question now wakes its parent agent (#19521)                                       |          |
| `c814e51af2` | 2026-10-14 | apps/server                    | 1       | fix(server): a cancelled delegated task no longer shows its child's question (#18459)                              |          |
| `2d31acb975` | 2026-10-15 | apps/web                       | 1       | fix(web): the sidebar no longer keeps old renders alive (#19852)                                                   |          |
| `313f23e4ed` | 2026-10-15 | apps/web                       | 4       | fix(web): update everything no longer waits on slow servers, and shows progress in the sidebar (#19837)            |          |
| `45b5993a52` | 2026-10-15 | apps/web                       | 2       | fix(web): text generation no longer falls back to the expensive flagship model (#19722)                            |          |
| `00cdceb196` | 2026-10-15 | apps/web                       | 3       | fix(web): middle-click opens pull requests in the browser, like cmd+click (#19854)                                 |          |
| `0e1431f61c` | 2026-10-15 | apps/web                       | 2       | fix(web): the chat view and composer no longer keep old renders alive (#19869)                                     |          |
| `0b68a4a9c3` | 2026-10-15 | apps/server                    | 3       | fix(server): steering no longer ends running subagents (#19210)                                                    |          |
| `e6bbfdb9ff` | 2026-10-15 | apps/mobile                    | 4       | fix(web,mobile): sent queued messages say "from queue", not "queued" (#19849)                                      |          |
| `42da166d13` | 2026-10-15 | apps/server                    | 3       | fix(server): OTLP exports say which machine and build they came from (#19370)                                      |          |
| `98bc998e73` | 2026-10-15 | apps/web                       | 1       | fix(prs): bound refreshes by each tracker read (#19403)                                                            |          |
| `38d9760cca` | 2026-10-15 | apps/web                       | 2       | fix(mobile): agent-spawned threads can be mentioned from the @ picker (#15841)                                     |          |
| `2d94372376` | 2026-10-15 | packages/provider-cursor       | 1       | fix(server): Cursor threads in Auto use Cursor's Auto-review (#19712)                                              |          |
| `52a769d43e` | 2026-10-15 | apps/web                       | 1       | fix(web): text selection keeps going under the turn minimap (#16748)                                               |          |
| `895354e9fb` | 2026-10-15 | apps/server                    | 1       | fix(server): Antigravity installs on Windows ARM (#18472)                                                          |          |
| `6e5322b6cf` | 2026-10-15 | apps/server                    | 1       | perf(server): cut fff-node FFI marshaling overhead on large workspaces (#18514)                                    |          |
| `364f5084d7` | 2026-10-15 | apps/server                    | 1       | fix(server): Windows Codex install uses system tar and retries rename (#18523)                                     |          |
| `e77a48e81a` | 2026-10-15 | apps/server                    | 2       | fix(server): fail runs whose provider stream ends without a terminal (#19131)                                      |          |
| `3ff452bd65` | 2026-10-15 | apps/server                    | 3       | fix(server): a dropped HTTP/2 connection no longer crashes the server (#18378)                                     |          |
| `26fffe5aee` | 2026-10-15 | apps/mobile                    | 1       | fix(mobile): Android nested list markers no longer overlap their text (#19970)                                     |          |
| `ede3f2d6ba` | 2026-10-16 | apps/web                       | 2       | fix(web): model picker search lists newest models first (#18494)                                                   |          |
| `f798cb299a` | 2026-10-15 | apps/server                    | 4       | perf(web): HTML renders show a layout skeleton and reuse cached pages (#19654)                                     |          |
| `c3a36af872` | 2026-10-15 | packages/source-control-github | 4       | refactor(github): all GitHub GraphQL on effect/graphql, one request policy for REST and GraphQL (#19224)           |          |
| `791feeb060` | 2026-10-15 | apps/mobile                    | 1       | refactor(mobile): keep segmented controls native (#18532)                                                          |          |
| `a175e06cdc` | 2026-10-15 | apps/server                    | 2       | perf(server): check Android SDK locations before PATH (#19960)                                                     |          |
| `9a067b2dfa` | 2026-10-15 | apps/server                    | 2       | perf(server): skip unchanged device host refreshes (#19961)                                                        |          |
| `eef0e4e1f9` | 2026-10-15 | apps/desktop                   | 3       | perf(server): skip Windows probes for desktop-prepared environments (#19966)                                       |          |
| `b8e829dc8c` | 2026-10-15 | scripts                        | 1       | fix(dev): freeze the worktree setup lockfile (#19747)                                                              |          |
| `e733a40295` | 2026-10-15 | apps/server                    | 1       | fix(server): clean up worktrees shared by subagents (#19748)                                                       |          |
| `fa1184d29e` | 2026-10-15 | apps/server                    | 3       | fix(server): report orphaned managed worktrees (#19749)                                                            |          |
| `5752253818` | 2026-10-15 | apps/server                    | 5       | fix(server): compact superseded history in the background (#19435)                                                 |          |
| `d10969557e` | 2026-10-15 | apps/web                       | 3       | fix(web): device setup lets you through with only a remote device host (#20077)                                    |          |
| `11b00afc02` | 2026-10-15 | .github                        | 1       | chore(mobile): remove the legacy v2 preview channel (#20084)                                                       |          |
| `d2d59fa7fe` | 2026-10-15 | apps/mobile                    | 1       | fix(mobile): code blocks get a wrap button, long ordered lists keep their numbers (#20080)                         |          |
| `1550058056` | 2026-10-15 | apps/server                    | 2       | fix(server): resumed Claude subagents keep updating their own thread (#20061)                                      |          |
| `d5139979d4` | 2026-10-15 | apps/web                       | 1       | perf(web): virtualize a thread's linked pull requests (#20107)                                                     |          |
| `2dd87a4047` | 2026-10-15 | apps/web                       | 2       | perf(web): run the React Compiler natively instead of through Babel (#20114)                                       |          |
| `e2b929f10a` | 2026-10-15 | packages/client-runtime        | 1       | perf(web): saving the thread list cache no longer re-encodes every thread (#19915)                                 |          |
| `2a7bd1673c` | 2026-10-15 | packages/provider-grok         | 1       | fix(provider-grok): Grok health checks no longer start Grok's updater (#18075)                                     |          |
| `ccca13dcf4` | 2026-10-15 | apps/server                    | 2       | perf(server): expanding a wide ignored folder no longer classifies every child (#20062)                            |          |
| `3962ae8586` | 2026-10-15 | apps/desktop                   | 1       | perf(desktop): picture-in-picture stops re-encoding an unchanged page (#20070)                                     |          |
| `b47746bb9c` | 2026-10-15 | apps/web                       | 1       | perf(web): load project icons as one chunk instead of ~1,700 (#20147)                                              |          |
| `c0de6bd1b1` | 2026-10-15 | apps/server                    | 2       | fix(cli): t3 triage and prompts work from the desktop app's t3 on Windows (#20162)                                 |          |
| `6b450c75b5` | 2026-10-15 | scripts                        | 4       | bye npm (#20148)                                                                                                   |          |
| `2577baf8b0` | 2026-10-15 | .github                        | 2       | fix(mobile): publish each Android beta only once                                                                   |          |
| `a9c9c7cdb1` | 2026-10-16 | apps/server                    | 4       | fix(shared): PRs built on the same PR stay in one stack under their parent (#20160)                                |          |
| `e3b35d1b24` | 2026-10-16 | apps/web                       | 1       | fix(web): keep running status banners on one line (#20194)                                                         |          |
| `cfafb4bb54` | 2026-10-16 | apps/server                    | 2       | fix(codex): a slow but healthy Codex no longer shows as Unavailable (#15945)                                       |          |
| `3b99fb2d21` | 2026-10-17 | patches                        | 1       | fix(mobile): the app builds and launches again after the Expo update (#20131)                                      |          |
| `ac251a23f2` | 2026-10-16 | patches                        | 1       | chore(deps): update Expo SDK 58 packages and trim patches (#20389)                                                 |          |
| `67bca6c224` | 2026-10-16 | .github                        | 1       | fix(mobile): Android fingerprint covers Expo native modules again (#20384)                                         |          |
| `47d98aca3a` | 2026-10-16 | apps/server                    | 3       | fix(server): Windows terminal kill no longer waits on timeouts (#18519)                                            |          |
| `6cecd22789` | 2026-10-16 | apps/mobile                    | 1       | chore(mobile): use upstream Enriched Markdown's wrap toggle and list fixes, plus Android long-press fixes (#20400) |          |
| `51f7382aff` | 2026-10-16 | apps/web                       | 3       | fix(web): restore mobile app store links in settings (#20422)                                                      |          |
| `043bc031e4` | 2026-10-16 | apps/web                       | 1       | refactor(web): move pending approvals and questions out of ChatView (#20161)                                       |          |
| `e00cda2cd8` | 2026-10-16 | apps/web                       | 1       | refactor(web): move the persistent terminal drawer and panel out of ChatView.tsx (#20164)                          |          |
| `d109aa74ea` | 2026-10-16 | apps/web                       | 1       | refactor(web): open and close thread terminals through one hook (#20289)                                           |          |
| `48a1604089` | 2026-10-16 | oxlint-plugin-t3code           | 1       | chore(lint): fail lint when the React Compiler skips a listed file (#20292)                                        |          |
| `f7916ad07c` | 2026-10-16 | apps/web                       | 1       | refactor(web): let the React Compiler compile usePendingThreadRequests (#20294)                                    |          |
| `65de56ef90` | 2026-10-16 | apps/web                       | 2       | refactor(web): move the /usage-limits panel state out of ChatView (#20296)                                         |          |
| `4a7083f2b7` | 2026-10-16 | apps/web                       | 2       | refactor(web): move queued-message editing out of ChatView (#20304)                                                |          |
| `9302235c5e` | 2026-10-16 | apps/web                       | 2       | refactor(web): move the thread's linked pull request out of ChatView (#20308)                                      |          |
| `4283e23392` | 2026-10-16 | apps/web                       | 2       | refactor(web): move proactive right-panel opening out of ChatView (#20309)                                         |          |
| `a5539a6b03` | 2026-10-16 | apps/web                       | 2       | refactor(web): move agent-opened browser and device surfacing out of ChatView (#20312)                             |          |
| `c07eddfbed` | 2026-10-16 | apps/web                       | 2       | refactor(web): move right panel surface closing out of ChatView (#20315)                                           |          |
| `d3de2c17c0` | 2026-10-16 | apps/web                       | 2       | refactor(web): move worktree setup progress out of ChatView (#20316)                                               |          |
| `cbee9c9847` | 2026-10-16 | apps/web                       | 3       | refactor(web): split two self-contained phases out of onSend (#20321)                                              |          |
| `9ef9274965` | 2026-10-16 | apps/web                       | 3       | fix(web): stop crashing the native React Compiler on ChatView (#20340)                                             |          |
| `0e95babaf5` | 2026-10-16 | apps/web                       | 3       | perf(web): let the React Compiler compile ChatView (#20379)                                                        |          |
| `0912b24577` | 2026-10-16 | apps/web                       | 5       | perf(web): stop re-rendering the conversation on streamed tokens, typing and server pushes (#20380)                |          |
| `0c48f62705` | 2026-10-16 | packages/client-runtime        | 2       | perf(client): provider status pushes keep unchanged providers identical (#20392)                                   |          |
| `054337764a` | 2026-10-16 | apps/web                       | 1       | refactor(web): move ChatView's keyboard shortcuts into a command map (#20393)                                      |          |
| `2de98f035c` | 2026-10-16 | apps/web                       | 2       | perf(web): the sidebar compiles with no manual memoization (#20396)                                                |          |
| `e925fe754e` | 2026-10-16 | apps/web                       | 1       | perf(web): ChatComposer compiles with no manual memoization (#20397)                                               |          |
| `bf990c625e` | 2026-10-16 | apps/web                       | 1       | refactor(web): move project script editing out of ChatView (#20401)                                                |          |
| `d913b61603` | 2026-10-16 | apps/web                       | 3       | perf(web): the React Compiler compiles MessagesTimeline (#20402)                                                   |          |
| `a09394ec39` | 2026-10-16 | apps/web                       | 2       | perf(web): ChatView joins the strict React Compiler list (#20418)                                                  |          |
| `f5cb328aac` | 2026-10-16 | apps/web                       | 1       | refactor(web): move the right panel's surface switch out of ChatView (#20421)                                      |          |
| `52cd9c5a19` | 2026-10-16 | apps/web                       | 1       | fix(web): a draft closed mid machine switch no longer rewrites that draft (#20442)                                 |          |
| `33aa461478` | 2026-10-16 | apps/web                       | 1       | fix(web): every reconnect gets its own grace period before the unavailable banner (#20441)                         |          |
| `777cd68c6a` | 2026-10-16 | apps/web                       | 1       | perf(web): the composer editor compiles with the React Compiler (#20450)                                           |          |
| `fd3420f380` | 2026-10-16 | apps/web                       | 1       | perf(web): the server browser surface compiles with the React Compiler (#20451)                                    |          |
| `68b47e71c0` | 2026-10-16 | apps/web                       | 1       | perf(web): thread notifications compile with the React Compiler (#20454)                                           |          |
| `c62480abff` | 2026-10-16 | apps/web                       | 1       | perf(web): query hooks compile with the React Compiler (#20455)                                                    |          |
| `35dcdfb945` | 2026-10-16 | apps/web                       | 1       | perf(web): source control action hooks compile with the React Compiler (#20456)                                    |          |
| `998bcc226a` | 2026-10-16 | apps/web                       | 1       | perf(web): the project icon picker compiles with the React Compiler (#20457)                                       |          |
| `275e55cfca` | 2026-10-16 | apps/web                       | 1       | perf(web): the theme editor compiles with the React Compiler (#20458)                                              |          |
| `222ebe071e` | 2026-10-16 | apps/web                       | 1       | perf(web): pairing surfaces read their URL token from lazy state (#20461)                                          |          |
| `546c67f443` | 2026-10-16 | apps/web                       | 1       | perf(web): sidebar retained git status lives in state (#20462)                                                     |          |
| `23290944bc` | 2026-10-16 | apps/web                       | 1       | perf(web): viewed-file tracking passes its flush target instead of reading refs (#20463)                           |          |
| `1544a94578` | 2026-10-16 | apps/web                       | 1       | perf(web): snapshot coordinator keeps the last route target in state (#20466)                                      |          |
| `10d4fab294` | 2026-10-16 | apps/web                       | 1       | perf(web): branch toolbar label measuring reads its state through useEffectEvent (#20467)                          |          |
| `26bea7e62e` | 2026-10-16 | apps/web                       | 1       | perf(web): diff panel reads its loader and collapse defaults without refs (#20468)                                 |          |
| `8f309bce65` | 2026-10-16 | apps/web                       | 1       | perf(web): welcome wizard keeps its auto-selected computers in lazy state (#20469)                                 |          |
| `7f4142e5b0` | 2026-10-16 | apps/web                       | 1       | perf(web): thread actions compile without manual memoization (#20470)                                              |          |
| `bb30390933` | 2026-10-16 | apps/web                       | 1       | perf(web): pull request code tab compiles, with viewed toggles read through context (#20471)                       |          |
| `9730e044ca` | 2026-10-16 | apps/web                       | 1       | perf(web): useTheme compiles with the React Compiler (#20473)                                                      |          |
| `8316dfb619` | 2026-10-16 | apps/web                       | 1       | perf(web): settings hooks compile with the React Compiler (#20474)                                                 |          |
| `9fa39677e1` | 2026-10-16 | apps/web                       | 1       | perf(web): the queued runs control compiles with the React Compiler (#20475)                                       |          |
| `e96db6f0c3` | 2026-10-16 | apps/web                       | 1       | perf(web): the browser preview view compiles with the React Compiler (#20476)                                      |          |
| `7a89733cab` | 2026-10-16 | apps/web                       | 1       | perf(web): the command palette compiles with the React Compiler (#20477)                                           |          |
| `b27c686298` | 2026-10-16 | apps/web                       | 1       | perf(web): the server update action compiles with the React Compiler (#20478)                                      |          |
| `426706cbce` | 2026-10-16 | apps/web                       | 1       | perf(web): the attachment file preview compiles with the React Compiler (#20479)                                   |          |
| `6ced12af15` | 2026-10-16 | apps/web                       | 1       | perf(web): the usage page compiles with the React Compiler (#20480)                                                |          |
| `f31850cd2a` | 2026-10-16 | apps/web                       | 1       | perf(web): provider update rows compile with the React Compiler (#20481)                                           |          |
| `1144a7ecc4` | 2026-10-16 | apps/web                       | 1       | perf(web): useDirectoryEntries compiles with the React Compiler (#20482)                                           |          |
| `a77cbf0d5e` | 2026-10-16 | apps/web                       | 1       | perf(web): the file browser panel compiles with the React Compiler (#20483)                                        |          |
| `62861700d8` | 2026-10-16 | apps/web                       | 1       | perf(web): the sidebar update pill compiles with the React Compiler (#20484)                                       |          |
| `46ae590bfa` | 2026-10-16 | apps/web                       | 1       | perf(web): the media video player compiles with the React Compiler (#20486)                                        |          |
| `e10f5d1b5e` | 2026-10-16 | apps/web                       | 1       | perf(web): media actions compile with the React Compiler (#20487)                                                  |          |
| `9f70fcc7b5` | 2026-10-17 | apps/mobile                    | 2       | fix(prs): typed qualifiers filter mobile PR search and sync the draft menu (#19934)                                |          |
| `7157b76699` | 2026-10-16 | apps/web                       | 1       | perf(web): device setup compiles with the React Compiler (#20488)                                                  |          |
| `488af8d28b` | 2026-10-16 | apps/web                       | 1       | perf(web): the device panel compiles with the React Compiler (#20489)                                              |          |
| `079a349708` | 2026-10-16 | apps/web                       | 1       | perf(web): the SSH password prompt compiles with the React Compiler (#20490)                                       |          |
| `c1caac81ab` | 2026-10-16 | apps/web                       | 1       | perf(web): the cloud environment connect list compiles with the React Compiler (#20491)                            |          |
| `409140911b` | 2026-10-16 | apps/web                       | 1       | perf(web): pull request actions compile with the React Compiler (#20492)                                           |          |
| `5abf7bf632` | 2026-10-16 | apps/web                       | 1       | perf(web): pull request review annotations compile with the React Compiler (#20493)                                |          |
| `ba3e228d96` | 2026-10-16 | apps/web                       | 1       | perf(web): pull request thread links compile with the React Compiler (#20494)                                      |          |
| `d793dddd7a` | 2026-10-16 | apps/web                       | 1       | perf(web): the link pull request dialog compiles with the React Compiler (#20495)                                  |          |
| `1c9e83e67b` | 2026-10-16 | apps/web                       | 1       | perf(web): GitHub token settings compile with the React Compiler (#20496)                                          |          |
| `ef78932dc8` | 2026-10-16 | apps/web                       | 1       | perf(web): GitHub account settings compile with the React Compiler (#20497)                                        |          |
| `ebe997981b` | 2026-10-16 | apps/web                       | 1       | perf(web): usage provider settings compile with the React Compiler (#20499)                                        |          |
| `72dac23730` | 2026-10-16 | apps/web                       | 1       | perf(web): telemetry export settings compile with the React Compiler (#20500)                                      |          |
| `a72d1fcc5a` | 2026-10-16 | apps/web                       | 1       | perf(web): device host connection checks compile with the React Compiler (#20501)                                  |          |
| `b618d53941` | 2026-10-16 | apps/web                       | 1       | perf(web): project script settings compile with the React Compiler (#20502)                                        |          |
| `d1c2346eec` | 2026-10-16 | apps/web                       | 1       | perf(web): SnapShot setup dialog compile with the React Compiler (#20503)                                          |          |
| `0a453f00d5` | 2026-10-16 | apps/web                       | 1       | perf(web): notification settings compile with the React Compiler (#20504)                                          |          |
| `43acbcd1e5` | 2026-10-16 | apps/web                       | 1       | perf(web): provider setup section compile with the React Compiler (#20505)                                         |          |
| `d89076c6d8` | 2026-10-16 | apps/web                       | 1       | perf(web): storage settings compile with the React Compiler (#20506)                                               |          |
| `123dc24504` | 2026-10-16 | apps/web                       | 1       | perf(web): diagnostics settings compile with the React Compiler (#20507)                                           |          |
| `7091bc2495` | 2026-10-16 | apps/web                       | 1       | perf(web): device hosts settings compile with the React Compiler (#20508)                                          |          |
| `40ff4b454c` | 2026-10-16 | apps/web                       | 1       | perf(web): project settings panel compile with the React Compiler (#20509)                                         |          |
| `d23ac516c4` | 2026-10-16 | apps/web                       | 1       | perf(web): ACP session management compile with the React Compiler (#20510)                                         |          |
| `350127040a` | 2026-10-16 | apps/web                       | 1       | perf(web): capture shortcut config compile with the React Compiler (#20511)                                        |          |
| `993aed357c` | 2026-10-16 | apps/web                       | 1       | perf(web): integrations settings compile with the React Compiler (#20512)                                          |          |
| `6a71716edb` | 2026-10-16 | apps/web                       | 1       | perf(web): theme import dialog compile with the React Compiler (#20513)                                            |          |
| `542287245d` | 2026-10-16 | apps/web                       | 1       | fix(web): an abandoned machine switch still clears its busy state (#20519)                                         |          |
| `3448e01788` | 2026-10-16 | apps/web                       | 2       | perf(web): SnapShot settings compile with the React Compiler (#20514)                                              |          |
| `6a326afb81` | 2026-10-16 | apps/web                       | 1       | perf(web): connections settings compile with the React Compiler (#20515)                                           |          |
| `9220fd73bf` | 2026-10-16 | apps/web                       | 1       | perf(web): the pull request panel compiles with the React Compiler (#20526)                                        |          |
| `f4cf855672` | 2026-10-16 | apps/web                       | 1       | perf(web): the terminal drawer compiles with the React Compiler (#20527)                                           |          |
| `1da2d60b43` | 2026-10-16 | apps/web                       | 1       | perf(web): the settings panels compile with the React Compiler (#20528)                                            |          |
| `11ce406d2c` | 2026-10-17 | apps/server                    | 5       | fix(server): background subagents keep T3 tools after the parent turn ends (#19751)                                |          |
| `70d60e03a7` | 2026-10-16 | apps/web                       | 1       | fix(web): the sidebar no longer crashes when a thread leaves it (#20522)                                           |          |
| `5c5dcbc60b` | 2026-10-16 | apps/web                       | 1       | perf(web): the pull requests page compiles with the React Compiler (#20539)                                        |          |
| `23163fdc48` | 2026-10-16 | apps/web                       | 1       | perf(web): the legacy sidebar compiles with the React Compiler (#20640)                                            |          |
| `f29640d3e1` | 2026-10-16 | apps/web                       | 1       | perf(web): the linked pull requests panel compiles without manual memoization (#20723)                             |          |
| `311319e92f` | 2026-10-16 | apps/web                       | 1       | perf(web): pull request markdown compiles without manual memoization (#20722)                                      |          |
| `f1dccf2d1b` | 2026-10-16 | apps/web                       | 2       | perf(web): the pull request label and reviewer pickers compile without manual memoization (#20719)                 |          |
| `0241bbfc22` | 2026-10-16 | apps/web                       | 1       | perf(web): the usage state hook compiles without manual memoization (#20718)                                       |          |
| `f43206d35f` | 2026-10-16 | apps/web                       | 1       | perf(web): the composer draft store compiles without manual memoization (#20713)                                   |          |
| `6805b64e39` | 2026-10-16 | apps/web                       | 1       | perf(web): the model picker compiles without manual memoization (#20711)                                           |          |
| `dab2d5c771` | 2026-10-16 | apps/web                       | 1       | perf(web): the proposed plan card compiles without manual memoization (#20707)                                     |          |
| `ce29ba9cd7` | 2026-10-16 | apps/web                       | 1       | perf(web): the pull request link hooks compile without manual memoization (#20705)                                 |          |
| `40b325bca0` | 2026-10-16 | apps/web                       | 1       | perf(web): the preview mini player compiles without manual memoization (#20704)                                    |          |
| `b413396fe8` | 2026-10-16 | apps/web                       | 1       | perf(web): toasts compile without manual memoization (#20702)                                                      |          |
| `c0cdb02a4b` | 2026-10-16 | apps/web                       | 1       | perf(web): the thread action menu hook compiles without manual memoization (#20701)                                |          |
| `73d9a77e43` | 2026-10-16 | apps/web                       | 1       | perf(web): the open-in picker compiles without manual memoization (#20698)                                         |          |
| `b190a2fec2` | 2026-10-16 | apps/web                       | 1       | perf(web): the usage provider chart compiles without manual memoization (#20695)                                   |          |
| `39bcf7c69c` | 2026-10-16 | apps/web                       | 1       | perf(web): the usage model dialog compiles without manual memoization (#20694)                                     |          |
| `06299ff56a` | 2026-10-16 | apps/web                       | 1       | perf(web): the file preview panel compiles with the React Compiler (#20692)                                        |          |
| `38b43572be` | 2026-10-16 | apps/web                       | 1       | perf(web): the MCP app frame compiles without manual memoization (#20691)                                          |          |
| `49c51bb11a` | 2026-10-16 | apps/web                       | 1       | perf(web): main app navigation compiles without manual memoization (#20690)                                        |          |
| `daf4643356` | 2026-10-16 | apps/web                       | 1       | perf(web): project file queries compile without manual memoization (#20689)                                        |          |
| `4539e77468` | 2026-10-16 | apps/web                       | 1       | perf(web): the HTML render frame compiles without manual memoization (#20688)                                      |          |
| `6ad62b8ab1` | 2026-10-16 | apps/web                       | 1       | perf(web): the project file picker compiles without manual memoization (#20685)                                    |          |
| `72b3340a16` | 2026-10-16 | apps/web                       | 1       | perf(web): the sidebar chrome compiles without manual memoization (#20684)                                         |          |
| `2ff8e7413b` | 2026-10-16 | apps/web                       | 1       | perf(web): the snapshot shortcut recorder compiles without manual memoization (#20682)                             |          |
| `2a337fea92` | 2026-10-16 | apps/web                       | 1       | perf(web): the pull request linking hook compiles without manual memoization (#20681)                              |          |
| `d859445528` | 2026-10-16 | apps/web                       | 1       | perf(web): the CSV table preview compiles without manual memoization (#20680)                                      |          |
| `8e49f230d8` | 2026-10-16 | apps/web                       | 1       | perf(web): the thread lineage panel compiles without manual memoization (#20720)                                   |          |
| `383d8cc6ae` | 2026-10-16 | apps/web                       | 1       | perf(web): scoped settings hooks compile without manual memoization (#20677)                                       |          |
| `36c1fe50ac` | 2026-10-16 | apps/web                       | 1       | perf(web): the new project hook compiles without manual memoization (#20675)                                       |          |
| `165fa98c8a` | 2026-10-16 | apps/web                       | 1       | perf(web): the scratch project hook compiles without manual memoization (#20673)                                   |          |
| `92b896710b` | 2026-10-16 | apps/web                       | 1       | perf(web): the expanded image dialog compiles without manual memoization (#20672)                                  |          |
| `436ff018d8` | 2026-10-16 | apps/web                       | 1       | perf(web): the draft hero headline compiles without manual memoization (#20669)                                    |          |
| `3ba121e9e8` | 2026-10-16 | apps/web                       | 1       | perf(web): the chat route layout compiles without manual memoization (#20667)                                      |          |
| `aca2b2ab4e` | 2026-10-16 | apps/web                       | 1       | perf(web): scoped model availability compiles without manual memoization (#20666)                                  |          |
| `11f66760d0` | 2026-10-16 | apps/web                       | 1       | perf(web): the provider settings panel compiles with the React Compiler (#20664)                                   |          |
| `afb8da0094` | 2026-10-16 | apps/web                       | 1       | perf(web): the right panel tabs compile with the React Compiler (#20662)                                           |          |
| `37db94e520` | 2026-10-16 | apps/web                       | 1       | perf(web): the editor preference hooks compile without manual memoization (#20660)                                 |          |
| `4a9516d3d5` | 2026-10-16 | apps/web                       | 1       | perf(web): the chat header compiles with the React Compiler (#20656)                                               |          |
| `a9fb6087ea` | 2026-10-16 | apps/web                       | 1       | perf(web): the theme library compiles with the React Compiler (#20655)                                             |          |
| `ec9f8e875c` | 2026-10-16 | apps/web                       | 1       | perf(web): file breadcrumbs compile with the React Compiler (#20651)                                               |          |
| `c8b3ebfdea` | 2026-10-16 | apps/web                       | 1       | perf(web): the changed files tree compiles without manual memoization (#20650)                                     |          |
| `9b62eae950` | 2026-10-16 | apps/web                       | 1       | perf(web): the settings layout compiles without manual memoization (#20647)                                        |          |
| `b6dde72755` | 2026-10-16 | apps/web                       | 1       | perf(web): the citation chip compiles without manual memoization (#20643)                                          |          |
| `f22415a075` | 2026-10-16 | apps/web                       | 1       | perf(web): project content search compiles with the React Compiler (#20641)                                        |          |
| `6a0587c959` | 2026-10-16 | apps/web                       | 1       | perf(web): the agent connect surface compiles without manual memoization (#20639)                                  |          |
| `478b06c609` | 2026-10-16 | apps/web                       | 1       | perf(web): the first-run gate compiles with the React Compiler (#20637)                                            |          |
| `f99d12b5e5` | 2026-10-16 | apps/web                       | 1       | perf(web): the worktree base branch picker compiles without manual memoization (#20634)                            |          |
| `d4c49bdd65` | 2026-10-16 | apps/web                       | 1       | perf(web): thread status indicators compile without manual memoization (#20630)                                    |          |
| `0b0f4dbf26` | 2026-10-16 | apps/web                       | 1       | perf(web): the source control settings compile with the React Compiler (#20628)                                    |          |
| `ef643a3f0e` | 2026-10-16 | apps/web                       | 1       | perf(web): scheduled task settings compile without manual memoization (#20627)                                     |          |
| `530d119655` | 2026-10-16 | apps/web                       | 1       | perf(web): the remove-cloned-project hook compiles without manual memoization (#20626)                             |          |
| `145b15416a` | 2026-10-16 | apps/web                       | 1       | perf(web): resource telemetry diagnostics compile without manual memoization (#20625)                              |          |
| `ecb973a7df` | 2026-10-16 | apps/web                       | 1       | perf(web): the Connect onboarding dialog compiles with the React Compiler (#20622)                                 |          |
| `99544c9c19` | 2026-10-16 | apps/web                       | 1       | perf(web): redacted sensitive text compiles without manual memoization (#20621)                                    |          |
| `a37e0f3dba` | 2026-10-16 | apps/web                       | 1       | perf(web): the provider settings form compiles without manual memoization (#20618)                                 |          |
| `a4f6caf8cf` | 2026-10-16 | apps/web                       | 1       | perf(web): the provider models section compiles with the React Compiler (#20617)                                   |          |
| `1b13922a25` | 2026-10-16 | apps/web                       | 1       | perf(web): the CLI authorize surface compiles without manual memoization (#20616)                                  |          |
| `d6df197b43` | 2026-10-16 | apps/web                       | 1       | perf(web): the pull request thread dialog compiles without manual memoization (#20615)                             |          |
| `3f60d4d380` | 2026-10-16 | apps/web                       | 1       | perf(web): the assistant citation target hook compiles with the React Compiler (#20614)                            |          |
| `a8dcb960d0` | 2026-10-16 | apps/web                       | 1       | perf(web): the provider accent color picker compiles without manual memoization (#20612)                           |          |
| `196950a6e9` | 2026-10-16 | apps/web                       | 1       | perf(web): the provider update notification compiles without manual memoization (#20609)                           |          |
| `89a24e8d97` | 2026-10-16 | apps/web                       | 1       | perf(web): the open-source notices panel compiles with the React Compiler (#20608)                                 |          |
| `54b1915472` | 2026-10-16 | apps/web                       | 1       | perf(web): the thread context drop hook compiles with the React Compiler (#20605)                                  |          |
| `7591b64ec0` | 2026-10-16 | apps/web                       | 1       | perf(web): the font previews compile with the React Compiler (#20601)                                              |          |
| `c36880ea67` | 2026-10-16 | apps/web                       | 1       | perf(web): project actions settings compile without manual memoization (#20602)                                    |          |
| `0b110ce0db` | 2026-10-16 | apps/web                       | 1       | perf(web): the thread find bar compiles with the React Compiler (#20600)                                           |          |
| `dec20cedc8` | 2026-10-16 | apps/web                       | 1       | perf(web): the project scripts control compiles without manual memoization (#20599)                                |          |
| `d915777397` | 2026-10-16 | apps/web                       | 1       | perf(web): keybindings settings compile without manual memoization (#20598)                                        |          |
| `e648318061` | 2026-10-16 | apps/web                       | 1       | perf(web): the model picker sidebar compiles with the React Compiler (#20596)                                      |          |
| `6515be7f4b` | 2026-10-16 | apps/web                       | 1       | perf(web): the project clone toasts compile without manual memoization (#20593)                                    |          |
| `4e3f936fbd` | 2026-10-16 | apps/web                       | 1       | perf(web): the pending user input panel compiles with the React Compiler (#20592)                                  |          |
| `789f60566f` | 2026-10-16 | apps/web                       | 1       | perf(web): the provider update pill compiles with the React Compiler (#20590)                                      |          |
| `d15f208cde` | 2026-10-16 | apps/web                       | 1       | perf(web): the no-projects hero compiles without manual memoization (#20589)                                       |          |
| `54bffb912e` | 2026-10-16 | apps/web                       | 1       | perf(web): the custom model editor compiles without manual memoization (#20586)                                    |          |
| `20851e304e` | 2026-10-16 | apps/web                       | 1       | perf(web): the root route compiles with the React Compiler (#20585)                                                |          |
| `f0e060a386` | 2026-10-16 | apps/web                       | 1       | perf(web): the CLI command settings row compiles without manual memoization (#20583)                               |          |
| `6b563bb758` | 2026-10-16 | apps/web                       | 1       | perf(web): the composer banner stack compiles with the React Compiler (#20582)                                     |          |
| `6f68d6d7d5` | 2026-10-16 | apps/web                       | 1       | perf(web): the primary session state hook compiles without manual memoization (#20581)                             |          |
| `2814dc9c48` | 2026-10-16 | apps/web                       | 1       | perf(web): the index route compiles with the React Compiler (#20580)                                               |          |
| `6d22719b03` | 2026-10-16 | apps/web                       | 1       | perf(web): the command palette results compile without manual memoization (#20579)                                 |          |
| `a793011879` | 2026-10-16 | apps/web                       | 1       | perf(web): the add provider dialog compiles without manual memoization (#20578)                                    |          |
| `dd1ab3f059` | 2026-10-16 | apps/web                       | 1       | perf(web): useOrchestrationCommand compiles without manual memoization (#20576)                                    |          |
| `2bb92ba474` | 2026-10-16 | apps/web                       | 1       | perf(web): the environment selector compiles without manual memoization (#20575)                                   |          |
| `ef2d631a55` | 2026-10-16 | apps/web                       | 1       | perf(web): the env mode selector compiles without manual memoization (#20572)                                      |          |
| `506955372a` | 2026-10-16 | apps/web                       | 1       | perf(web): the server update banner compiles without manual memoization (#20570)                                   |          |
| `8e6ace6166` | 2026-10-16 | apps/web                       | 1       | perf(web): the app sidebar layout compiles with the React Compiler (#20569)                                        |          |
| `7383cce7fc` | 2026-10-16 | apps/web                       | 1       | perf(web): the branch toolbar selector compiles without manual memoization (#20567)                                |          |
| `78c0d7df69` | 2026-10-16 | apps/web                       | 1       | perf(web): the branch picker compiles without manual memoization (#20557)                                          |          |
| `65ebf8f86e` | 2026-10-16 | apps/web                       | 1       | perf(web): the primary cloud link hook compiles without manual memoization (#20554)                                |          |
| `70d5cfb492` | 2026-10-16 | apps/web                       | 1       | perf(web): the project action editor resets its form without an effect (#20550)                                    |          |
| `b78296a60b` | 2026-10-16 | apps/web                       | 1       | perf(web): the traits picker compiles without manual memoization (#20540)                                          |          |
| `82f40d74a6` | 2026-10-16 | apps/web                       | 1       | perf(web): the settings sidebar compiles with the React Compiler (#20623)                                          |          |
| `cffabdbb59` | 2026-10-16 | apps/web                       | 1       | perf(web): Codex setup compiles with the React Compiler (#20674)                                                   |          |
| `fcda161afb` | 2026-10-16 | apps/web                       | 1       | perf(web): chat markdown compiles with the React Compiler (#20715)                                                 |          |
| `2520821d57` | 2026-10-16 | apps/web                       | 1       | perf(web): the device stream view compiles without manual memoization (#20645)                                     |          |
| `33672c47e3` | 2026-10-16 | apps/web                       | 1       | perf(web): the load-balancing hook compiles with the React Compiler (#20565)                                       |          |
| `a72b58e127` | 2026-10-16 | apps/web                       | 1       | fix(web): settings search keeps the clamped highlight when results shrink (#20764)                                 |          |
| `07528262fc` | 2026-10-16 | apps/web                       | 1       | perf(web): the model picker compiles without manual memoization (#20706)                                           |          |
| `3ba883ebf4` | 2026-10-16 | apps/web                       | 1       | perf(web): the item inspector compiles without manual memoization (#20545)                                         |          |
| `47683f6ff4` | 2026-10-16 | apps/server                    | 3       | fix(server): webhook request values reach the agent marked as request data (#20447)                                |          |
| `bfe804d319` | 2026-10-16 | apps/web                       | 1       | refactor(web): thread find compiles under the strict React Compiler rules (#20772)                                 |          |
| `07fa354c22` | 2026-10-16 | apps/web                       | 1       | test(web): chat markdown, timeline, and diff reveal tests pass the strict compiler rules (#20770)                  |          |
| `b38aa027dc` | 2026-10-16 | apps/web                       | 1       | perf(web): Git actions control compiles without manual memoization (#20777)                                        |          |
| `aa28bde87e` | 2026-10-16 | apps/web                       | 1       | refactor(web): the theme search section compiles without manual memoization (#20778)                               |          |
| `b3d05640a4` | 2026-10-16 | apps/web                       | 1       | refactor(web): the thread pull requests panel keeps its caching without "use memo" hooks (#20740)                  |          |
| `01e634a10b` | 2026-10-16 | apps/web                       | 1       | refactor(web): scoped settings stay cached without "use memo" (#20767)                                             |          |
| `3af41edb71` | 2026-10-16 | apps/web                       | 1       | refactor(web): the file browser keeps its caching without "use memo" hooks (#20784)                                |          |
| `0ad3fd6436` | 2026-10-16 | apps/web                       | 1       | refactor(web): the pull request thread dialog keeps its caching without "use memo" hooks (#20742)                  |          |
| `37ea8a88de` | 2026-10-16 | apps/web                       | 1       | refactor(web): the MCP app frame keeps its caching without "use memo" hooks (#20759)                               |          |
| `36cde6fbc3` | 2026-10-16 | apps/web                       | 1       | refactor(web): the changed files tree keeps its caching without "use memo" hooks (#20766)                          |          |
| `0a3806ca57` | 2026-10-16 | apps/web                       | 1       | refactor(web): paginated branches keep their caching without "use memo" (#20743)                                   |          |
| `9554194e7e` | 2026-10-16 | apps/web                       | 1       | refactor(web): pull request markdown keeps its caching without "use memo" hooks (#20744)                           |          |
| `4dd6a65abe` | 2026-10-16 | apps/web                       | 1       | refactor(web): the pull request detail panel keeps its caching with fewer "use memo" hooks (#20761)                |          |
| `b7e376e96e` | 2026-10-16 | packages/client-runtime        | 2       | fix(client-runtime): the agents pill counts background agents from earlier turns (#20785)                          |          |
| `c783897791` | 2026-10-16 | apps/web                       | 1       | refactor(web): the diff panel keeps its caching without "use memo" hooks (#20745)                                  |          |
| `d4314e8e16` | 2026-10-16 | apps/web                       | 1       | refactor(web): the composer builds model options without a "use memo" hook (#20780)                                |          |
| `ba9e9f5736` | 2026-10-16 | apps/web                       | 1       | refactor(web): the pull request code tab keeps its caching with one "use memo" hook (#20773)                       |          |
| `275e7de026` | 2026-10-16 | apps/web                       | 1       | refactor(web): provider models keep their caching without "use memo" (#20775)                                      |          |
| `583ad66c52` | 2026-10-16 | apps/web                       | 1       | refactor(web): the thread lineage panel keeps its caching without "use memo" hooks (#20789)                        |          |
| `3f480b84a5` | 2026-10-16 | apps/web                       | 1       | refactor(web): the attachment preview keeps its caching without "use memo" hooks (#20757)                          |          |
| `4500480e03` | 2026-10-16 | apps/web                       | 1       | refactor(web): the pending user input panel keeps its caching without "use memo" hooks (#20762)                    |          |
| `e6c0c5e8b8` | 2026-10-16 | apps/web                       | 1       | refactor(web): the queued runs control keeps its caching without "use memo" hooks (#20779)                         |          |
| `83ffe0a8e0` | 2026-10-16 | apps/web                       | 1       | refactor(web): the open-in picker keeps its caching without "use memo" hooks (#20758)                              |          |
| `c0fda31e3e` | 2026-10-16 | apps/web                       | 1       | refactor(web): merged settings stay cached without "use memo" (#20765)                                             |          |
| `edc703b60a` | 2026-10-16 | apps/server                    | 2       | fix(server): a running Claude workflow member shows its answer so far (#20786)                                     |          |
| `1e436990c2` | 2026-10-16 | apps/web                       | 1       | refactor(web): the keybindings panel keeps its caching without "use memo" hooks (#20782)                           |          |
| `bcd3c12f46` | 2026-10-16 | apps/web                       | 1       | refactor(web): linked pull request status keeps its caching without "use memo" hooks (#20781)                      |          |
| `f4da08069e` | 2026-10-16 | apps/web                       | 1       | chore(web): React compiler rules apply to every web file (#20791)                                                  |          |
| `144aae4d4e` | 2026-10-16 | apps/web                       | 2       | test(web): React tests run compiled in a real browser (#20797)                                                     |          |
| `b30f0df44a` | 2026-10-17 | apps/web                       | 1       | refactor(web): the usage chart keeps its caching without "use memo" (#20792)                                       |          |
| `55ca0bb65e` | 2026-10-17 | apps/web                       | 1       | refactor(web): pull request detail keeps its caching without "use memo" (#20811)                                   |          |
| `2c722ba396` | 2026-10-17 | apps/web                       | 1       | refactor(web): the legacy sidebar keeps its caching without "use memo" (#20793)                                    |          |
| `1c33a198c4` | 2026-10-17 | apps/web                       | 3       | refactor(web): turn diff summaries keep their caching without "use memo" (#20794)                                  |          |
| `805b98e790` | 2026-10-17 | apps/web                       | 1       | refactor(web): the pull requests page keeps its caching without "use memo" (#20820)                                |          |
| `c60afa29f1` | 2026-10-17 | apps/web                       | 1       | refactor(web): the terminal drawer keeps its caching without "use memo" (#20799)                                   |          |
| `44ecfd65b6` | 2026-10-17 | apps/web                       | 1       | refactor(web): the model picker keeps its caching without "use memo" (#20815)                                      |          |
| `78f8d38ebb` | 2026-10-17 | apps/web                       | 2       | refactor(web): pull request code tab keeps its caching without "use memo" (#20816)                                 |          |
| `8eddd16067` | 2026-10-17 | apps/web                       | 3       | refactor(web): find reveal refs stay cached without "use memo" (#20818)                                            |          |
| `767da3b06d` | 2026-10-17 | apps/web                       | 1       | refactor(web): the branch selector keeps its caching without "use memo" (#20822)                                   |          |
| `f9baf517e0` | 2026-10-17 | apps/web                       | 2       | refactor(web): chat composer keeps its caching without "use memo" (#20834)                                         |          |
| `8c67f77af6` | 2026-10-17 | apps/web                       | 1       | refactor(web): the usage page keeps its caching without "use memo" (#20807)                                        |          |
| `e6ced718a3` | 2026-10-17 | apps/web                       | 1       | refactor(web): the command palette provider lookup keeps its caching without "use memo" (#20827)                   |          |
| `2fbd4318fc` | 2026-10-17 | oxlint-plugin-t3code           | 1       | chore(web): lint rejects "use memo" directives (#20843)                                                            |          |
| `2171c50726` | 2026-10-17 | apps/web                       | 3       | perf(web): relative "checked" labels re-render only when their text changes (#20819)                               |          |
| `1994d6396f` | 2026-10-17 | apps/web                       | 2       | perf(web): typing in the ACP registry search no longer re-renders every result row (#20817)                        |          |
| `734e887671` | 2026-10-17 | apps/web                       | 3       | perf(web): searching keybindings only renders rows entering or leaving the filter (#20840)                         |          |
| `74ca17b437` | 2026-10-17 | apps/web                       | 2       | perf(web): unchanged model picker rows skip re-rendering while searching (#20838)                                  |          |
| `130f4a2457` | 2026-10-17 | apps/web                       | 1       | perf(web): a minute tick no longer re-renders every sidebar thread row (#20814)                                    |          |
| `a75a6d7643` | 2026-10-17 | apps/web                       | 2       | test(web): misc-b tests run in a real browser (#20869)                                                             |          |
| `476a010fdc` | 2026-10-17 | apps/web                       | 3       | test(web): settings tests run in a real browser (#20872)                                                           |          |
| `ecd95d5eb5` | 2026-10-17 | apps/web                       | 4       | test(web): misc-a tests run in a real browser (#20868)                                                             |          |
| `89b42bfeb4` | 2026-10-17 | apps/web                       | 1       | test(web): browser tests from different checkouts no longer fight over one port (#20875)                           |          |
| `1d00edb23a` | 2026-10-17 | apps/web                       | 2       | perf(web): markdown replies no longer re-render on reconnects and config pushes (#20852)                           |          |
| `ecb938da58` | 2026-10-17 | apps/web                       | 4       | perf(web): provider status pushes no longer re-render every timeline row (#20854)                                  |          |
| `f96aebeb4b` | 2026-10-17 | apps/web                       | 1       | perf(web): right panel tabs no longer all re-render on unrelated chat updates (#20853)                             |          |
| `d56c479345` | 2026-10-17 | apps/web                       | 3       | perf(web): opening chat and usage dialogs no longer re-renders the whole page (#20859)                             |          |
| `812b7006f8` | 2026-10-17 | apps/web                       | 4       | perf(web): typing in form dialogs no longer re-renders the dialog chrome (#20842)                                  |          |
| `87ce906e4f` | 2026-10-17 | apps/web                       | 1       | fix(web): a project action's error belongs to the request that opened it (#20891)                                  |          |
| `2fae0f9841` | 2026-10-17 | apps/web                       | 3       | perf(web): opening an image preview no longer re-renders the chat view (#20845)                                    |          |
| `4d679a6324` | 2026-10-17 | apps/web                       | 2       | perf(client): equal query refetches no longer re-render PR rows (#20850)                                           |          |
| `db5919d87d` | 2026-10-17 | apps/web                       | 5       | perf(web): a provider status push no longer re-renders every provider card and model row (#20851)                  |          |
| `c20eab44e1` | 2026-10-17 | apps/web                       | 2       | test(web): pr-and-diff tests run in a real browser (#20901)                                                        |          |
| `da7c4f234d` | 2026-10-17 | apps/web                       | 4       | test(web): chat markdown and timeline tests run in a real browser (#20905)                                         |          |
| `133f57a832` | 2026-10-17 | apps/web                       | 2       | test(web): provider, usage and relationship tests run in a real browser (#20914)                                   |          |
| `d5b7095a09` | 2026-10-17 | apps/web                       | 3       | test(web): every React test runs in a real browser (#20944)                                                        |          |
| `7e0418a641` | 2026-10-17 | apps/server                    | 4       | fix(server): drop V1 projections nothing reads after the V2 upgrade (#20947)                                       |          |
| `07cb902866` | 2026-10-17 | apps/web                       | 1       | fix(web): a snoozed thread wakes in the open chat view (#21019)                                                    |          |
| `16918b57d6` | 2026-10-18 | apps/web                       | 1       | fix(web): table expand button only shows when a cell is cut off (#19782)                                           |          |
| `9b30776b3e` | 2026-10-17 | apps/mobile                    | 5       | perf(mobile): Metro runs the React Compiler, with a coverage ratchet (#20967)                                      |          |
| `ea97e8ba31` | 2026-10-17 | apps/mobile                    | 1       | test(mobile): measure renders on a device (#21001)                                                                 |          |
| `8f026485df` | 2026-10-17 | apps/web                       | 3       | fix(web): Working threads can be dragged into chat as references again (#19697)                                    |          |
| `2e16cf2822` | 2026-10-18 | apps/web                       | 1       | refactor(web): the command palette caches its derived lookups without "use memo" (#21116)                          |          |
| `eb1d80c667` | 2026-10-18 | apps/server                    | 4       | fix(server): opening a large database no longer blocks startup for minutes (#21122)                                |          |
| `91ec4bec2d` | 2026-10-18 | apps/web                       | 1       | perf(web): switching threads no longer re-renders the outgoing thread's rows (#21123)                              |          |
| `e0366ad0e4` | 2026-10-18 | packages/client-runtime        | 2       | perf(web): reasoning rows skip the tool-failure text scan (#21146)                                                 |          |
| `e1f33e023c` | 2026-10-18 | apps/mobile                    | 3       | refactor(mobile): Git and Agents sheet headers take theme colours from classes (#20409)                            |          |
| `91f8c35dee` | 2026-10-18 | apps/server                    | 2       | fix(server): Claude workflow members stream their thinking and tool calls into their threads (#20856)              |          |
| `60775b89c5` | 2026-10-18 | apps/web                       | 1       | fix(web): center default badges in the reasoning selector (#21252)                                                 |          |
| `b5b6c8cf4c` | 2026-10-18 | apps/web                       | 2       | fix(web): the model picker offers every saved custom model, not just the first 32 (#14961)                         |          |
| `529d8063cc` | 2026-10-19 | apps/server                    | 2       | fix(server): queued messages land after a resume that ran before them (#17773)                                     |          |
| `219b3c2820` | 2026-10-19 | apps/web                       | 1       | fix(web): code blocks no longer jump when highlighting finishes (#20923)                                           |          |
| `7138e6ef2a` | 2026-10-18 | apps/web                       | 1       | fix(devices): keep long diagnostics from hiding device controls (#19973)                                           |          |
| `db88e6b5bf` | 2026-10-18 | apps/web                       | 1       | fix(web): keep the diff panel head ref visible when the panel is narrow (#19089)                                   |          |
| `05d60554ec` | 2026-10-18 | apps/web                       | 1       | fix(web): branch picker keeps space below the last branch (#21159)                                                 |          |
| `1d1a8e5b07` | 2026-10-18 | apps/server                    | 1       | fix(provider-acp): name the rejected agent path on stderr and test the bash path (#18489)                          |          |
| `073734c1e9` | 2026-10-19 | apps/web                       | 1       | fix(web): failed attachment uploads no longer block sending (#20737)                                               |          |
| `626a4cbfcf` | 2026-10-18 | apps/web                       | 1       | fix(web): collapsed projects no longer leave a border stub in the legacy sidebar (#18314)                          |          |
| `390b4c4396` | 2026-10-18 | apps/server                    | 1       | fix(server): another worktree's install no longer restarts the dev server (#21065)                                 |          |
| `9bf3f97eda` | 2026-10-19 | apps/web                       | 1       | fix(web): expanded composer notices blur the thread behind them (#19871)                                           |          |
| `0224cd13ee` | 2026-10-19 | apps/web                       | 1       | fix(web): citation pills line up with the other composer chips (#19547)                                            |          |
| `3f2dbd7d11` | 2026-10-18 | apps/web                       | 1       | fix(web): tapping away from the model picker on a phone no longer presses what is under it (#20841)                |          |
| `c6dfda8e56` | 2026-10-18 | apps/server                    | 1       | perf(server): colored terminal output no longer copies history one character at a time (#21209)                    |          |
| `6b3a49b372` | 2026-10-18 | apps/web                       | 1       | fix(web): stacked composer notices keep their right border (#19044)                                                |          |
| `7241e7ee50` | 2026-10-18 | apps/web                       | 3       | fix(web): the default-branch dialog no longer offers a feature branch it cannot create (#18716)                    |          |
| `871c7b7757` | 2026-10-18 | apps/web                       | 1       | fix(web): truncate project names only when needed (#17208)                                                         |          |
| `ba1907e8e0` | 2026-10-18 | apps/web                       | 2       | fix(web): diff counts follow the selected color palette (#18288)                                                   |          |
| `c32dc2f1c9` | 2026-10-18 | apps/desktop                   | 2       | fix(desktop): the SnapShot GNOME extension loads on GNOME 51 (#17436)                                              |          |
| `70bdbc30b2` | 2026-10-18 | apps/web                       | 2       | fix(web): composer host and workspace tooltips show their shortcuts (#21167)                                       |          |
| `0b896d9ff1` | 2026-10-18 | apps/server                    | 1       | fix(server): title imported Codex threads after the user request (#20278)                                          |          |
| `bd438fb315` | 2026-10-18 | apps/server                    | 2       | fix(acp): preserve native slash command prompt shape (#19393)                                                      |          |
| `89d4e8bef9` | 2026-10-18 | apps/web                       | 1       | fix(web): align pull request comment headers (#15341)                                                              |          |
| `dba8297da4` | 2026-10-18 | apps/server                    | 2       | fix(server): reject worktree delegation from a checkout outside the project (#20213)                               |          |
| `fc0c36f963` | 2026-10-18 | apps/web                       | 2       | fix(web): stop offering a provider update that cannot clear a limited-support warning (#17676)                     |          |
| `abfc5727bf` | 2026-10-19 | apps/web                       | 4       | fix(web): show a real arrow in the context compacted divider (#20326)                                              |          |
| `df198f9de9` | 2026-10-19 | apps/desktop                   | 3       | fix(desktop): keep disabled backends stopped after failed updates (#18414)                                         |          |
| `1ea378c6f4` | 2026-10-18 | apps/web                       | 1       | perf(web): reveal nested files faster (#21048)                                                                     |          |
| `91adab7161` | 2026-10-18 | apps/server                    | 4       | fix(server): Codex threads get the whole T3 orchestration instructions (#18415)                                    |          |
| `499c9ee68b` | 2026-10-18 | apps/server                    | 2       | fix(server): a /compact stopped by the Claude usage limit now fails (#19583)                                       |          |
| `1ffa2cbb44` | 2026-10-18 | packages/provider-core         | 2       | fix(server): keep WinGet Claude installs manual-only instead of running claude update (#19517)                     |          |
| `d6888999db` | 2026-10-18 | apps/server                    | 1       | perf(server): skip unused probes when switching Git refs (#20140)                                                  |          |
| `f15aa815f3` | 2026-10-19 | apps/web                       | 2       | fix(web): sidebar update pill shows updates on non-default provider instances (#14745)                             |          |
| `340ee237bf` | 2026-10-18 | apps/server                    | 2       | fix(usage): show Antigravity Gemini limits when one quota endpoint omits them (#20081)                             |          |
| `71aa1173b0` | 2026-10-18 | packages/provider-cursor       | 2       | fix(cursor): explain model rejections from the account catalog (#19678)                                            |          |
| `e7308986cb` | 2026-10-18 | apps/web                       | 1       | fix(web): long approval commands wrap inside the composer (#17802)                                                 |          |
| `bbe826993f` | 2026-10-18 | apps/web                       | 1       | fix(web): pending questions no longer squash the composer on narrow windows (#20391)                               |          |
| `8a948076bb` | 2026-10-18 | apps/web                       | 1       | fix(web): switched-off controls stay visible in dark mode (#14984)                                                 |          |
| `b90b8052c4` | 2026-10-18 | apps/web                       | 1       | fix(web): close the gap between the composer and its bottom toolbar (#12952)                                       |          |
| `f98118d033` | 2026-10-18 | apps/desktop                   | 1       | fix(desktop): Install Linux theme icons named after the app id (#14471)                                            |          |
| `a651a52ecf` | 2026-10-18 | apps/web                       | 1       | fix(web): show reset credit progress after the usage popover closes (#19808)                                       |          |
| `8a282225fe` | 2026-10-19 | apps/desktop                   | 4       | fix(desktop): prevent duplicate backends on macOS (#19554)                                                         |          |
| `74ae8d6f37` | 2026-10-19 | apps/server                    | 2       | fix(usage): fall back to GitHub API for model prices (#21055)                                                      |          |
| `784bad1c68` | 2026-10-18 | apps/web                       | 1       | fix(web): the Tailscale HTTPS row says detection is off instead of telling users to start Tailscale (#18758)       |          |
| `4d4297c9e8` | 2026-10-18 | apps/server                    | 3       | fix(server): stop restoring stale Pi models (#18498)                                                               |          |
| `86ce795392` | 2026-10-18 | packages/provider-core         | 1       | fix(server): keep characters intact in generated commit subjects (#19181)                                          |          |
| `ad2ac0f1ee` | 2026-10-18 | apps/server                    | 2       | fix(server): provider logs skip Claude thinking-token counters (#19789)                                            |          |
| `eb1db5ff80` | 2026-10-18 | packages/provider-muse         | 1       | fix(provider-muse): show readable model names in the picker (#19100)                                               |          |
| `a31f1f2086` | 2026-10-18 | apps/desktop                   | 1       | fix(desktop): bound preview recording warmup (#20085)                                                              |          |
| `25dff68e01` | 2026-10-19 | apps/web                       | 2       | fix(web): a failed run shows Failed, not Completed (#20996)                                                        |          |
| `2e8d70b232` | 2026-10-18 | apps/server                    | 2       | fix(server): opening a folder in File Explorer no longer lands on the wrong folder (#18549)                        |          |
| `27ccbe9dd5` | 2026-10-18 | apps/server                    | 2       | fix(devices): skip Apple device discovery on non-Mac hosts (#18159)                                                |          |
| `558b55a6b6` | 2026-10-18 | apps/desktop                   | 1       | fix(desktop): paste and other editing shortcuts work in every browser tab (#19452)                                 |          |
| `36b6c036e8` | 2026-10-18 | apps/web                       | 2       | fix(web): Antigravity setup card separators match other settings cards (#20088)                                    |          |
| `09e54fd990` | 2026-10-18 | apps/web                       | 1       | fix(web): explain pull request diff load failures (#19945)                                                         |          |
| `4c52938fdb` | 2026-10-18 | apps/server                    | 1       | fix(antigravity): keep the runtime version learned from ACP (#20980)                                               |          |
| `6a9f588309` | 2026-10-18 | scripts                        | 1       | perf(mobile): clean Android builds keep their Gradle and native caches (#20069)                                    |          |
| `afc12ab70a` | 2026-10-18 | apps/server                    | 3       | fix(server): a steered send no longer leaves a subagent task running (#19019)                                      |          |
| `b058babb16` | 2026-10-18 | packages/provider-opencode     | 1       | fix(opencode): retry shared database locks during startup (#17922)                                                 |          |
| `a917d843b3` | 2026-10-18 | apps/server                    | 3       | fix(server): held assistant drafts keep their position when flushed at turn end (#19023)                           |          |
| `a331655b74` | 2026-10-19 | packages/ssh                   | 2       | fix(ssh): keep draining tunnel diagnostics after readiness (#18832)                                                |          |
| `c1f9d20263` | 2026-10-18 | apps/web                       | 2       | fix(web): threads finishing together play one completion sound (#17540)                                            |          |
| `5088aff613` | 2026-10-19 | apps/web                       | 1       | fix(web): move keyboard interaction out of the closing right panel (#14786)                                        |          |
| `7b25aed54f` | 2026-10-18 | apps/web                       | 1       | fix(web): show math labels in Mermaid diagrams (#16198)                                                            |          |
| `17fa628866` | 2026-10-18 | apps/server                    | 3       | fix(web): device tool update failures show the server error, not network advice (#17569)                           |          |
| `2c8f3a0cfc` | 2026-10-18 | apps/server                    | 2       | fix(server): a branch on the only remote is not a fork when there is no origin (#20412)                            |          |
| `76f57f9b84` | 2026-10-19 | apps/server                    | 3       | fix(server): preserve explicit effort for unknown Claude models (#20849)                                           |          |
| `43076b57cb` | 2026-10-19 | apps/web                       | 1       | fix(web): show No project in scratch thread breadcrumbs (#19721)                                                   |          |
| `0a712f0cdc` | 2026-10-18 | packages/shared                | 2       | fix(shared): match Windows home paths case-insensitively in file links (#19627)                                    |          |
| `356e6d02d5` | 2026-10-18 | apps/server                    | 3       | fix(server): t3_preview_close reports the server browser's refusal (#17429)                                        |          |
| `15ca727b17` | 2026-10-18 | apps/desktop                   | 2       | fix(desktop): reload the main renderer after it is killed (#20300)                                                 |          |
| `145fba7ffc` | 2026-10-18 | packages/client-runtime        | 1       | fix(client-runtime): a dropped session no longer reads as a failed connection (#18469)                             |          |
| `c59ab7d92a` | 2026-10-18 | packages/provider-opencode     | 1       | fix(server): slow OpenCode wrappers no longer show as unavailable (#16544)                                         |          |
| `ecb8ddd305` | 2026-10-18 | apps/server                    | 1       | fix(server): desktop backend now exits when its launcher dies (#20277)                                             |          |
| `deb5b3941d` | 2026-10-18 | apps/web                       | 2       | fix(composer): paths such as /tmp/build.sh no longer open the slash menu (#19671)                                  |          |
| `189af1aaa4` | 2026-10-18 | apps/server                    | 2       | fix(server): refresh local status after an automatic pull fails (#19686)                                           |          |
| `6ac3bc553e` | 2026-10-18 | apps/web                       | 1       | perf(web): sidebar working timers share one clock (#21195)                                                         |          |
| `972e39266a` | 2026-10-18 | scripts                        | 1       | fix(scripts): leave type-only packages out of third-party notices (#14627)                                         |          |
| `23dae7b3a3` | 2026-10-18 | apps/server                    | 3       | fix(server): allow restarts when a stale runtime record matches the server pid (#20336)                            |          |
| `d608709188` | 2026-10-18 | apps/desktop                   | 3       | fix(desktop): ignore snapshot shortcut repeats during flight (#11037)                                              |          |
| `93ea95cf41` | 2026-10-18 | packages/provider-muse         | 2       | fix(server): Muse turns stopped by the subscription quota are Limited, not failed (#18266)                         |          |
| `976eb02afe` | 2026-10-18 | apps/web                       | 1       | fix(web): new project options scroll above the footer (#17064)                                                     |          |
| `21baef5c87` | 2026-10-19 | apps/server                    | 2       | fix(server): stop retrying saved checkpoints after refresh failures (#20195)                                       |          |
| `ddafde5e9a` | 2026-10-18 | apps/server                    | 2       | fix(server): MCP thread reads skip the item scan they filter to nothing (#17038)                                   |          |
| `a75ea468b1` | 2026-10-18 | apps/server                    | 2       | fix(server): keep a remote server update running when the client disconnects (#18980)                              |          |
| `7a88b19576` | 2026-10-19 | apps/web                       | 2       | fix(web): custom model price cells take only numbers (#19245)                                                      |          |
| `6241d9d18a` | 2026-10-18 | apps/server                    | 2       | fix(server): discover Claude skills from add-dir launch args (#20167)                                              |          |
| `73e5d5bd76` | 2026-10-18 | apps/server                    | 2       | perf(server): OpenCode 2 stops writing unchanged session status updates (#16775)                                   |          |
| `bf8236303f` | 2026-10-19 | apps/web                       | 1       | fix(web): give archive actions more icon spacing (#19769)                                                          |          |
| `d37bce55f2` | 2026-10-18 | apps/server                    | 2       | fix(server): checkpoints no longer expire a split index the repo still uses (#17074)                               |          |
| `bbcaa79907` | 2026-10-18 | apps/web                       | 1       | fix(web): usage limit recovery errors no longer crush the composer banner (#17457)                                 |          |
| `37a08d3121` | 2026-10-18 | scripts                        | 2       | fix(desktop): local desktop builds no longer crash when a GitHub token is in the shell (#19277)                    |          |
| `6670dc734e` | 2026-10-19 | apps/web                       | 1       | fix(web): a resumed subagent's notification row shows it running, not failed (#18099)                              |          |
| `93ae22a4d5` | 2026-10-18 | apps/server                    | 3       | fix(mcp): optional tool parameters accept the null their schema advertises (#20411)                                |          |
| `38c662508c` | 2026-10-19 | apps/server                    | 1       | fix: database errors show actionable recovery guidance (#20748)                                                    |          |
| `442d5ca655` | 2026-10-18 | apps/web                       | 2       | fix(web): stored pull request details keep only the 20 most recent (#21245)                                        |          |
| `02e9d2417a` | 2026-10-18 | apps/web                       | 2       | fix(web): a comment under a composer quote no longer joins the quote (#19450)                                      |          |
| `265d68ab04` | 2026-10-18 | apps/server                    | 2       | fix(server): reverting a Claude thread to a subagent-only turn no longer breaks it (#21151)                        |          |
| `80df91b52b` | 2026-10-18 | apps/web                       | 2       | fix(web): keep answered questions visible after a turn settles (#21086)                                            |          |
| `b18a9bf5b1` | 2026-10-18 | apps/server                    | 1       | fix(server): keep scheduled-task intervals on elapsed time across DST (#15768)                                     |          |
| `982d2ac279` | 2026-10-18 | apps/web                       | 3       | fix(web): the Diff tab keeps its scope when you switch tabs (#20297)                                               |          |
| `6d5060c2f0` | 2026-10-18 | packages/provider-core         | 2       | fix(provider-core): stop false updates for versionless casks (#20386)                                              |          |
| `8b0fbc9a7d` | 2026-10-18 | apps/server                    | 1       | fix(server): honor configured remote diff bases (#16453)                                                           |          |
| `10db5e493f` | 2026-10-18 | packages/client-runtime        | 1       | fix(client-runtime): Update clears the block on a host that is already compatible (#18563)                         |          |
| `8678a80c2f` | 2026-10-18 | apps/server                    | 1       | fix(server): a disabled bootstrap provider no longer stops startup (#20035)                                        |          |
| `24c71ebdd7` | 2026-10-19 | apps/server                    | 5       | fix(server): watching a pull request again no longer repeats news the thread already got (#21155)                  |          |
| `96d354ae86` | 2026-10-18 | apps/web                       | 5       | fix(server): tell users how to update an install T3 cannot update (#18110)                                         |          |
| `b497d129ef` | 2026-10-19 | apps/server                    | 2       | fix(server): disabled providers no longer report missing executables (#18109)                                      |          |
| `cef6f7ae5e` | 2026-10-18 | apps/server                    | 2       | fix(server): keep workspace skills when provider health fails (#18309)                                             |          |
| `eb51389e4e` | 2026-10-18 | apps/desktop                   | 4       | fix(desktop): keypad shortcuts and Ctrl+wheel zoom the app (#21200)                                                |          |
| `34b0a9e1bb` | 2026-10-18 | apps/server                    | 1       | fix(server): setup actions no longer run for threads in the main checkout (#18891)                                 |          |
| `49e00ee30c` | 2026-10-18 | apps/web                       | 2       | fix(web): thread drops land in the visible thread's draft (#20024)                                                 |          |
| `ac77f4f8e4` | 2026-10-18 | packages/provider-cursor       | 1       | fix(server): failed Cursor turns show Cursor's reason (#16146)                                                     |          |
| `4309a05652` | 2026-10-19 | apps/web                       | 5       | fix(web): honor the send shortcut for follow-up actions (#20929)                                                   |          |
| `27bf560fb2` | 2026-10-18 | apps/web                       | 2       | fix(web): image viewer close button stays clear of the window controls (#13919)                                    |          |
| `7792cd5445` | 2026-10-18 | apps/server                    | 1       | fix(server): parent Stop clears orphaned delegated follow-ups (#20310)                                             |          |
| `b6629dcd68` | 2026-10-18 | packages/shared                | 1       | fix(opencode): OpenCode servers stop with a killed server on Windows (#21103)                                      |          |
| `7a1c8f47e4` | 2026-10-19 | apps/web                       | 2       | fix(web): recognize Windows terminal file links (#21199)                                                           |          |
| `9494dbaff6` | 2026-10-18 | packages/shared                | 3       | fix(shared): Windows saves no longer fail while a scanner holds the file (#21062)                                  |          |
| `76ff0eb2a1` | 2026-10-19 | apps/server                    | 5       | fix(server): recover after Claude capability probe failures (#21042)                                               |          |
| `a523b0036e` | 2026-10-19 | packages/provider-core         | 2       | fix(provider-core): pnpm-global updates approve the provider's build (#20796)                                      |          |
| `d8125a5d88` | 2026-10-18 | apps/server                    | 1       | fix(server): usage-limit sweep stops scanning every run each tick (#21191)                                         |          |
| `ab89a5956b` | 2026-10-18 | apps/server                    | 2       | fix(provider-grok): report model windows for handoff budgets (#20180)                                              |          |
| `189f0f87ad` | 2026-10-18 | apps/server                    | 2       | fix(server): cancel preparing runs when archiving threads (#20073)                                                 |          |
| `a26428f833` | 2026-10-18 | apps/desktop                   | 2       | fix(desktop): a failed macOS test capture no longer blames the GNOME extension (#18857)                            |          |
| `1114c3815b` | 2026-10-18 | apps/web                       | 1       | fix(web): scrolling a huge thread's history no longer loops the message list (#21269)                              |          |
| `599d21060a` | 2026-10-19 | apps/web                       | 1       | fix(web): keep compressed image chips in their original draft (#18393)                                             |          |
| `a0b5df18bf` | 2026-10-18 | apps/server                    | 2       | fix(server): Claude wake runs no longer end empty while Claude is still answering (#15816)                         |          |
| `efcf77fc72` | 2026-10-18 | apps/web                       | 1       | fix(web): Compose input no longer adds stray quotes (#20350)                                                       |          |
| `31be3e9b49` | 2026-10-18 | apps/server                    | 2       | fix(server): apps opened from T3 Code no longer inherit ELECTRON_RUN_AS_NODE (#20206)                              |          |
| `3c09cda7ea` | 2026-10-18 | apps/web                       | 1       | fix(web): show an empty result when file search finds no matches (#17132)                                          |          |
| `66cae3d756` | 2026-10-18 | apps/server                    | 2       | fix(server): read Claude context usage from stream message deltas (#19416)                                         |          |
| `62c74a92f9` | 2026-10-19 | apps/server                    | 1       | fix(server): stop the branch rename before cancelling worktree setup (#18443)                                      |          |
| `3e9de4672c` | 2026-10-19 | apps/server                    | 2       | fix(server): find existing PR worktrees beyond the first branch page (#18407)                                      |          |
| `01d2aa87f5` | 2026-10-19 | apps/web                       | 1       | fix(web): restore palette focus when no composer is mounted (#18850)                                               |          |
| `af134abf79` | 2026-10-18 | apps/desktop                   | 1       | fix(desktop): unregistering a WSL backend now stops its supervisor (#18575)                                        |          |
| `64a3ca48fb` | 2026-10-18 | apps/mobile                    | 4       | fix(web,mobile): limit bars use each provider's chart color (#16936)                                               |          |
| `699c1c5d4c` | 2026-10-18 | apps/server                    | 2       | fix(server): re-snoozing a woken thread to the same wake time hides it again (#14887)                              |          |
| `abd33b12ce` | 2026-10-18 | apps/server                    | 2       | fix(server): t3_thread_send reports why the orchestrator refused a message (#21027)                                |          |
| `d9559ee1aa` | 2026-10-18 | apps/web                       | 4       | fix(web): render stored HEIC attachments (#10429)                                                                  |          |
| `c803a80633` | 2026-10-19 | apps/web                       | 1       | fix(web): truncate draft project names in the middle (#18858)                                                      |          |
| `dfda92872d` | 2026-10-18 | apps/server                    | 2       | fix(server): report missing Node on SSH device hosts instead of a connection failure (#20377)                      |          |
| `3cc98ba567` | 2026-10-19 | apps/server                    | 2       | fix(server): preserve unrelated branch upstreams when opening fork PRs (#18413)                                    |          |
| `e51c0d6777` | 2026-10-18 | apps/server                    | 2       | fix(server): a Claude hook that drops a prompt now shows its reason (#21231)                                       |          |
| `3adac9403f` | 2026-10-18 | apps/server                    | 2       | fix(server): ACP agents that need no sign-in drop models they stopped advertising (#18807)                         |          |
| `c38777968b` | 2026-10-19 | apps/server                    | 2       | fix(server): explain root browser launch failures instead of pointing to setup (#19846)                            |          |
| `ff7b24a704` | 2026-10-18 | apps/server                    | 2       | fix(server): reject thread.create for an existing id (#19704)                                                      |          |
| `d6841e9098` | 2026-10-18 | apps/server                    | 4       | fix(server): MCP thread list and read report every linked pull request (#17454)                                    |          |
| `834f0e3a1b` | 2026-10-18 | packages/shared                | 1       | fix(markdown): Windows paths in messages keep their backslashes (#21069)                                           |          |
| `63e18dffc5` | 2026-10-18 | apps/server                    | 2       | fix(server): replace Claude sessions that never saved a message (#19637)                                           |          |
| `e560b26a68` | 2026-10-19 | apps/web                       | 2       | fix(web): terminal drawer covers the turn minimap (#14383)                                                         |          |
| `0ae495158e` | 2026-10-19 | apps/server                    | 2       | fix(server): Claude subagents keep their model after a usage-limit notice (#17097)                                 |          |
| `3ec095bc8b` | 2026-10-18 | apps/web                       | 1       | fix(web): collapsed composer centers drafts that start with a list (#17820)                                        |          |
| `fb9af9e57d` | 2026-10-18 | apps/server                    | 2       | fix(server): a full Claude context window no longer shows as a usage limit (#19848)                                |          |
| `e2cc34f1e4` | 2026-10-18 | apps/server                    | 4       | perf(server): skip unused diffs for user-written commit messages (#19605)                                          |          |
| `1c12af22d6` | 2026-10-18 | apps/server                    | 1       | test(server): wait for a workflow member's late reply to reach the test's event log (#21310)                       |          |
| `ca4d583054` | 2026-10-18 | apps/mobile                    | 5       | fix(mobile): sheets close with an X and confirm with a checkmark (#21319)                                          |          |
| `15903f11ab` | 2026-10-18 | apps/web                       | 4       | chore(deps): web and mobile share React 19.3 from the catalog (#21376)                                             |          |
| `cab362d458` | 2026-10-18 | apps/server                    | 4       | fix(server): migrate legacy thread pull request links (#19129)                                                     |          |

## SKIP?

| Commit       | Date       | Area                    | Overlap | Subject                                                                                                        | Decision                                  |
| ------------ | ---------- | ----------------------- | ------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `328dc27d63` | 2026-10-11 | apps/mobile             | 1       | fix(mobile): add compose to the single-column iPad list (#18157)                                               | SKIP (Jake 2026-10-18: no mobile release) |
| `4bd0ecca19` | 2026-10-11 | apps/mobile             | 6       | fix(mobile): let sheet lists scroll before dismissal (#17177)                                                  | SKIP (Jake 2026-10-18: no mobile release) |
| `b4af60253b` | 2026-10-11 | apps/mobile             | 1       | fix(mobile): restore compact iPad trackpad scrolling (#13665)                                                  | SKIP (Jake 2026-10-18: no mobile release) |
| `b9bf60907f` | 2026-10-11 | apps/mobile             | 2       | fix(mobile): preserve filters across layout changes (#13085)                                                   | SKIP (Jake 2026-10-18: no mobile release) |
| `80cd57585d` | 2026-10-11 | apps/mobile             | 2       | fix(mobile): separate unfolded thread list from header (#13088)                                                | SKIP (Jake 2026-10-18: no mobile release) |
| `a1f81a44e5` | 2026-10-11 | apps/mobile             | 1       | fix(android): Match thread fallback layouts to the loaded pane (#14669)                                        | SKIP (Jake 2026-10-18: no mobile release) |
| `74f9df3abf` | 2026-10-11 | apps/mobile             | 1       | fix(mobile): size inline MCP apps to their content (#17040)                                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `b147dc99e3` | 2026-10-11 | apps/mobile             | 1       | fix(mobile): preserve iPad search chrome across layout changes (#13667)                                        | SKIP (Jake 2026-10-18: no mobile release) |
| `8863990fca` | 2026-10-11 | apps/mobile             | 16      | fix(android): Use MD3 loading spinners (#14282)                                                                | SKIP (Jake 2026-10-18: no mobile release) |
| `81dbc870da` | 2026-10-11 | apps/mobile             | 0       | fix(mobile): keep bot badges out of PR attachments (#18347)                                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `c0c495e4dc` | 2026-10-11 | .github                 | 1       | ci(mobile): publish nightly Android APKs to a GitHub prerelease (#16271)                                       |                                           |
| `aa2bfc604c` | 2026-10-12 | apps/mobile             | 1       | fix(mobile): preserve browser prompt replies across control updates (#18419)                                   | SKIP (Jake 2026-10-18: no mobile release) |
| `b8d03ba2dd` | 2026-10-11 | apps/mobile             | 1       | fix(mobile): new thread draft names its repo and says it is a new thread (#17611)                              | SKIP (Jake 2026-10-18: no mobile release) |
| `397a461239` | 2026-10-11 | apps/mobile             | 7       | feat(android): add Pull Requests tab (#18372)                                                                  | SKIP (Jake 2026-10-18: no mobile release) |
| `12b34e83af` | 2026-10-11 | apps/mobile             | 0       | fix(mobile): Forgejo change requests ask for the summary they require (#18455)                                 | SKIP (Jake 2026-10-18: no mobile release) |
| `52f9046260` | 2026-10-11 | apps/mobile             | 3       | fix(mobile): keep PR surfaces and Android tab selection visible across themes (#18479)                         | SKIP (Jake 2026-10-18: no mobile release) |
| `4ab4cdf452` | 2026-10-11 | apps/mobile             | 2       | fix(mobile): keep preview count badges inside the working pill (#18449)                                        | SKIP (Jake 2026-10-18: no mobile release) |
| `2e24ec44db` | 2026-10-11 | apps/mobile             | 3       | fix(mobile): show rounded pull request selection in the sidebar (#18480)                                       | SKIP (Jake 2026-10-18: no mobile release) |
| `19bef8c1d5` | 2026-10-11 | .github                 | 0       | ci(mobile): cut a store build when the native fingerprint has no build (#18496)                                |                                           |
| `6f6197c465` | 2026-10-11 | apps/mobile             | 3       | fix(mobile): restore native scroll-edge effects on forms and PRs (#18507)                                      | SKIP (Jake 2026-10-18: no mobile release) |
| `679b03e1c6` | 2026-10-11 | apps/mobile             | 10      | fix(mobile): preserve theme contrast across surfaces and actions (#18506)                                      | SKIP (Jake 2026-10-18: no mobile release) |
| `a39fd7be95` | 2026-10-11 | apps/mobile             | 0       | refactor(mobile): share themed list rows and sections (#18510)                                                 | SKIP (Jake 2026-10-18: no mobile release) |
| `9a2b9a2d40` | 2026-10-11 | apps/mobile             | 1       | refactor(mobile): share themed toggle rows in settings (#18511)                                                | SKIP (Jake 2026-10-18: no mobile release) |
| `abc80c80a7` | 2026-10-11 | apps/mobile             | 0       | refactor(mobile): share themed choice rows in settings (#18516)                                                | SKIP (Jake 2026-10-18: no mobile release) |
| `8f25cf9edb` | 2026-10-12 | pnpm-workspace.yaml     | 0       | fix(release): drop placeholder allowBuilds entry that broke nightly builds (#18560)                            |                                           |
| `f498b3514b` | 2026-10-12 | apps/mobile             | 0       | fix(mobile): menu dismiss taps no longer press the view underneath (#18565)                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `5d59e7107f` | 2026-10-12 | .github                 | 0       | fix(release): avoid PowerShell crashes on Windows ARM (#18573)                                                 |                                           |
| `7b6d907574` | 2026-10-12 | apps/mobile             | 0       | fix(mobile): iPhones on iOS 27.2 beta no longer open to a black screen (#18654)                                | SKIP (Jake 2026-10-18: no mobile release) |
| `41d86c1b1c` | 2026-10-13 | apps/mobile             | 0       | fix(mobile): Browser page no longer logs a duplicate key warning (#18776)                                      | SKIP (Jake 2026-10-18: no mobile release) |
| `a143fa3c56` | 2026-10-13 | packages/client-runtime | 3       | fix(client): T3 Connect clients reconnect once a new tunnel is ready (#16554)                                  |                                           |
| `5070a83a32` | 2026-10-12 | apps/mobile             | 0       | fix(mobile): pull requests load from another environment when theirs is offline (#18698)                       | SKIP (Jake 2026-10-18: no mobile release) |
| `42160f2925` | 2026-10-13 | .github                 | 0       | fix(ci): retry Cursor webhook HTTP 400s on main (#19077)                                                       |                                           |
| `a4e2539483` | 2026-10-14 | apps/web                | 2       | fix(web): Android beta links point to the APK release, not the banned Google group (#18955)                    |                                           |
| `107f6024ea` | 2026-10-13 | apps/mobile             | 0       | fix(mobile): search bar animates in on iOS 26+ instead of popping (#19209)                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `173a970976` | 2026-10-14 | apps/server             | 0       | fix(server): bound activity publishes so stalled responses release the worker (#18830)                         |                                           |
| `e6626ee164` | 2026-10-14 | packages/client-runtime | 3       | fix(client-runtime): T3 Connect link timeouts explain the relay 504 (#19329)                                   |                                           |
| `d10621de5f` | 2026-10-14 | apps/mobile             | 4       | fix(mobile): incompatible environments now say whether to update the app or the host (#19331)                  | SKIP (Jake 2026-10-18: no mobile release) |
| `cd45be3b57` | 2026-10-14 | apps/server             | 0       | fix(server): T3 Connect no longer stays down after a network change (#19335)                                   |                                           |
| `519d64f6ce` | 2026-10-14 | apps/server             | 6       | fix(server): settled and idle-released threads no longer stay Waiting (#19355)                                 |                                           |
| `f5b5f9dd7b` | 2026-10-14 | apps/server             | 1       | fix(server): a failed T3 Connect relink no longer leaves a stale managed tunnel (#19383)                       |                                           |
| `f99b202753` | 2026-10-14 | apps/web                | 4       | fix(web): T3 Connect settings can repair a link that drifted to publish-only (#19389)                          |                                           |
| `2cde3f770b` | 2026-10-14 | apps/web                | 0       | fix(web): terminal tells the shell its new width as soon as you release a resize drag (#19395)                 |                                           |
| `8e018ff91f` | 2026-10-14 | apps/server             | 9       | fix(server): a deregistered T3 Connect host shows it was removed and offers a relink (#19379)                  |                                           |
| `d09a9eadf4` | 2026-10-16 | apps/mobile             | 5       | fix(mobile): new threads no longer get stuck on Starting (#15870)                                              | SKIP (Jake 2026-10-18: no mobile release) |
| `d2f2b7cdac` | 2026-10-15 | apps/mobile             | 0       | fix(mobile): pull request lists fill the available scroll viewport (#18767)                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `c079503d07` | 2026-10-15 | apps/mobile             | 1       | fix(mobile): release iOS audio session after video playback (#18539)                                           | SKIP (Jake 2026-10-18: no mobile release) |
| `b089f959b2` | 2026-10-15 | apps/mobile             | 0       | refactor(mobile): share settings action rows (#18529)                                                          | SKIP (Jake 2026-10-18: no mobile release) |
| `2bcc5cc94d` | 2026-10-15 | apps/mobile             | 7       | fix(mobile): standardize shared button states and adoption (#18530)                                            | SKIP (Jake 2026-10-18: no mobile release) |
| `e64cee0a92` | 2026-10-15 | apps/mobile             | 3       | refactor(mobile): adopt shared controls and add component catalog (#18541)                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `e028a083b9` | 2026-10-15 | apps/mobile             | 1       | refactor(mobile): share theme mapping across Android controls (#19217)                                         | SKIP (Jake 2026-10-18: no mobile release) |
| `a2d4a872e0` | 2026-10-15 | apps/mobile             | 4       | refactor(mobile): expose shared icon button and search field APIs (#19264)                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `d5ae09aef0` | 2026-10-15 | apps/mobile             | 10      | refactor(mobile): expose native menus through a shared Menu API (#19265)                                       | SKIP (Jake 2026-10-18: no mobile release) |
| `8d2e919c15` | 2026-10-15 | apps/mobile             | 5       | refactor(mobile): centralize dialog and sheet APIs (#19266)                                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `e846ad5505` | 2026-10-15 | apps/mobile             | 21      | refactor(mobile): expose app bar toolbar and FAB APIs (#19951)                                                 | SKIP (Jake 2026-10-18: no mobile release) |
| `487423a320` | 2026-10-15 | apps/mobile             | 0       | feat(mobile): share actionable toasts and native progress (#19952)                                             | SKIP (Jake 2026-10-18: no mobile release) |
| `68eb28dce0` | 2026-10-15 | apps/mobile             | 0       | refactor(mobile): adopt shared text shape and motion tokens (#19953)                                           | SKIP (Jake 2026-10-18: no mobile release) |
| `ac57e62f72` | 2026-10-15 | apps/mobile             | 0       | refactor(mobile): adopt native Android screen headers (#19995)                                                 | SKIP (Jake 2026-10-18: no mobile release) |
| `4b8fb2e237` | 2026-10-15 | apps/mobile             | 0       | refactor(mobile): finish shared control token adoption (#19996)                                                | SKIP (Jake 2026-10-18: no mobile release) |
| `505ccfd0e4` | 2026-10-15 | apps/mobile             | 0       | fix(mobile): route alerts through the themed dialog presenter (#19997)                                         | SKIP (Jake 2026-10-18: no mobile release) |
| `d88f515441` | 2026-10-15 | apps/mobile             | 10      | refactor(mobile): adopt shared alerts in settings and connections (#19998)                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `e3438b8090` | 2026-10-15 | apps/mobile             | 14      | refactor(mobile): adopt shared alerts in thread and PR screens (#19999)                                        | SKIP (Jake 2026-10-18: no mobile release) |
| `3b43e3f1f0` | 2026-10-15 | apps/mobile             | 15      | refactor(mobile): finish shared alert adoption (#20000)                                                        | SKIP (Jake 2026-10-18: no mobile release) |
| `f3280793fa` | 2026-10-15 | apps/mobile             | 2       | refactor(mobile): adopt shared loading indicators across screens (#20001)                                      | SKIP (Jake 2026-10-18: no mobile release) |
| `fbbd4596e4` | 2026-10-15 | apps/mobile             | 9       | refactor(mobile): unify navigation and floating toolbar APIs (#20002)                                          | SKIP (Jake 2026-10-18: no mobile release) |
| `79b304367e` | 2026-10-15 | apps/mobile             | 0       | refactor(mobile): use native iOS sliders (#20016)                                                              | SKIP (Jake 2026-10-18: no mobile release) |
| `9fbc753ec4` | 2026-10-15 | apps/mobile             | 0       | refactor(mobile): use shared Menu for markdown long presses (#20019)                                           | SKIP (Jake 2026-10-18: no mobile release) |
| `86f4a74c5d` | 2026-10-15 | apps/mobile             | 106     | refactor(mobile): organize design system and shared components (#20043)                                        | SKIP (Jake 2026-10-18: no mobile release) |
| `9d26a7986c` | 2026-10-15 | apps/desktop            | 2       | chore(release): prepare v0.1.0                                                                                 |                                           |
| `4d01315273` | 2026-10-15 | apps/server             | 0       | test(server): decouple compatibility fixtures from release version (#20068)                                    |                                           |
| `2d743c2f16` | 2026-10-15 | .github                 | 0       | ci: skip jobs a pull request cannot affect (#19587)                                                            |                                           |
| `93176616f4` | 2026-10-15 | .github                 | 0       | ci: cache Chromium for server test shards (#19632)                                                             |                                           |
| `3697644915` | 2026-10-15 | .github                 | 0       | ci: run typecheck inside the Build job (#19633)                                                                |                                           |
| `f6ad94d05c` | 2026-10-15 | .github                 | 0       | ci: cache pnpm packages on Blacksmith sticky disks (#19634)                                                    |                                           |
| `2f0a4eb263` | 2026-10-15 | apps/mobile             | 2       | fix(mobile): separate TestFlight and store release versions (#20060)                                           | SKIP (Jake 2026-10-18: no mobile release) |
| `f459165344` | 2026-10-15 | patches                 | 2       | chore(deps): update Expo and Clerk SDKs (#20067)                                                               |                                           |
| `83d6583300` | 2026-10-15 | .github                 | 5       | fix(mobile): make test builds optional and preserve APK releases (#20092)                                      |                                           |
| `e74f477eed` | 2026-10-15 | apps/mobile             | 1       | fix(mobile): worktree setup clock pauses on hidden thread screens (#20066)                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `dcdb0348e4` | 2026-10-16 | apps/mobile             | 0       | fix(mobile): a table right under a line of text renders as a table (#20120)                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `9b150f791b` | 2026-10-15 | .github                 | 0       | Add new GitHub user 'bompus' to VOUCHED.td                                                                     |                                           |
| `ba3582222f` | 2026-10-15 | apps/mobile             | 0       | fix(mobile): extend iPad sidebar background behind header (#20149)                                             | SKIP (Jake 2026-10-18: no mobile release) |
| `09c5e7ac01` | 2026-10-15 | apps/mobile             | 0       | style(mobile): flatten segmented control surfaces (#20163)                                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `d35882eac9` | 2026-10-15 | apps/mobile             | 0       | fix(ios): show a sidebar toggle on the unfolded iPhone Duo in portrait (#20133)                                | SKIP (Jake 2026-10-18: no mobile release) |
| `e58a485713` | 2026-10-16 | apps/mobile             | 0       | feat(mobile): use themed native iOS segmented controls (#20327)                                                | SKIP (Jake 2026-10-18: no mobile release) |
| `a3e8cf69de` | 2026-10-16 | patches                 | 1       | chore(deps): update Clerk SDKs and reconcile native patch (#20359)                                             |                                           |
| `543af770b4` | 2026-10-16 | apps/mobile             | 1       | fix(android): keep the split view and menus off the fold crease (#19988)                                       | SKIP (Jake 2026-10-18: no mobile release) |
| `86ac54512a` | 2026-10-16 | apps/mobile             | 0       | fix(android): fold tracking starts late and hinge retargets keep the edge (#20403)                             | SKIP (Jake 2026-10-18: no mobile release) |
| `55a823413b` | 2026-10-16 | .github                 | 0       | Add mweinbach to the VOUCHED team                                                                              |                                           |
| `89ce030d05` | 2026-10-16 | apps/mobile             | 5       | refactor(mobile): add a device type flag for iPad and iPhone Duo UI (#20399)                                   | SKIP (Jake 2026-10-18: no mobile release) |
| `f8ec357f96` | 2026-10-16 | apps/mobile             | 2       | fix(mobile): sidebar toggle works on iPad and iPhone Duo (#20406)                                              | SKIP (Jake 2026-10-18: no mobile release) |
| `19108aa7b4` | 2026-10-16 | apps/server             | 8       | feat(auth): pairing grants access and T3 Connect management by default (#20432)                                |                                           |
| `79ad856b4e` | 2026-10-16 | apps/mobile             | 0       | fix(mobile): align iOS segmented controls with action colors (#20721)                                          | SKIP (Jake 2026-10-18: no mobile release) |
| `e08b38a9f8` | 2026-10-16 | apps/web                | 1       | perf(web): the T3 Connect account pages hook compiles without manual memoization (#20611)                      |                                           |
| `22585fd9ff` | 2026-10-16 | apps/web                | 0       | perf(web): the managed relay hooks compile without manual memoization (#20552)                                 |                                           |
| `e2e9b4d3b7` | 2026-10-16 | apps/mobile             | 1       | fix(mobile): dev pairing link no longer opens Home inside a sheet (#20130)                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `23a5c774ee` | 2026-10-17 | apps/mobile             | 0       | fix(android): menu icons take taps (#20802)                                                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `b987b5785f` | 2026-10-17 | apps/mobile             | 1       | fix(android): a composer focused through an app switch stays above the keyboard (#20803)                       | SKIP (Jake 2026-10-18: no mobile release) |
| `25159b67e3` | 2026-10-17 | .github                 | 0       | fix(release): release tests install Chromium for the web browser tests (#20934)                                |                                           |
| `c3a65564f5` | 2026-10-17 | apps/mobile             | 2       | perf(mobile): usage screens compile with the React Compiler (#20969)                                           | SKIP (Jake 2026-10-18: no mobile release) |
| `fe77d643ef` | 2026-10-17 | apps/mobile             | 1       | perf(mobile): Connect onboarding compiles with the React Compiler (#20970)                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `3a4d118a51` | 2026-10-17 | apps/mobile             | 0       | perf(mobile): device preview compiles with the React Compiler (#20971)                                         | SKIP (Jake 2026-10-18: no mobile release) |
| `6a6ebb278d` | 2026-10-17 | apps/mobile             | 5       | fix(android): foldable sidebar and layout fixes (#21071)                                                       | SKIP (Jake 2026-10-18: no mobile release) |
| `2131698181` | 2026-10-18 | apps/mobile             | 0       | feat(mobile): pull request menu can copy or share the link (#21250)                                            | SKIP (Jake 2026-10-18: no mobile release) |
| `a356999dbf` | 2026-10-19 | apps/mobile             | 0       | fix(mobile): Browser address bar stays on one line on iOS (#19042)                                             | SKIP (Jake 2026-10-18: no mobile release) |
| `7a07553418` | 2026-10-19 | apps/mobile             | 1       | fix(mobile): keep queued-edit context in its draft (#18834)                                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `2b16747a92` | 2026-10-18 | apps/mobile             | 1       | fix(mobile): usage chart legend wraps instead of pushing the end date off-screen (#18203)                      | SKIP (Jake 2026-10-18: no mobile release) |
| `6b7766143d` | 2026-10-18 | apps/server             | 1       | fix(server): T3 Connect retries a link rejected for an expired proof (#18621)                                  |                                           |
| `cc869a97af` | 2026-10-18 | apps/mobile             | 1       | fix(mobile): fresh Android builds no longer crash on launch (#20118)                                           | SKIP (Jake 2026-10-18: no mobile release) |
| `b9a31ac6fa` | 2026-10-19 | apps/mobile             | 0       | fix(mobile): image viewer no longer flashes the chat between swipes on Android (#20898)                        | SKIP (Jake 2026-10-18: no mobile release) |
| `6976b51056` | 2026-10-19 | apps/mobile             | 1       | fix(mobile): reopening the app no longer shows a "No terminal output" alert (#20262)                           | SKIP (Jake 2026-10-18: no mobile release) |
| `e76d648f96` | 2026-10-18 | apps/mobile             | 0       | fix(mobile): account badges no longer clip wide initials like WO (#15908)                                      | SKIP (Jake 2026-10-18: no mobile release) |
| `cffcb76986` | 2026-10-19 | infra/relay             | 0       | fix(relay): stop held webhook deliveries when the inbox is cleared (#18838)                                    |                                           |
| `216c480171` | 2026-10-19 | apps/mobile             | 0       | fix(mobile): serialize initial device identity creation (#18837)                                               | SKIP (Jake 2026-10-18: no mobile release) |
| `992022b9c2` | 2026-10-19 | infra/relay             | 1       | fix(relay): reopening the app ends a finished iOS Live Activity (#20265)                                       |                                           |
| `a086be029c` | 2026-10-19 | apps/mobile             | 2       | fix(mobile): long commands no longer freeze Android work-log taps (#19238)                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `9827765212` | 2026-10-18 | apps/mobile             | 0       | fix(mobile): show complete unwrapped diff lines containing tabs (#14605)                                       | SKIP (Jake 2026-10-18: no mobile release) |
| `44a5883ed6` | 2026-10-19 | apps/mobile             | 0       | fix(mobile): a failed draft save no longer blocks sending an uploaded attachment (#21101)                      | SKIP (Jake 2026-10-18: no mobile release) |
| `f24e800651` | 2026-10-19 | apps/mobile             | 1       | fix(mobile): Live Activities keep updating after iOS rotates their push token (#21134)                         | SKIP (Jake 2026-10-18: no mobile release) |
| `fc86c68bdf` | 2026-10-18 | apps/mobile             | 1       | fix(mobile): keep composer within folded screen without leaving the thread (#18574)                            | SKIP (Jake 2026-10-18: no mobile release) |
| `f5e505a431` | 2026-10-18 | apps/mobile             | 0       | fix(mobile): Android PR filter chips no longer crowd the sheet corner (#20889)                                 | SKIP (Jake 2026-10-18: no mobile release) |
| `56871c9c26` | 2026-10-19 | apps/mobile             | 0       | fix(mobile): Chinese input no longer breaks before a skill pill on iOS (#17614)                                | SKIP (Jake 2026-10-18: no mobile release) |
| `3ea9c43e05` | 2026-10-18 | apps/mobile             | 1       | fix(mobile): resize quota bars when filtering environments (#19031)                                            | SKIP (Jake 2026-10-18: no mobile release) |
| `cfb78cf433` | 2026-10-18 | apps/server             | 1       | fix(server): warn when connect unlink leaves the relay record (#17743)                                         |                                           |
| `8da749b8d5` | 2026-10-18 | apps/mobile             | 0       | fix(mobile): sheet action buttons text alignment (#11260)                                                      | SKIP (Jake 2026-10-18: no mobile release) |
| `5432ce0df9` | 2026-10-19 | apps/mobile             | 0       | fix(mobile): preserve line counts for withheld pull request hunks (#18836)                                     | SKIP (Jake 2026-10-18: no mobile release) |
| `95c99a5e75` | 2026-10-19 | apps/mobile             | 3       | fix(mobile): preserve server matches in file search (#18388)                                                   | SKIP (Jake 2026-10-18: no mobile release) |
| `97986f7ec5` | 2026-10-18 | apps/mobile             | 2       | fix(mobile): prevent environment row taps from swallowing switches (#17677)                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `0395bf93e2` | 2026-10-18 | packages/shared         | 2       | fix(relay): resolve cloudflared using the hydrated PATH (#19444)                                               |                                           |
| `1a9572a4d8` | 2026-10-18 | apps/mobile             | 2       | fix(mobile): branch naming text saves when you leave the screen (#18381)                                       | SKIP (Jake 2026-10-18: no mobile release) |
| `cbe43566f4` | 2026-10-19 | apps/mobile             | 1       | fix(mobile): show assistant quotes as text in the queue sheet (#19007)                                         | SKIP (Jake 2026-10-18: no mobile release) |
| `b2877c4ad8` | 2026-10-18 | apps/mobile             | 0       | fix(mobile): keep PR activity in place during pull-to-refresh (#20196)                                         | SKIP (Jake 2026-10-18: no mobile release) |
| `2dd91140a9` | 2026-10-19 | apps/mobile             | 1       | fix(mobile): Android sheets scroll to the end and keep their buttons on screen (#20284)                        | SKIP (Jake 2026-10-18: no mobile release) |
| `c289e8012f` | 2026-10-19 | apps/mobile             | 1       | fix(mobile): the status pill label no longer flickers when it is truncated (#20724)                            | SKIP (Jake 2026-10-18: no mobile release) |
| `c15a793282` | 2026-10-18 | apps/mobile             | 0       | fix(mobile): remove orphaned temp files after atomic write failures (#20736)                                   | SKIP (Jake 2026-10-18: no mobile release) |
| `d015325b76` | 2026-10-18 | apps/mobile             | 4       | fix(mobile): avoid nested dropdowns for single tools (#15674)                                                  | SKIP (Jake 2026-10-18: no mobile release) |
| `f6144ccb06` | 2026-10-18 | apps/mobile             | 0       | fix(mobile): keep chat images visible when opening the viewer (#20188)                                         | SKIP (Jake 2026-10-18: no mobile release) |
| `ffa343bb81` | 2026-10-18 | apps/mobile             | 0       | fix(mobile): iOS builds on Xcode 27.0 no longer fail on 27.1-only hinge APIs (#18913)                          | SKIP (Jake 2026-10-18: no mobile release) |
| `f7dd1a392f` | 2026-10-18 | apps/mobile             | 0       | test(mobile): branch naming and server controls settings tests load again (#21293)                             | SKIP (Jake 2026-10-18: no mobile release) |
| `eb7b35ac32` | 2026-10-18 | apps/mobile             | 1       | test(mobile): a completed render splits the work log into lone-call rows (#21295)                              | SKIP (Jake 2026-10-18: no mobile release) |
| `93fbedb50c` | 2026-10-18 | apps/mobile             | 6       | perf(mobile): settings screens compile with the React Compiler (#21119)                                        | SKIP (Jake 2026-10-18: no mobile release) |
| `0ee07e32ab` | 2026-10-18 | apps/mobile             | 6       | perf(mobile): files, review and remaining settings screens compile with the React Compiler (#21124)            | SKIP (Jake 2026-10-18: no mobile release) |
| `671719b25c` | 2026-10-18 | apps/mobile             | 3       | perf(mobile): home, workspace layout and overlay pieces compile with the React Compiler (#21133)               | SKIP (Jake 2026-10-18: no mobile release) |
| `001111c360` | 2026-10-18 | apps/mobile             | 0       | perf(mobile): pull request screens compile with the React Compiler (#21136)                                    | SKIP (Jake 2026-10-18: no mobile release) |
| `f733638fff` | 2026-10-18 | apps/mobile             | 7       | perf(mobile): composer, connections, add project and shared state compile with the React Compiler (#21137)     | SKIP (Jake 2026-10-18: no mobile release) |
| `8528d64109` | 2026-10-18 | apps/mobile             | 9       | perf(mobile): new task flow, git sheets, thread settings and work log compile with the React Compiler (#21141) | SKIP (Jake 2026-10-18: no mobile release) |
| `cf84fc7772` | 2026-10-18 | apps/mobile             | 4       | perf(mobile): thread composer, route screen and queue control compile with the React Compiler (#21142)         | SKIP (Jake 2026-10-18: no mobile release) |
| `ad0a7d8667` | 2026-10-18 | apps/mobile             | 2       | perf(mobile): thread detail screen and navigation sidebar compile with the React Compiler (#21145)             | SKIP (Jake 2026-10-18: no mobile release) |
| `685c4137f1` | 2026-10-18 | apps/mobile             | 2       | perf(mobile): thread rows no longer re-render the list when another thread streams (#21255)                    | SKIP (Jake 2026-10-18: no mobile release) |
| `d30899cb50` | 2026-10-18 | apps/mobile             | 5       | perf(mobile): composer draft no longer re-renders the thread screen when typing (#21261)                       | SKIP (Jake 2026-10-18: no mobile release) |
| `d8e9fd267e` | 2026-10-18 | apps/mobile             | 1       | perf(mobile): ThreadFeed compiles with the React Compiler (#21268)                                             | SKIP (Jake 2026-10-18: no mobile release) |
| `e704190e8c` | 2026-10-18 | apps/web                | 2       | fix(devices): Android fold controls work over T3 Connect (#21156)                                              |                                           |

## TAKE

| Commit       | Date       | Area                                 | Overlap | Subject                                                                                                | Decision |
| ------------ | ---------- | ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------ | -------- |
| `f23d0084b6` | 2026-10-11 | packages/source-control-github       | 0       | perf(github): resolve credentials once per GraphQL request (#18289)                                    |          |
| `4946602784` | 2026-10-11 | apps/server                          | 0       | fix(server): refresh linked PRs without a checkout (#17167)                                            |          |
| `ac2cc78d4a` | 2026-10-11 | apps/server                          | 0       | fix(client): tolerate blocked cookies in MCP app sandboxes (#17027)                                    |          |
| `5cbe82a870` | 2026-10-11 | packages/client-runtime              | 0       | fix(devices): refresh backlogged iOS video and require input admission (#18326)                        |          |
| `cafe620e01` | 2026-10-11 | apps/web                             | 0       | fix(desktop): tooltips no longer open under the Windows and Linux window controls (#17672)             |          |
| `662148dd29` | 2026-10-11 | apps/web                             | 0       | fix(desktop): tooltips no longer open under the macOS traffic lights (#17726)                          |          |
| `9e8c7206c8` | 2026-10-11 | apps/web                             | 0       | fix(web): terminal selection drags scroll at the window edge (#17653)                                  |          |
| `ca728ec4b3` | 2026-10-11 | apps/web                             | 0       | fix(web): composer keeps its border while resting and expanding (#18333)                               |          |
| `6ec6376e32` | 2026-10-11 | apps/mobile                          | 0       | docs(mobile): point fork links to pingdotgg (#18433)                                                   |          |
| `7ab28a3b2e` | 2026-10-12 | apps/web                             | 0       | perf(web): reuse the collator when sorting diff files (#18420)                                         |          |
| `8569ce962a` | 2026-10-12 | packages/shared                      | 0       | perf(web): avoid quadratic markdown link scans (#18387)                                                |          |
| `499a53c307` | 2026-10-12 | apps/server                          | 0       | perf(server): expired PR diffs no longer stay in memory until restart (#17786)                         |          |
| `f570294df8` | 2026-10-12 | apps/web                             | 0       | fix(web): closed popovers no longer stay on screen and click-through (#18341)                          |          |
| `0fd7d2d7d7` | 2026-10-12 | apps/web                             | 0       | fix(web): long commands no longer overflow the Add Action dialog (#18207)                              |          |
| `63eaa79242` | 2026-10-12 | apps/web                             | 0       | fix(web): context menus no longer scroll when they fit the window (#16776)                             |          |
| `f79f37a637` | 2026-10-12 | packages/provider-acp                | 0       | fix(server): missing agent binaries report launch failure                                              |          |
| `b3871d5156` | 2026-10-12 | packages/source-control-forgejo      | 0       | fix(server): Forgejo pull requests report their head commit (#18463)                                   |          |
| `a27cf8af51` | 2026-10-12 | packages/provider-acp                | 0       | test(provider-acp): terminal kill test passes on Windows hosts (#18450)                                |          |
| `a3c4e9e936` | 2026-10-12 | packages/source-control-gitlab       | 0       | fix(gitlab): merge request details report their head commit (#18608)                                   |          |
| `017955206a` | 2026-10-12 | apps/web                             | 0       | fix(web): keep button text stable during press scaling (#18866)                                        |          |
| `8110edfddd` | 2026-10-13 | packages/source-control-bitbucket    | 0       | fix(bitbucket): preserve PR head commits for review guides (#18402)                                    |          |
| `6abccc1f5e` | 2026-10-13 | apps/web                             | 0       | fix(web): update everything includes npm-installed servers again (#18709)                              |          |
| `bbd98a5f87` | 2026-10-13 | apps/server                          | 0       | fix(server): review guides find Bitbucket heads reported by short hash (#18900)                        |          |
| `6524a8d437` | 2026-10-13 | .coderabbit.config.ts                | 0       | fix(ci): CodeRabbit reviews no longer request changes (#18954)                                         |          |
| `9a9fd2e3ed` | 2026-10-13 | apps/server                          | 0       | fix(pi): queue turn-start prompts when native work is running (#18639)                                 |          |
| `aef0e9ca40` | 2026-10-14 | packages/contracts                   | 0       | fix(git): preserve whitespace in file paths (#12464) (#12465)                                          |          |
| `109aaae6cd` | 2026-10-14 | packages/client-runtime              | 0       | fix(client): "Subagent needs input" no longer sticks after the subagent finishes (#18996)              |          |
| `5e5c52b7a7` | 2026-10-14 | packages/source-control-core         | 0       | fix(source-control): keep distinct CI checks with overlapping names (#19162)                           |          |
| `5e5abc92f4` | 2026-10-14 | apps/server                          | 0       | fix(server): avoid excessive backtracking in webhook templates (#19160)                                |          |
| `6002c5c68c` | 2026-10-14 | apps/server                          | 0       | fix(server): usage hubs with a host-less URL no longer vanish from Limits (#11368)                     |          |
| `3bbfdc7755` | 2026-10-14 | CONTRIBUTING.md                      | 0       | docs: close PRs written by Gemini or Muse Wonder (#19286)                                              |          |
| `bac35a2ffc` | 2026-10-14 | apps/server                          | 0       | perf(server): avoid quadratic resource history replay (#18825)                                         |          |
| `94ca023bf4` | 2026-10-14 | apps/server                          | 0       | fix(server): repair ownership UUID generation (#19298)                                                 |          |
| `4f909be2c1` | 2026-10-14 | apps/web                             | 0       | fix(web): settings save again after a stored value fails decode (#19312)                               |          |
| `19a67ef521` | 2026-10-14 | apps/server                          | 0       | fix(acp): custom models now reach the agent instead of failing to open (#19313)                        |          |
| `7ee2839cb5` | 2026-10-14 | apps/desktop                         | 0       | fix: Claude and Codex no longer time out behind mise wrappers (#19340)                                 |          |
| `06a84de3bd` | 2026-10-14 | apps/server                          | 0       | perf(server): turns no longer re-read merged PRs from GitHub (#19344)                                  |          |
| `40d43a1967` | 2026-10-14 | packages/client-runtime              | 0       | fix(client-runtime): a new WSL backend no longer shows Limited permissions until reload (#19361)       |          |
| `6c14293418` | 2026-10-14 | packages/source-control-github       | 0       | fix(github): requested teams now show in pull request reviewers (#19375)                               |          |
| `b037b9a535` | 2026-10-14 | apps/server                          | 0       | fix(server): open in editor works over Tailscale SSH without a local sshd (#19402)                     |          |
| `df8df0d53b` | 2026-10-14 | apps/server                          | 0       | fix(server): bound Bitbucket API requests with 30s timeout (#14140)                                    |          |
| `8414d16819` | 2026-10-14 | apps/server                          | 0       | perf(server): thread search runs on the SQLite reader worker (#19382)                                  |          |
| `ce6f8ce36e` | 2026-10-14 | apps/web                             | 0       | fix(pr): keep known state in sync across controls (#18408)                                             |          |
| `aa81d1203e` | 2026-10-14 | apps/desktop                         | 0       | fix(desktop): import CA trust variables from the login shell (#19604)                                  |          |
| `78f4b69a1f` | 2026-10-14 | apps/server                          | 0       | fix(server): preview copy only forwards text from the viewer's copy keys (#19561)                      |          |
| `742c229957` | 2026-10-15 | packages/source-control-github       | 0       | fix(server): GitHub App tokens can merge and use other write actions (#19103)                          |          |
| `ec1313c8f8` | 2026-10-15 | packages/source-control-bitbucket    | 0       | fix(server): use workspace-scoped Bitbucket permissions API (#10984)                                   |          |
| `755accf590` | 2026-10-15 | apps/web                             | 0       | test(web): remove duplicate change request parser tests (#13591)                                       |          |
| `cde9caecbd` | 2026-10-15 | apps/server                          | 0       | perf(server): replace Windows PowerShell port polling with netstat (#18524)                            |          |
| `76cb251da1` | 2026-10-15 | packages/provider-acp-registry       | 0       | fix(providers): fall back to windows-x86_64 ACP binaries on Windows on ARM (#18521)                    |          |
| `97f717a23a` | 2026-10-15 | apps/server                          | 0       | fix(server): Stop re-probing hosting CLIs for unrecognized hosts (#19692)                              |          |
| `4036e18597` | 2026-10-15 | apps/web                             | 0       | fix(web): keep wrapped split diffs from jumping while scrolling (#20022)                               |          |
| `559c4b1f21` | 2026-10-15 | apps/server                          | 0       | fix(acp): one malformed session update no longer ends the session (#20015)                             |          |
| `d8798dd7e9` | 2026-10-15 | apps/desktop                         | 0       | fix(shell): normalize Windows PATH keys in copied environments (#19965)                                |          |
| `6c84239d6d` | 2026-10-15 | packages/client-runtime              | 0       | fix(client-runtime): hide pending context handoff on threads with no sent message (#20033)             |          |
| `727b4e745c` | 2026-10-15 | .github                              | 0       | ci: cut per-job setup time (#20044)                                                                    |          |
| `bb4e4e7eca` | 2026-10-15 | apps/desktop                         | 0       | fix(desktop): agent typing in a preview tab no longer lands in the app (#18556)                        |          |
| `f1e0a4d4d0` | 2026-10-15 | apps/server                          | 0       | test(server): promoting a queued message into a running Claude turn succeeds (#20065)                  |          |
| `8039452979` | 2026-10-16 | apps/web                             | 0       | rc/01 tooltips (#20448)                                                                                |          |
| `696e0e4314` | 2026-10-16 | apps/web                             | 0       | perf(web): asset URL hooks compile with the React Compiler (#20452)                                    |          |
| `e9712d261e` | 2026-10-16 | apps/web                             | 0       | perf(web): toggle groups compile with the React Compiler (#20453)                                      |          |
| `a17781f638` | 2026-10-16 | apps/web                             | 0       | perf(web): panel presence keeps its retained value in state (#20459)                                   |          |
| `6293119f83` | 2026-10-16 | apps/web                             | 0       | perf(web): useCopyToClipboard reads its options through useStableCallback (#20460)                     |          |
| `de89a7a76d` | 2026-10-16 | apps/web                             | 0       | perf(web): useLiveRefresh reads its callback through useEffectEvent (#20464)                           |          |
| `635396ca3c` | 2026-10-16 | apps/web                             | 0       | perf(web): browser viewport resize checks its source through a stable callback (#20465)                |          |
| `70c73d96e0` | 2026-10-16 | apps/web                             | 0       | perf(web): useLocalStorage compiles with the React Compiler (#20472)                                   |          |
| `5cc75e8cb5` | 2026-10-16 | apps/web                             | 0       | perf(web): the provider updates action compiles with the React Compiler (#20485)                       |          |
| `5c43d16ec7` | 2026-10-16 | apps/web                             | 0       | perf(web): source control host settings compile with the React Compiler (#20498)                       |          |
| `f0474d37d7` | 2026-10-16 | apps/web                             | 0       | perf(web): resize handles compile with the React Compiler (#20524)                                     |          |
| `404c261e8a` | 2026-10-16 | apps/web                             | 0       | perf(web): the theme color picker compiles with the React Compiler (#20525)                            |          |
| `3cb13308eb` | 2026-10-16 | packages/client-runtime              | 0       | perf(client): a repository identity refresh keeps unchanged projects identical (#20730)                |          |
| `a7025639c0` | 2026-10-16 | apps/web                             | 0       | perf(web): the new-thread handler keeps its identity across provider pushes (#20731)                   |          |
| `d2213c8be5` | 2026-10-16 | apps/web                             | 0       | perf(web): the pull request guide tab compiles without manual memoization (#20716)                     |          |
| `7c74a35ea6` | 2026-10-16 | apps/web                             | 0       | perf(web): the shell command block compiles without manual memoization (#20714)                        |          |
| `b84a591f70` | 2026-10-16 | apps/web                             | 0       | perf(web): the hosted prompt link landing compiles without manual memoization (#20712)                 |          |
| `82a99f731e` | 2026-10-16 | apps/web                             | 0       | perf(web): the pull request state hooks compile without manual memoization (#20710)                    |          |
| `4e8b5eeb05` | 2026-10-16 | apps/web                             | 0       | perf(web): discovered local servers compile without manual memoization (#20708)                        |          |
| `19a760c3e3` | 2026-10-16 | apps/web                             | 0       | perf(web): file entry icons compile without manual memoization (#20703)                                |          |
| `07956d1ac5` | 2026-10-16 | apps/web                             | 0       | perf(web): the new thread hooks compile without manual memoization (#20699)                            |          |
| `26a7df089d` | 2026-10-16 | apps/web                             | 0       | perf(web): the file save coordinator compiles without manual memoization (#20697)                      |          |
| `b103346ba6` | 2026-10-16 | apps/web                             | 0       | perf(web): the combobox compiles without manual memoization (#20696)                                   |          |
| `c712852d96` | 2026-10-16 | apps/web                             | 0       | perf(web): update everything compiles without manual memoization (#20693)                              |          |
| `9e88a4f593` | 2026-10-16 | apps/web                             | 0       | perf(web): the sidebar update capsule compiles without manual memoization (#20687)                     |          |
| `3c6df713d3` | 2026-10-16 | apps/web                             | 0       | perf(web): the terminal session hooks compile without manual memoization (#20686)                      |          |
| `41edad837f` | 2026-10-16 | apps/web                             | 0       | perf(web): the file context menu hooks compile without manual memoization (#20683)                     |          |
| `66eee62db1` | 2026-10-16 | apps/web                             | 0       | perf(web): the port discovery hooks compile without manual memoization (#20636)                        |          |
| `dc060b1132` | 2026-10-16 | apps/web                             | 0       | perf(web): the new-thread link route compiles without manual memoization (#20597)                      |          |
| `26438213b5` | 2026-10-16 | apps/web                             | 0       | perf(web): the Electron browser host compiles with the React Compiler (#20548)                         |          |
| `de9756a4fc` | 2026-10-16 | apps/web                             | 0       | perf(web): the open panel pull request URL hook compiles without manual memoization (#20679)           |          |
| `cba00ae197` | 2026-10-16 | apps/web                             | 0       | perf(web): highlighted code tokens compile without manual memoization (#20678)                         |          |
| `c5310c2617` | 2026-10-16 | apps/web                             | 0       | perf(web): the HTML document frame compiles without manual memoization (#20676)                        |          |
| `d209e56e00` | 2026-10-16 | apps/web                             | 0       | perf(web): the sidebar project groups hook compiles without manual memoization (#20671)                |          |
| `9439b1a033` | 2026-10-16 | apps/web                             | 0       | perf(web): review file patches compile without manual memoization (#20670)                             |          |
| `3f5c16fa2b` | 2026-10-16 | apps/web                             | 0       | perf(web): settings project groups compile without manual memoization (#20668)                         |          |
| `e3a578f2d1` | 2026-10-16 | apps/web                             | 0       | perf(web): the environment hooks compile without manual memoization (#20665)                           |          |
| `15a8774dba` | 2026-10-16 | apps/web                             | 0       | perf(web): the code block language picker compiles without manual memoization (#20663)                 |          |
| `934398bc41` | 2026-10-16 | apps/web                             | 0       | perf(web): settings search availability compiles without manual memoization (#20661)                   |          |
| `99fac2687d` | 2026-10-16 | apps/web                             | 0       | perf(web): the code view file reveal hook compiles without manual memoization (#20659)                 |          |
| `35548e27e8` | 2026-10-16 | apps/web                             | 0       | perf(web): the command output panel compiles without manual memoization (#20658)                       |          |
| `65d352eb6d` | 2026-10-16 | apps/web                             | 0       | perf(web): the annotatable diff view compiles without manual memoization (#20657)                      |          |
| `4e8c01c1bc` | 2026-10-16 | apps/web                             | 0       | perf(web): the chat canvas compiles without manual memoization (#20654)                                |          |
| `d42681d06f` | 2026-10-16 | apps/web                             | 0       | perf(web): useResizableWidth compiles without manual memoization (#20653)                              |          |
| `c7fe6d37b3` | 2026-10-16 | apps/web                             | 0       | perf(web): device controls compile without manual memoization (#20652)                                 |          |
| `db2d0eb9f3` | 2026-10-16 | apps/web                             | 0       | perf(web): the provider update dismissal hook compiles without manual memoization (#20649)             |          |
| `472a62a6a8` | 2026-10-16 | apps/web                             | 0       | perf(web): the sidebar primitives compile with the React Compiler (#20648)                             |          |
| `0ed3ae8a2d` | 2026-10-16 | apps/web                             | 0       | perf(web): the remote open hook compiles without manual memoization (#20646)                           |          |
| `9578a59abd` | 2026-10-16 | apps/web                             | 0       | perf(web): usePreviewBridge compiles with the React Compiler (#20644)                                  |          |
| `f63f0261d1` | 2026-10-16 | apps/web                             | 0       | perf(web): useHtmlRenderTheme compiles without manual memoization (#20642)                             |          |
| `0fdbb37478` | 2026-10-16 | apps/web                             | 0       | perf(web): the theme editor host compiles without manual memoization (#20638)                          |          |
| `e6a126095f` | 2026-10-16 | apps/web                             | 0       | perf(web): the settings scope context compiles without manual memoization (#20635)                     |          |
| `452d032a2a` | 2026-10-16 | apps/web                             | 0       | perf(web): the project file scripts hook compiles without manual memoization (#20632)                  |          |
| `1b41060585` | 2026-10-16 | apps/web                             | 0       | perf(web): the diff file tree compiles with the React Compiler (#20631)                                |          |
| `e544a4a1f6` | 2026-10-16 | apps/web                             | 0       | perf(web): useMediaQuery compiles without manual memoization (#20629)                                  |          |
| `e36d0b2d1f` | 2026-10-16 | apps/web                             | 0       | perf(web): the archived threads hook compiles without manual memoization (#20624)                      |          |
| `a9c0bb6729` | 2026-10-16 | apps/web                             | 0       | perf(web): the pull request stack hook compiles without manual memoization (#20620)                    |          |
| `f241e7988d` | 2026-10-16 | apps/web                             | 0       | perf(web): the resource telemetry hook compiles without manual memoization (#20619)                    |          |
| `54d0900627` | 2026-10-16 | apps/web                             | 0       | perf(web): the device state hooks compile without manual memoization (#20613)                          |          |
| `97a9ca11d2` | 2026-10-16 | apps/web                             | 0       | perf(web): the session scope hooks compile without manual memoization (#20610)                         |          |
| `23d40e0a8c` | 2026-10-16 | apps/web                             | 0       | perf(web): the project icon picker compiles without manual memoization (#20607)                        |          |
| `41f56d96d8` | 2026-10-16 | apps/web                             | 0       | perf(web): the project scans hook compiles without manual memoization (#20606)                         |          |
| `2182353fdf` | 2026-10-16 | apps/web                             | 0       | perf(web): the local provider update groups compile without manual memoization (#20604)                |          |
| `ed16d9f241` | 2026-10-16 | apps/web                             | 0       | perf(web): thread find navigation compiles without manual memoization (#20603)                         |          |
| `4c22df263f` | 2026-10-16 | apps/web                             | 0       | perf(web): the composer path search hook compiles without manual memoization (#20595)                  |          |
| `855cd1650c` | 2026-10-16 | apps/web                             | 0       | perf(web): the font picker compiles with the React Compiler (#20594)                                   |          |
| `ed866ae148` | 2026-10-16 | apps/web                             | 0       | perf(web): useTurnDiffSummaries compiles without manual memoization (#20591)                           |          |
| `567bc559ac` | 2026-10-16 | apps/web                             | 0       | perf(web): useActiveThreadRef compiles without manual memoization (#20588)                             |          |
| `ede009e762` | 2026-10-16 | apps/web                             | 0       | perf(web): the diff worker pool provider compiles without manual memoization (#20584)                  |          |
| `9434bfd1d9` | 2026-10-16 | apps/web                             | 0       | perf(web): default theme adoption compiles with the React Compiler (#20574)                            |          |
| `745ca81b9d` | 2026-10-16 | apps/web                             | 0       | perf(web): useAtomQueryRunner compiles without manual memoization (#20573)                             |          |
| `242ec0ea2b` | 2026-10-16 | apps/web                             | 0       | perf(web): highlighted search lines compile without manual memoization (#20571)                        |          |
| `3ff9a73458` | 2026-10-16 | apps/web                             | 0       | perf(web): useAtomCommand compiles without manual memoization (#20568)                                 |          |
| `95e6d928a3` | 2026-10-16 | apps/web                             | 0       | perf(web): the composer state hooks compile without manual memoization (#20566)                        |          |
| `366106ac51` | 2026-10-16 | apps/web                             | 0       | perf(web): the escape-to-go-back hook compiles without manual memoization (#20564)                     |          |
| `63318a5d81` | 2026-10-16 | apps/web                             | 0       | perf(web): the guide tour compiles without manual memoization (#20563)                                 |          |
| `3603057fe4` | 2026-10-16 | apps/web                             | 0       | perf(web): the onboarding completion hook compiles without manual memoization (#20561)                 |          |
| `1e42057c97` | 2026-10-16 | apps/web                             | 0       | perf(web): the guide stop compiles without manual memoization (#20560)                                 |          |
| `74920122f6` | 2026-10-16 | apps/web                             | 0       | perf(web): the prompt link page compiles with the React Compiler (#20559)                              |          |
| `095fdac93f` | 2026-10-16 | apps/web                             | 0       | perf(web): the hosted browser webview compiles with the React Compiler (#20558)                        |          |
| `7e850a03c2` | 2026-10-16 | apps/web                             | 0       | perf(web): useStableCallback compiles without manual memoization (#20556)                              |          |
| `fea5380159` | 2026-10-16 | apps/web                             | 0       | perf(web): the find reveal ref compiles without manual memoization (#20555)                            |          |
| `687f1e9487` | 2026-10-16 | apps/web                             | 0       | perf(web): the zoomable image compiles without manual memoization (#20549)                             |          |
| `d94ea2c47f` | 2026-10-16 | apps/web                             | 0       | perf(web): the PR guide diff loader compiles with the React Compiler (#20543)                          |          |
| `b82d2e3bd5` | 2026-10-16 | apps/web                             | 0       | perf(web): the guide excerpt compiles without manual memoization (#20553)                              |          |
| `16e6a6ab50` | 2026-10-16 | apps/web                             | 0       | perf(web): AnimatedHeight compiles with the React Compiler (#20562)                                    |          |
| `4576827f41` | 2026-10-16 | apps/web                             | 0       | perf(web): the browser favicon store compiles without manual memoization (#20546)                      |          |
| `7a08cdf5f2` | 2026-10-16 | apps/web                             | 0       | perf(web): the browser surface slot compiles with the React Compiler (#20542)                          |          |
| `8fcdcfe208` | 2026-10-16 | apps/web                             | 0       | perf(web): the link opener hook compiles without manual memoization (#20541)                           |          |
| `02d48aec5c` | 2026-10-16 | apps/web                             | 0       | perf(web): the guide file diff compiles without manual memoization (#20544)                            |          |
| `8254505084` | 2026-10-16 | apps/web                             | 0       | perf(web): the provider update launch notification compiles with the React Compiler (#20577)           |          |
| `68ed8d35bf` | 2026-10-16 | apps/web                             | 0       | refactor(web): settings search items stay cached without "use memo" (#20771)                           |          |
| `341738b80a` | 2026-10-16 | apps/web                             | 0       | refactor(web): the pull request stack hook keeps its caching without "use memo" (#20741)               |          |
| `fc73c24ad3` | 2026-10-16 | apps/web                             | 0       | refactor(web): sidebar resize options stay cached without "use memo" (#20776)                          |          |
| `64b16d83a2` | 2026-10-16 | apps/web                             | 0       | refactor(web): the open panel pull request URL keeps its caching without "use memo" (#20768)           |          |
| `3b618903d6` | 2026-10-16 | apps/web                             | 0       | refactor(web): the command output panel keeps its caching without "use memo" hooks (#20763)            |          |
| `8dbfd927f9` | 2026-10-16 | apps/web                             | 0       | refactor(web): the preview bridge keeps its stable thread ref without "use memo" hooks (#20746)        |          |
| `a89a797f42` | 2026-10-16 | apps/web                             | 0       | refactor(web): highlighted tokens keep their caching without "use memo" hooks (#20760)                 |          |
| `af39520464` | 2026-10-16 | apps/web                             | 0       | refactor(web): the new-thread hook keeps its caching without "use memo" (#20769)                       |          |
| `73af712275` | 2026-10-16 | apps/web                             | 0       | refactor(web): review file patches keep their caching without "use memo" hooks (#20788)                |          |
| `efdaa4b353` | 2026-10-17 | apps/web                             | 0       | refactor(web): the guide excerpt keeps its caching without "use memo" (#20798)                         |          |
| `f03378f70a` | 2026-10-17 | apps/web                             | 0       | refactor(web): the hosted browser webview keeps its caching without "use memo" (#20824)                |          |
| `da0792efb1` | 2026-10-17 | apps/web                             | 0       | perf(web): toggling a client setting no longer re-renders every settings row (#20830)                  |          |
| `759f68fdf5` | 2026-10-17 | apps/web                             | 0       | test(web): jsdom-leftovers tests run in a real browser (#20862)                                        |          |
| `bc5f754baa` | 2026-10-17 | packages/client-runtime              | 0       | perf(client): a reconnect snapshot keeps unchanged skills and providers identical (#20855)             |          |
| `efef7cbb19` | 2026-10-17 | apps/web                             | 0       | test(web): the open-in picker test waits for the menu to close (#20892)                                |          |
| `07680cf7ce` | 2026-10-17 | apps/web                             | 0       | test(web): onboarding and usage tests run in a real browser (#20902)                                   |          |
| `96ff44e124` | 2026-10-17 | apps/web                             | 0       | test(web): the right panel Escape test waits for focus to return (#21030)                              |          |
| `c52453717a` | 2026-10-18 | apps/web                             | 0       | test(web): the right panel Escape test advances fake frames until focus returns (#21118)               |          |
| `d0918f1659` | 2026-10-18 | apps/web                             | 0       | test(web): ChatMarkdown thread find waits for highlights to settle (#21121)                            |          |
| `9ba614301c` | 2026-10-18 | apps/web                             | 0       | perf(web): switching threads no longer re-renders the chat view for an unchanged preview list (#21130) |          |
| `9c161462c9` | 2026-10-18 | packages/shared                      | 0       | perf(web): pull request chains parse each link's URL once (#21147)                                     |          |
| `d218d5b397` | 2026-10-18 | apps/server                          | 0       | fix(server): preserve repository display casing (#19202)                                               |          |
| `06ce02f194` | 2026-10-19 | apps/web                             | 0       | fix(web): maximized right panel no longer doubles the sidebar border (#18939)                          |          |
| `3b41d5f98e` | 2026-10-18 | apps/web                             | 0       | fix(web): full-screen visual replies keep a gap from the frame edge (#20281)                           |          |
| `8fffe6a29d` | 2026-10-18 | native                               | 0       | fix(desktop): remove oversized bars from Hyprland SnapShot animations (#10646)                         |          |
| `a35a2be2fe` | 2026-10-18 | apps/web                             | 0       | fix(web): name the web app manifest so Chrome offers to install it (#19175)                            |          |
| `0bdb5a8c64` | 2026-10-18 | apps/web                             | 0       | fix(web): show native caret and selection in file comments (#17554)                                    |          |
| `167f5eca94` | 2026-10-18 | packages/provider-cursor             | 0       | fix(provider-cursor): installed node_modules no longer exhaust skill discovery (#19806)                |          |
| `f100356710` | 2026-10-19 | packages/client-runtime              | 0       | fix(client): retain PR links while reconnect metadata changes (#17365)                                 |          |
| `04bd86951f` | 2026-10-19 | packages/provider-opencode           | 0       | fix(opencode): preserve native question selection flags (#20882)                                       |          |
| `473b4d717d` | 2026-10-18 | apps/desktop                         | 0       | fix(desktop): preview annotations no longer replace each other after a reload (#14360)                 |          |
| `70e3174b77` | 2026-10-18 | apps/server                          | 0       | fix(codex): Finder metadata no longer blocks shadow-home setup (#18991)                                |          |
| `bd395e9e65` | 2026-10-18 | apps/server                          | 0       | fix(server): html previews say how their browser exited (#16872)                                       |          |
| `bafadf324c` | 2026-10-18 | apps/server                          | 0       | fix(server): report spawn ENOTDIR as a spawn error instead of a defect (#14345)                        |          |
| `fb331610a8` | 2026-10-18 | apps/desktop                         | 0       | fix(desktop): accept existing Hyprland SnapShot shortcuts (#10658)                                     |          |
| `7c68c7dc87` | 2026-10-19 | apps/server                          | 0       | fix(server): browser control replies no longer wait behind old frames on slow links (#20290)           |          |
| `0aa4ee9509` | 2026-10-18 | apps/server                          | 0       | fix(server): reject unresolved explicit preview tabs (#19737)                                          |          |
| `8832d5c320` | 2026-10-19 | apps/desktop                         | 0       | fix(desktop): local network pairing links skip idle bridges and tunnels (#18085)                       |          |
| `cd6b8b7118` | 2026-10-18 | apps/server                          | 0       | fix(server): backend children no longer count as desktop resources (#19645)                            |          |
| `d7c711503f` | 2026-10-18 | packages/source-control-forgejo      | 0       | fix(source-control): fix forgejo check details links (#18434)                                          |          |
| `26c241144a` | 2026-10-19 | apps/web                             | 0       | fix(web): keep known preview tabs while the session list refreshes (#14955)                            |          |
| `51dcb43062` | 2026-10-18 | packages/shared                      | 0       | fix(shared): keep quoted Git file names intact (#19371)                                                |          |
| `f8665a1c21` | 2026-10-18 | apps/web                             | 0       | fix(web): a prompt link opened from a thread no longer lands in that thread (#19326)                   |          |
| `f3bb914efb` | 2026-10-18 | apps/server                          | 0       | perf(server): find in a long thread no longer re-parses every message on each keystroke (#20801)       |          |
| `e0de586a07` | 2026-10-18 | apps/server                          | 0       | fix(server): a repository on an unrecognized host no longer fails every PR status lookup (#19030)      |          |
| `19f3f6d9fb` | 2026-10-18 | apps/server                          | 0       | fix(server): stop grouping unrelated repos that only have a local git remote (#13129)                  |          |
| `3755b4970f` | 2026-10-19 | apps/server                          | 0       | perf(server): skip idle port discovery on Linux and macOS (#20975)                                     |          |
| `93d0e1a8e6` | 2026-10-18 | packages/shared                      | 0       | fix(shared): detect *.ghe.com remotes as GitHub (#19362)                                               |          |
| `fbe670c66a` | 2026-10-18 | packages/effect-acp                  | 0       | fix(acp): request ids stay within signed 32-bit so Kotlin agents answer (#15374)                       |          |
| `c3bfef820a` | 2026-10-18 | apps/server                          | 0       | fix(server): clear automatic PRs from other branches (#20223)                                          |          |
| `beadfe5627` | 2026-10-18 | packages/source-control-bitbucket    | 0       | fix(server): Bitbucket threads settle after their pull request merges (#19937)                         |          |
| `ca2afd8aea` | 2026-10-18 | apps/server                          | 0       | fix(server): threads no longer settle after merging PRs they were asked to merge (#18232)              |          |
| `bbf19f97d6` | 2026-10-19 | apps/web                             | 0       | fix(web): prevent provider wizard footer overlap while loading (#18609)                                |          |
| `7686c57311` | 2026-10-18 | apps/web                             | 0       | fix(web): refresh stale desktop endpoints when Connections reopens (#16026)                            |          |
| `b656dd7da4` | 2026-10-18 | packages/shared                      | 0       | fix(shared): preserve escaped quotes in launch arguments (#19525)                                      |          |
| `ddca636540` | 2026-10-18 | apps/web                             | 0       | fix(web): keep collapsed diff file headers reachable (#20333)                                          |          |
| `d3122f566a` | 2026-10-18 | apps/web                             | 0       | fix(web): center composer control labels with their icons (#21241)                                     |          |
| `cdb761d795` | 2026-10-19 | apps/server                          | 0       | fix(server): SSH device-host tunnels no longer inherit ControlMaster (#17440)                          |          |
| `73ed54901f` | 2026-10-18 | packages/provider-acp                | 0       | fix(provider-acp): stop claiming agents' own tools named like T3 tools (#20376)                        |          |
| `2df5dbe457` | 2026-10-19 | apps/web                             | 0       | fix(web): let keyboard users reach why reviewer/label changes are unavailable (#14785)                 |          |
| `69f4042aa8` | 2026-10-19 | apps/server                          | 0       | fix(grok): preserve native question multi-select (#20881)                                              |          |
| `a440198ebd` | 2026-10-19 | apps/web                             | 0       | fix(web): handle Backspace when Android omits the key code (#18063)                                    |          |
| `ddcde11be8` | 2026-10-18 | packages/client-runtime              | 0       | fix(client-runtime): queries stay pending while a connection hands off (#18155)                        |          |
| `d426166dfd` | 2026-10-18 | packages/source-control-gitlab       | 0       | fix(server): load merge request diffs on older GitLab (#15886)                                         |          |
| `48902dabe2` | 2026-10-18 | apps/server                          | 0       | fix(server): take a delegated task's result from its newest turn item (#19058)                         |          |
| `a4cd9216dd` | 2026-10-19 | apps/server                          | 0       | fix(server): logs print causes instead of [Object] (#16642)                                            |          |
| `d33aa7fd0d` | 2026-10-18 | apps/web                             | 0       | fix(web): keep font picker keyboard selection in sync (#9814)                                          |          |
| `adfdcb67b3` | 2026-10-18 | apps/web                             | 0       | fix(web): copied task lists keep their nested items and code blocks (#14778)                           |          |
| `1b5c2d1d30` | 2026-10-18 | apps/server                          | 0       | fix(server): t3 run from a T3 terminal no longer trips on the service's launcher context (#14263)      |          |
| `ac791b9f5c` | 2026-10-19 | apps/web                             | 0       | fix(web): standalone auth pages scroll when the card is taller than the window (#19603)                |          |
| `0ce4cbec47` | 2026-10-18 | apps/server                          | 0       | fix(preview): isolate tabs for threads sharing a provider session (#18146)                             |          |
| `bd93830550` | 2026-10-18 | packages/shared                      | 0       | fix(shared): choose duration unit after rounding seconds (#20299)                                      |          |
| `adaaae60c6` | 2026-10-18 | apps/server                          | 0       | fix(server): publishing explains why the first push failed (#19219)                                    |          |
| `7506aeddc6` | 2026-10-18 | apps/server                          | 0       | fix(server): the V1 transcript import no longer stalls on each thread's V1 events (#21050)             |          |
| `def17b215f` | 2026-10-19 | apps/server                          | 0       | fix(usage): a CLIProxyAPI hub served under a path keeps its path (#19336)                              |          |
| `d9eb2b61c3` | 2026-10-18 | apps/server                          | 0       | fix(server): agent-driven threads keep their recent rows when checkpoint data is large (#21187)        |          |
| `d4004c5e8d` | 2026-10-18 | apps/server                          | 0       | fix(server): forks no longer inherit pull request watches (#16623)                                     |          |
| `6ae212e6dc` | 2026-10-18 | packages/source-control-core         | 0       | fix(source-control): compare check run timestamps by instant (#20094)                                  |          |
| `52eba84734` | 2026-10-18 | packages/provider-cursor             | 0       | fix(provider-cursor): a symlinked skills root is no longer scanned twice (#18664)                      |          |
| `a82dbc2dec` | 2026-10-18 | apps/web                             | 0       | test(web): preview session sync and device tool update tests run in a real browser (#21274)            |          |
| `e918741825` | 2026-10-18 | apps/server                          | 0       | fix(browser): preserve native file pickers in desktop previews (#20994)                                |          |
| `4036f87581` | 2026-10-18 | apps/server                          | 0       | fix(server): a Limits hub failure names its TLS, HTTP, or timeout cause (#18168)                       |          |
| `74e5bd22a9` | 2026-10-18 | apps/server                          | 0       | fix(forgejo): wake PR watches for edited comments (#18120)                                             |          |
| `264815cda7` | 2026-10-19 | packages/source-control-azure-devops | 0       | fix(azure-devops): expose the latest source revision for review guides (#20977)                        |          |
| `4040146bbf` | 2026-10-18 | apps/desktop                         | 0       | fix(desktop): exclude unrelated VPN addresses from Tailscale pairing (#15753)                          |          |
| `4de78cd1e6` | 2026-10-18 | packages/source-control-forgejo      | 0       | fix(source-control): fix watch failures on large forgejo PRs (#18432)                                  |          |
| `b6ca834d60` | 2026-10-18 | apps/server                          | 0       | test(server): drop the duplicate Path import in the Grok adapter test (#21308)                         |          |
| `e57e6295cf` | 2026-10-18 | apps/server                          | 0       | test(server): a fork that stops its own PR watch keeps it as its ended watch (#21309)                  |          |
| `97efada6a9` | 2026-10-18 | apps/web                             | 0       | test(web): file browser and attachment image tests run in a real browser (#21297)                      |          |
| `8cd9641f76` | 2026-10-18 | apps/web                             | 0       | test(web): burst-merged jsdom tests run in a real browser (#21318)                                     |          |
| `b72740852f` | 2026-10-18 | apps/web                             | 0       | fix(web): keep the composer chin below the input (#21345)                                              |          |
| `952921f39a` | 2026-10-18 | packages/tailscale                   | 0       | fix(tailscale): a slow tailscale status no longer hides Tailscale in Settings (#21057)                 |          |

## Port candidates (provider, security, crash and data fixes)

Soft-fork policy (Jake 2026-10-18): cherry-pick one at a time, scoped test per port, log result in the last column.

| Class  | Commit       | Date       | Area                           | Overlap | Subject                                                                                                 | Result                                                                        |
| ------ | ------------ | ---------- | ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| TAKE   | `19a67ef521` | 2026-10-14 | apps/server                    | 0       | fix(acp): custom models now reach the agent instead of failing to open (#19313)                         | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `7ee2839cb5` | 2026-10-14 | apps/desktop                   | 0       | fix: Claude and Codex no longer time out behind mise wrappers (#19340)                                  | PORTED on upstream-review/2026-10-18 (test file adapted)                      |
| TAKE   | `742c229957` | 2026-10-15 | packages/source-control-github | 0       | fix(server): GitHub App tokens can merge and use other write actions (#19103)                           | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `76cb251da1` | 2026-10-15 | packages/provider-acp-registry | 0       | fix(providers): fall back to windows-x86_64 ACP binaries on Windows on ARM (#18521)                     | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `559c4b1f21` | 2026-10-15 | apps/server                    | 0       | fix(acp): one malformed session update no longer ends the session (#20015)                              | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `167f5eca94` | 2026-10-18 | packages/provider-cursor       | 0       | fix(provider-cursor): installed node_modules no longer exhaust skill discovery (#19806)                 | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `04bd86951f` | 2026-10-19 | packages/provider-opencode     | 0       | fix(opencode): preserve native question selection flags (#20882)                                        | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `70e3174b77` | 2026-10-18 | apps/server                    | 0       | fix(codex): Finder metadata no longer blocks shadow-home setup (#18991)                                 | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `fbe670c66a` | 2026-10-18 | packages/effect-acp            | 0       | fix(acp): request ids stay within signed 32-bit so Kotlin agents answer (#15374)                        | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `73ed54901f` | 2026-10-18 | packages/provider-acp          | 0       | fix(provider-acp): stop claiming agents' own tools named like T3 tools (#20376)                         | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `0ce4cbec47` | 2026-10-18 | apps/server                    | 0       | fix(preview): isolate tabs for threads sharing a provider session (#18146)                              | PORTED on upstream-review/2026-10-18                                          |
| TAKE   | `52eba84734` | 2026-10-18 | packages/provider-cursor       | 0       | fix(provider-cursor): a symlinked skills root is no longer scanned twice (#18664)                       | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `c09c235129` | 2026-10-11 | packages/provider-cursor       | 1       | fix(server): preserve ambient Cursor MCP servers (#15875)                                               | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `5753207d53` | 2026-10-12 | apps/desktop                   | 1       | fix(desktop): avoid Hyprland 0.48–0.50 Wayland color-manager startup crashes (#18566)                   | DROPPED (mobile or Linux Wayland, Jake 2026-10-18)                            |
| REVIEW | `511d20c6f2` | 2026-10-12 | packages/client-runtime        | 1       | fix(mobile): hide Claude Read image placeholders when previews exist (#18761)                           | DROPPED (mobile or Linux Wayland, Jake 2026-10-18)                            |
| REVIEW | `fb8d0fc19c` | 2026-10-13 | apps/server                    | 1       | fix(server): collect SQLite planner statistics when the database opens (#18471)                         | SKIPPED: ported then reverted, new test failures (needs a skipped dependency) |
| REVIEW | `3feae3a940` | 2026-10-13 | packages/provider-opencode     | 1       | fix(server): keep OpenCode timeouts from crashing the error formatter (#12469)                          | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `a74ce48f96` | 2026-10-13 | apps/server                    | 1       | fix(server): stop fsyncing SQLite on every commit so slow disks no longer drop clients (#19205)         | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `acb90279e2` | 2026-10-14 | packages/provider-cursor       | 1       | fix(provider-cursor): Cursor text generation no longer leaks SQLite file handles on every call (#19310) | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `c8a6768f07` | 2026-10-14 | packages/provider-opencode     | 1       | fix(server): HTML and Markdown attachments no longer fail OpenCode turns (#19319)                       | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `f372c0061f` | 2026-10-14 | apps/server                    | 1       | fix(server): stalled OAuth token requests no longer block credential calls (#19321)                     | SKIPPED: ported then reverted, new test failures (needs a skipped dependency) |
| REVIEW | `f37f99ca9e` | 2026-10-14 | packages/shared                | 1       | fix(shared): SQLite checkpoints no longer fall back to the main thread silently (#19417)                | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `2d94372376` | 2026-10-15 | packages/provider-cursor       | 1       | fix(server): Cursor threads in Auto use Cursor's Auto-review (#19712)                                   | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `364f5084d7` | 2026-10-15 | apps/server                    | 1       | fix(server): Windows Codex install uses system tar and retries rename (#18523)                          | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `2a7bd1673c` | 2026-10-15 | packages/provider-grok         | 1       | fix(provider-grok): Grok health checks no longer start Grok's updater (#18075)                          | SKIPPED: ported then reverted, new test failures (needs a skipped dependency) |
| REVIEW | `1d1a8e5b07` | 2026-10-18 | apps/server                    | 1       | fix(provider-acp): name the rejected agent path on stderr and test the bash path (#18489)               | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `0b896d9ff1` | 2026-10-18 | apps/server                    | 1       | fix(server): title imported Codex threads after the user request (#20278)                               | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `eb1db5ff80` | 2026-10-18 | packages/provider-muse         | 1       | fix(provider-muse): show readable model names in the picker (#19100)                                    | SKIPPED: ported then reverted, new test failures (needs a skipped dependency) |
| REVIEW | `4c52938fdb` | 2026-10-18 | apps/server                    | 1       | fix(antigravity): keep the runtime version learned from ACP (#20980)                                    | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `b058babb16` | 2026-10-18 | packages/provider-opencode     | 1       | fix(opencode): retry shared database locks during startup (#17922)                                      | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `c59ab7d92a` | 2026-10-18 | packages/provider-opencode     | 1       | fix(server): slow OpenCode wrappers no longer show as unavailable (#16544)                              | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `8678a80c2f` | 2026-10-18 | apps/server                    | 1       | fix(server): a disabled bootstrap provider no longer stops startup (#20035)                             | SKIPPED: ported then reverted, new test failures (needs a skipped dependency) |
| REVIEW | `ac77f4f8e4` | 2026-10-18 | packages/provider-cursor       | 1       | fix(server): failed Cursor turns show Cursor's reason (#16146)                                          | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `b6629dcd68` | 2026-10-18 | packages/shared                | 1       | fix(opencode): OpenCode servers stop with a killed server on Windows (#21103)                           | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `ed0f7b908b` | 2026-10-11 | apps/server                    | 2       | fix(server): Sol Ultrafast stops vanishing from the Codex model picker (#18200)                         | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `3f70c831c6` | 2026-10-11 | apps/server                    | 2       | fix(server): Claude 5.1+ text before a tool call shows as assistant text (#18364)                       | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `dc192851f0` | 2026-10-12 | apps/server                    | 2       | fix(server): Codex titles and branch names no longer start the user's MCP servers (#17058)              | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `06620faf6d` | 2026-10-13 | apps/server                    | 2       | fix(server): Claude thinking before a tool call stays a collapsed Thought (#18887)                      | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `8c027980eb` | 2026-10-13 | apps/server                    | 2       | fix(claude): default background text generation to haiku 5.5 (#18781)                                   | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `d765d03cb7` | 2026-10-14 | apps/server                    | 2       | fix(server): a Claude 403 no longer tells you to log in again (#15872)                                  | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `30d1010443` | 2026-10-14 | apps/server                    | 2       | fix(server): Claude subagent progress no longer re-stores the unchanged prompt (#18375)                 | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `614b432a79` | 2026-10-14 | apps/server                    | 2       | fix(server): make SQLite checkpoints durable on macOS (#19304)                                          | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `8d11fe1261` | 2026-10-14 | apps/server                    | 2       | fix(server): steered Claude turns no longer undercount token usage (#19314)                             | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `3213a0c77b` | 2026-10-14 | apps/server                    | 2       | fix(server): closing a Claude session no longer leaves plugin MCP servers running (#19322)              | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `bc95bbd790` | 2026-10-14 | apps/server                    | 2       | fix(server): changing Claude effort no longer fails while background agents run (#19341)                | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `7fd2ba7526` | 2026-10-14 | apps/server                    | 2       | fix(server): failed Claude text generation shows the CLI's own error (#19394)                           | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `0796638512` | 2026-10-14 | packages/shared                | 2       | fix(chat): Codex follow-up suggestions show their label instead of raw markup (#19401)                  | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `cae6c6627a` | 2026-10-14 | apps/server                    | 2       | fix(server): only Claude progress updates before a tool call show as text (#18923)                      | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `39aeaf404a` | 2026-10-14 | apps/server                    | 2       | fix(server): "Always allow this session" stops Codex asking for every command (#19635)                  | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `e77a48e81a` | 2026-10-15 | apps/server                    | 2       | fix(server): fail runs whose provider stream ends without a terminal (#19131)                           | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `1550058056` | 2026-10-15 | apps/server                    | 2       | fix(server): resumed Claude subagents keep updating their own thread (#20061)                           | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `cfafb4bb54` | 2026-10-16 | apps/server                    | 2       | fix(codex): a slow but healthy Codex no longer shows as Unavailable (#15945)                            | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `edc703b60a` | 2026-10-16 | apps/server                    | 2       | fix(server): a running Claude workflow member shows its answer so far (#20786)                          | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `91f8c35dee` | 2026-10-18 | apps/server                    | 2       | fix(server): Claude workflow members stream their thinking and tool calls into their threads (#20856)   | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `bd438fb315` | 2026-10-18 | apps/server                    | 2       | fix(acp): preserve native slash command prompt shape (#19393)                                           | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `499c9ee68b` | 2026-10-18 | apps/server                    | 2       | fix(server): a /compact stopped by the Claude usage limit now fails (#19583)                            | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `1ffa2cbb44` | 2026-10-18 | packages/provider-core         | 2       | fix(server): keep WinGet Claude installs manual-only instead of running claude update (#19517)          | SKIPPED: ported then reverted, new test failures (needs a skipped dependency) |
| REVIEW | `71aa1173b0` | 2026-10-18 | packages/provider-cursor       | 2       | fix(cursor): explain model rejections from the account catalog (#19678)                                 | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `ad2ac0f1ee` | 2026-10-18 | apps/server                    | 2       | fix(server): provider logs skip Claude thinking-token counters (#19789)                                 | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `6241d9d18a` | 2026-10-18 | apps/server                    | 2       | fix(server): discover Claude skills from add-dir launch args (#20167)                                   | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `265d68ab04` | 2026-10-18 | apps/server                    | 2       | fix(server): reverting a Claude thread to a subagent-only turn no longer breaks it (#21151)             | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `6d5060c2f0` | 2026-10-18 | packages/provider-core         | 2       | fix(provider-core): stop false updates for versionless casks (#20386)                                   | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `b497d129ef` | 2026-10-19 | apps/server                    | 2       | fix(server): disabled providers no longer report missing executables (#18109)                           | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `cef6f7ae5e` | 2026-10-18 | apps/server                    | 2       | fix(server): keep workspace skills when provider health fails (#18309)                                  | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `a523b0036e` | 2026-10-19 | packages/provider-core         | 2       | fix(provider-core): pnpm-global updates approve the provider's build (#20796)                           | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `ab89a5956b` | 2026-10-18 | apps/server                    | 2       | fix(provider-grok): report model windows for handoff budgets (#20180)                                   | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `a0b5df18bf` | 2026-10-18 | apps/server                    | 2       | fix(server): Claude wake runs no longer end empty while Claude is still answering (#15816)              | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `66cae3d756` | 2026-10-18 | apps/server                    | 2       | fix(server): read Claude context usage from stream message deltas (#19416)                              | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `e51c0d6777` | 2026-10-18 | apps/server                    | 2       | fix(server): a Claude hook that drops a prompt now shows its reason (#21231)                            | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `3adac9403f` | 2026-10-18 | apps/server                    | 2       | fix(server): ACP agents that need no sign-in drop models they stopped advertising (#18807)              | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `63e18dffc5` | 2026-10-18 | apps/server                    | 2       | fix(server): replace Claude sessions that never saved a message (#19637)                                | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `0ae495158e` | 2026-10-19 | apps/server                    | 2       | fix(server): Claude subagents keep their model after a usage-limit notice (#17097)                      | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `fb9af9e57d` | 2026-10-18 | apps/server                    | 2       | fix(server): a full Claude context window no longer shows as a usage limit (#19848)                     | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `e24ea1d28e` | 2026-10-13 | apps/server                    | 3       | fix(server): a migration id clash stops startup with a clear error instead of crash-looping (#15925)    | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `233e70b3b2` | 2026-10-14 | apps/server                    | 3       | fix(server): Claude no longer shows unavailable when its health check can't run in $HOME (#19320)       | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `3a6ab583d2` | 2026-10-14 | apps/server                    | 3       | fix(acp): Copilot's default agent no longer disappears from the Agent menu (#19330)                     | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `3ff452bd65` | 2026-10-15 | apps/server                    | 3       | fix(server): a dropped HTTP/2 connection no longer crashes the server (#18378)                          | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `76f57f9b84` | 2026-10-19 | apps/server                    | 3       | fix(server): preserve explicit effort for unknown Claude models (#20849)                                | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `e47bfe4617` | 2026-10-14 | apps/server                    | 4       | fix(server): Claude works next to an enterprise managed-mcp.json (#18706)                               | PORTED on upstream-review/2026-10-18                                          |
| REVIEW | `91adab7161` | 2026-10-18 | apps/server                    | 4       | fix(server): Codex threads get the whole T3 orchestration instructions (#18415)                         | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `6ba6a0daf4` | 2026-10-11 | packages/provider-muse         | 5       | fix(provider-muse): run on Muse 1.4.6, with linked web search hits and workflow results (#18409)        | SKIPPED: cherry-pick conflict, retry by hand later                            |
| REVIEW | `76ff0eb2a1` | 2026-10-19 | apps/server                    | 5       | fix(server): recover after Claude capability probe failures (#21042)                                    | SKIPPED: cherry-pick conflict, retry by hand later                            |
