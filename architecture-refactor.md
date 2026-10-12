# Architecture audit: Phase 0 and Phase 1

Measured 2026-10-12 against the current local checkout. The previously referenced report was absent; this records new measurements, not a reconstruction of its scorecard. This checkout diverges from origin/main.

## Scope and method

The AIOS graph excludes this checkout, so findings use direct source analysis. dpdm 4.3.0 was installed outside the repository. All server and web src TypeScript/TSX files, including tests, were scanned with their app tsconfig. Each scan follows reachable dependencies, including workspace packages. A second scan used TypeScript transformation (-T) to remove type-only edges. Reported circular paths are tool output, not an exhaustive enumeration of all simple cycles or proof of runtime failure.

A TypeScript AST scan inspected 5056 source files and 38501 literal import/export/require/dynamic-import requests across apps/*/src and packages/*/src. Resolution used each workspace tsconfig and a module-resolution cache. Computed imports, build scripts outside src, and bundler-only aliases are outside this measurement.

## Circular imports

| Entry scope | Source entries | With type imports | After transformation |
| --- | ---: | ---: | ---: |
| server | 1156 | 6 | 3 |
| web | 1579 | 37 | 3 |

### server: transformed cycle paths

- `apps/server/src/vcs/GitVcsDriver.ts` → `apps/server/src/vcs/GitVcsDriverCore.ts` → `apps/server/src/vcs/GitVcsDriver.ts`
- `apps/server/src/orchestration-v2/ProjectionStore.ts` → `apps/server/src/orchestration-v2/ThreadFind.ts` → `apps/server/src/orchestration-v2/ProjectionStore.ts`
- `apps/server/src/auth/EnvironmentAuth.ts` → `apps/server/src/auth/dpop.ts` → `apps/server/src/auth/EnvironmentAuth.ts`

Unresolved requests in this transformed graph: 0.

### server: all reported paths including types

- `packages/source-control-github/src/server/GitHubPullRequestApi.ts` → `packages/source-control-github/src/server/gitHubConditionalChecks.ts` → `packages/source-control-github/src/server/GitHubPullRequestApi.ts`
- `apps/server/src/vcs/GitVcsDriver.ts` → `apps/server/src/vcs/GitVcsDriverCore.ts` → `apps/server/src/vcs/GitVcsDriver.ts`
- `apps/server/src/orchestration-v2/ProjectionStore.ts` → `apps/server/src/orchestration-v2/ThreadFind.ts` → `apps/server/src/orchestration-v2/ProjectionStore.ts`
- `apps/server/src/pullRequest/PullRequestService.ts` → `apps/server/src/pullRequest/pullRequestViewedFiles.ts` → `apps/server/src/pullRequest/PullRequestService.ts`
- `packages/provider-acp-registry/src/server/probe.ts` → `packages/provider-acp-registry/src/server/AcpRegistrySupport.ts` → `packages/provider-acp-registry/src/server/AcpRegistryRuntimeCoordinator.ts` → `packages/provider-acp-registry/src/server/probe.ts`
- `apps/server/src/auth/EnvironmentAuth.ts` → `apps/server/src/auth/dpop.ts` → `apps/server/src/auth/EnvironmentAuth.ts`

### web: transformed cycle paths

- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/ui/menu.tsx` → `apps/web/src/lib/utils.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/components/usage/UsageLimits.tsx` → `apps/web/src/components/usage/UsageLimitsPooled.tsx` → `apps/web/src/components/usage/UsageLimits.tsx`

Unresolved requests in this transformed graph: 49.

- `apps/web/src/themeBoot.test.ts`: `../index.html?raw`
- `apps/web/src/splitLayoutStore.test.ts`: `vitest`
- `apps/web/src/splitLayout.test.ts`: `vitest`
- `apps/web/src/routes/__root.tsx`: `lucide`
- `apps/web/src/lib/snapShotSound.ts`: `../assets/snap-shot-click.mp3?url`
- `apps/web/src/lib/snapShotSound.ts`: `../assets/snap-shot-whoosh.mp3?url`
- `apps/web/src/components/RightPanelTabs.tsx`: `lucide`
- `apps/web/src/components/DiffWorkerPoolProvider.tsx`: `@pierre/diffs/worker/worker.js?worker`
- `apps/web/src/components/DiffPanel.tsx`: `lucide`
- `apps/web/src/components/DiffFilePathCopyButton.tsx`: `lucide`
- `apps/web/src/components/CommandBlock.tsx`: `lucide`
- `apps/web/src/components/ChatMarkdown.tsx`: `lucide`
- `apps/web/src/terminal/ghostty/surface.ts`: `./fonts/SymbolsNerdFontMono-Regular.woff2?url`
- `apps/web/src/terminal/ghostty/surface.test.ts`: `./vendor/ghostty-vt.wasm?inline`
- `apps/web/src/terminal/ghostty/surface.test.ts`: `./vendor/ghostty-write-pty.wasm?inline`
- `apps/web/src/terminal/ghostty/runtimeAbi.test.ts`: `./vendor/ghostty-vt.wasm?inline`
- `apps/web/src/terminal/ghostty/runtimeAbi.test.ts`: `./vendor/ghostty-write-pty.wasm?inline`
- `apps/web/src/terminal/ghostty/runtimeAbi.test.ts`: `../../../../../native/libghostty-vt/VERSION?raw`
- `apps/web/src/terminal/ghostty/runtime.ts`: `./vendor/ghostty-vt.wasm?url`
- `apps/web/src/terminal/ghostty/runtime.ts`: `./vendor/ghostty-write-pty.wasm?url&no-inline`
- `apps/web/src/terminal/ghostty/core.test.ts`: `./vendor/ghostty-vt.wasm?inline`
- `apps/web/src/terminal/ghostty/core.test.ts`: `./vendor/ghostty-write-pty.wasm?inline`
- `apps/web/src/components/ui/toast.tsx`: `lucide`
- `apps/web/src/components/ui/sidebar.tsx`: `lucide`
- `apps/web/src/components/settings/ThemeEditorPanel.tsx`: `lucide`
- `apps/web/src/components/settings/ResourceTelemetryDiagnostics.tsx`: `lucide`
- `apps/web/src/components/settings/ProviderInstanceCard.tsx`: `lucide`
- `apps/web/src/components/settings/DiagnosticsSettings.tsx`: `lucide`
- `apps/web/src/components/pullRequest/PullRequestReviewAnnotation.tsx`: `lucide`
- `apps/web/src/components/pullRequest/PullRequestCodeTab.tsx`: `lucide`
- `apps/web/src/components/files/FilePreviewPanel.tsx`: `lucide`
- `apps/web/src/components/files/FileBrowserPanel.tsx`: `lucide`
- `apps/web/src/components/files/AttachmentFilePreview.tsx`: `lucide`
- `apps/web/src/components/device/DeviceSetup.tsx`: `lucide`
- `apps/web/src/components/device/deviceModels.ts`: `./models/iphone-duo.glb?url`
- `apps/web/src/components/device/deviceModels.ts`: `./models/iphone-18-pro.glb?url`
- `apps/web/src/components/device/deviceModels.ts`: `./models/iphone-18-pro-max.glb?url`
- `apps/web/src/components/device/deviceModels.ts`: `./models/ipad-pro-13-m5-magic-keyboard.glb?url`
- `apps/web/src/components/device/deviceModels.ts`: `./models/ipad-pro-13-m5.glb?url`
- `apps/web/src/components/device/DeviceControlsRail.tsx`: `lucide`
- `apps/web/src/components/diffs/DiffFileTree.tsx`: `lucide`
- `apps/web/src/components/chat/WorktreeSetupCard.tsx`: `lucide`
- `apps/web/src/components/chat/ThreadDetailsPrRows.tsx`: `lucide`
- `apps/web/src/components/chat/PanelLayoutControls.tsx`: `lucide`
- `apps/web/src/components/chat/MessagesTimeline.tsx`: `lucide`
- `apps/web/src/components/chat/MessageCopyButton.tsx`: `lucide`
- `apps/web/src/components/chat/ExpandedImageDialog.tsx`: `lucide`
- `apps/web/src/components/chat/ComposerPrimaryActions.tsx`: `lucide`
- `apps/web/src/components/chat/ChangedFilesTree.tsx`: `lucide`

### web: all reported paths including types

- `packages/client-runtime/src/state/shell.ts` → `packages/client-runtime/src/state/snapshots.ts` → `packages/client-runtime/src/state/shell.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/ComposerControl.tsx` → `apps/web/src/lib/utils.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/usePromptPrediction.ts` → `apps/web/src/connection/runtime.ts` → `apps/web/src/connection/platform.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/rightPanelStore.ts` → `apps/web/src/closedViewStore.ts` → `apps/web/src/rightPanelStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/files/AttachmentFilePreview.tsx` → `apps/web/src/components/ChatMarkdown.tsx` → `apps/web/src/hooks/usePullRequestLinking.ts` → `apps/web/src/lib/openPullRequestLink.ts` → `apps/web/src/browser/useOpenLink.ts` → `apps/web/src/browser/browserLinkTarget.ts` → `apps/web/src/hooks/useSettings.ts` → `apps/web/src/components/ui/toast.tsx` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/threadRoutes.ts` → `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/files/AttachmentFilePreview.tsx` → `apps/web/src/components/ChatMarkdown.tsx` → `apps/web/src/hooks/usePullRequestLinking.ts` → `apps/web/src/lib/openPullRequestLink.ts` → `apps/web/src/browser/useOpenLink.ts` → `apps/web/src/browser/browserLinkTarget.ts` → `apps/web/src/hooks/useSettings.ts` → `apps/web/src/components/ui/toast.tsx` → `apps/web/src/threadRoutes.ts`
- `apps/web/src/components/ui/toast.tsx` → `apps/web/src/components/ui/toastHelpers.ts` → `apps/web/src/components/ui/toast.tsx`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/files/AttachmentFilePreview.tsx` → `apps/web/src/components/ChatMarkdown.tsx` → `apps/web/src/components/chat/AssistantCitationChip.tsx` → `apps/web/src/components/contextChipParts.tsx` → `apps/web/src/lib/composerContextRecords.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/files/AttachmentFilePreview.tsx` → `apps/web/src/components/ChatMarkdown.tsx` → `apps/web/src/components/chat/AssistantCitationChip.tsx` → `apps/web/src/components/chat/composerEventScope.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/files/AttachmentFilePreview.tsx` → `apps/web/src/components/ChatMarkdown.tsx` → `apps/web/src/components/chat/ExpandedImagePreview.tsx` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/files/AttachmentFilePreview.tsx` → `apps/web/src/components/ChatMarkdown.tsx` → `apps/web/src/components/chat/ExpandedImageDialog.tsx` → `apps/web/src/components/chat/composerEventScope.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/questionAttachments.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/questionAttachments.ts` → `apps/web/src/lib/attachmentUploadQueue.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/ChatView.logic.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/ChatView.logic.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/composerEventScope.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/promptStashStore.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/composerContextUndo.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/composerAttachmentFiles.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/ComposerPromptEditor.tsx` → `apps/web/src/components/ComposerPromptEditorTiptap.tsx` → `apps/web/src/components/composerContextPresentation.tsx` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/ComposerPromptEditor.tsx` → `apps/web/src/components/ComposerPromptEditorTiptap.tsx` → `apps/web/src/components/composerContextPresentation.tsx` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/ProviderModelPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts`
- `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/ComposerPendingApprovalActions.tsx` → `apps/web/src/components/chat/composerEventScope.ts`
- `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/CompactComposerControlsMenu.tsx` → `apps/web/src/components/chat/composerEventScope.ts`
- `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/ComposerPrimaryActions.tsx` → `apps/web/src/components/chat/composerEventScope.ts`
- `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/composerProviderState.tsx`
- `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/AgentVelocityMeter.tsx` → `apps/web/src/components/chat/composerEventScope.ts`
- `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/ContextWindowMeter.tsx` → `apps/web/src/components/chat/composerEventScope.ts`
- `apps/web/src/composerDraftStore.ts` → `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/lib/snapShotAnimation.ts` → `apps/web/src/composerDraftStore.ts`
- `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/modelSelection.ts`
- `apps/web/src/modelSelection.ts` → `apps/web/src/components/chat/composerProviderState.tsx` → `apps/web/src/components/chat/TraitsPicker.tsx` → `apps/web/src/components/chat/composerEventScope.ts` → `apps/web/src/composerHandleContext.ts` → `apps/web/src/components/chat/ChatComposer.tsx` → `apps/web/src/components/chat/composerAutoRoute.ts` → `apps/web/src/modelSelection.ts`
- `apps/web/src/components/usage/UsageLimits.tsx` → `apps/web/src/components/usage/UsageLimitsPooled.tsx` → `apps/web/src/components/usage/UsageLimits.tsx`
- `apps/web/src/components/settings/ProjectDefaultsSettings.tsx` → `apps/web/src/components/settings/ProjectSettingsPanel.tsx` → `apps/web/src/components/settings/ProjectDefaultsSettings.tsx`
- `packages/client-runtime/src/device/stream.ts` → `packages/client-runtime/src/device/duoControl.ts` → `packages/client-runtime/src/device/stream.ts`

