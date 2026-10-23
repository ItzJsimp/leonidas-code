// Writes scripts/New-AiosFolders.ps1 from the AIOS_PRESET the in-app setup uses.
// Run: node scripts/generate-aios-folders.ts
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { renderAiosFoldersScript } from "../apps/web/src/onboarding/aiosFolders.logic.ts";
import { AIOS_PRESET } from "../apps/web/src/onboarding/leonidasSetup.logic.ts";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const out = yield* path.fromFileUrl(new URL("./New-AiosFolders.ps1", import.meta.url));
  yield* fs.writeFileString(out, renderAiosFoldersScript(AIOS_PRESET));
  yield* Console.log(`Wrote ${out}`);
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