## Dependency direction

Observed cross-app edges:

- `apps/desktop/src/backend/DesktopBackendConfiguration.ts` → `apps/server/package.json` via `../../../server/package.json`.
- `apps/desktop/src/main.ts` → `apps/server/package.json` via `../../server/package.json`.

Both edges consume server package metadata from desktop; no resolved cross-app source-code edge or package-to-app edge was observed. This is qualified by 34 unresolved local/workspace requests below, including generated mobile modules and provider-openrouter/client. Asset requests and generated desktop CJS entry points are also unresolved by the TypeScript resolver.

- `apps/desktop/src/boot.ts`: `./compileCache.cjs`.
- `apps/desktop/src/boot.ts`: `./main.cjs`.
- `apps/mobile/src/App.tsx`: `../global.css`.
- `apps/mobile/src/components/brandAssets.ts`: `../../../../assets/dev/blueprint-ios-1024.png`.
- `apps/mobile/src/components/brandAssets.ts`: `../../../../assets/nightly/nightly-ios-1024.png`.
- `apps/mobile/src/components/brandAssets.ts`: `../../../../assets/prod/black-ios-1024.png`.
- `apps/mobile/src/components/MaterialScrollComposeButton.android.tsx`: `../../assets/icons/compose.xml`.
- `apps/mobile/src/components/ProviderIcon.tsx`: `../../assets/antigravity.png`.
- `apps/mobile/src/features/browser/PreviewStreamWebView.tsx`: `@t3tools/mobile-preview-stream`.
- `apps/mobile/src/features/devices/DeviceStreamWebView.tsx`: `@t3tools/mobile-device-stream`.
- `apps/mobile/src/features/settings/mobileThirdPartyLicenses.ts`: `@t3tools/mobile-third-party-licenses`.
- `apps/mobile/src/lib/providerClients.ts`: `@t3tools/provider-openrouter/client`.
- `apps/web/src/components/desktop/LeonidasMobNotificationNotice.tsx`: `../../assets/notification-completion.mp3`.
- `apps/web/src/components/device/deviceModels.ts`: `./models/iphone-duo.glb?url`.
- `apps/web/src/components/device/deviceModels.ts`: `./models/iphone-18-pro.glb?url`.
- `apps/web/src/components/device/deviceModels.ts`: `./models/iphone-18-pro-max.glb?url`.
- `apps/web/src/components/device/deviceModels.ts`: `./models/ipad-pro-13-m5-magic-keyboard.glb?url`.
- `apps/web/src/components/device/deviceModels.ts`: `./models/ipad-pro-13-m5.glb?url`.
- `apps/web/src/lib/snapShotSound.ts`: `../assets/snap-shot-click.mp3?url`.
- `apps/web/src/lib/snapShotSound.ts`: `../assets/snap-shot-whoosh.mp3?url`.
- `apps/web/src/main.tsx`: `./index.css`.
- `apps/web/src/terminal/ghostty/core.test.ts`: `./vendor/ghostty-vt.wasm?inline`.
- `apps/web/src/terminal/ghostty/core.test.ts`: `./vendor/ghostty-write-pty.wasm?inline`.
- `apps/web/src/terminal/ghostty/runtime.ts`: `./vendor/ghostty-vt.wasm?url`.
- `apps/web/src/terminal/ghostty/runtime.ts`: `./vendor/ghostty-write-pty.wasm?url&no-inline`.
- `apps/web/src/terminal/ghostty/runtimeAbi.test.ts`: `./vendor/ghostty-vt.wasm?inline`.
- `apps/web/src/terminal/ghostty/runtimeAbi.test.ts`: `./vendor/ghostty-write-pty.wasm?inline`.
- `apps/web/src/terminal/ghostty/runtimeAbi.test.ts`: `../../../../../native/libghostty-vt/VERSION?raw`.
- `apps/web/src/terminal/ghostty/surface.test.ts`: `./vendor/ghostty-vt.wasm?inline`.
- `apps/web/src/terminal/ghostty/surface.test.ts`: `./vendor/ghostty-write-pty.wasm?inline`.
- `apps/web/src/terminal/ghostty/surface.ts`: `./fonts/SymbolsNerdFontMono-Regular.woff2?url`.
- `apps/web/src/themeBoot.test.ts`: `../index.html?raw`.
- `apps/web/src/threadNotifications.ts`: `./assets/notification-completion.mp3`.
- `apps/web/src/threadNotifications.ts`: `./assets/notification-input.mp3`.

## Phase 1 implementation

Server package.json now maps `#server/*` to `./src/*` using native Node package imports. Converted 108 three-level relative imports across 29 mcp/toolkits source and test files. No tsconfig-only alias or Vite-only alias was added: the same mapping serves Node development, TypeScript NodeNext, tests and the production bundler. All replacements resolve to the identical TypeScript module as the original specifier. No behavioral code was changed.

## Verification

- Node directly resolved and imported #server/config.ts.
- 108 old/new TypeScript resolution pairs matched; 29 file comparisons showed only the intended substitution.
- Toolkit lint passed.
- Production server bundle passed, written outside the repository.
- Toolkit tests: 60 passed, 2 failed across 10 files. Both failures reproduced with a temporary Vite loader serving original HEAD toolkit sources: the goalControl schema assertion and a Windows Git fixture setup failure.
- Server package typecheck failed with diagnostics across existing services and tests. Baseline typecheck equivalence was not measured; this is not a clean typecheck receipt.

## Reproduction

Install dpdm in an external scratch directory, then run its CLI from the repository root. For each APP=server,web:

```text
dpdm "apps/APP/src/**/*.{ts,tsx}" --tsconfig apps/APP/tsconfig.json --no-tree --no-circular --no-warning --no-progress -o <scratch>/APP-all.json
dpdm "apps/APP/src/**/*.{ts,tsx}" --tsconfig apps/APP/tsconfig.json -T --no-tree --no-circular --no-warning --no-progress -o <scratch>/APP-runtime.json
vp test run apps/server/src/mcp/toolkits
vp lint apps/server/src/mcp/toolkits
# from apps/server:
vp run typecheck
vp pack --out-dir <scratch>/bundle
```

## Remaining scope

Cycle remediation and fork service/page splitting remain separate work. Alias cleanup does not remove dependency edges or repair cycles. No browser, mobile runtime, release, push or repository-wide check was performed. This audit is a local work artifact and should not be committed.

## Provider-state extraction (2026-10-12)

Moved pure calculations into apps/web/src/composerProviderState.ts and retained trait rendering in the chat TSX module. Updated model-selection, ChatView, ChatComposer and test imports. All four extracted function bodies are AST-identical to their original implementations. Initial transformed web scan reports only the UsageLimits/UsageLimitsPooled cycle; final verification follows dependency restoration.
