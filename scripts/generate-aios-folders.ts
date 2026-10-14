// Writes scripts/New-AiosFolders.ps1 from the AIOS_PRESET the in-app setup uses.
// Run: node scripts/generate-aios-folders.ts
import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";

import { renderAiosFoldersScript } from "../apps/web/src/onboarding/aiosFolders.logic.ts";
import { AIOS_PRESET } from "../apps/web/src/onboarding/leonidasSetup.logic.ts";

const out = NodeURL.fileURLToPath(new URL("./New-AiosFolders.ps1", import.meta.url));
NodeFS.writeFileSync(out, renderAiosFoldersScript(AIOS_PRESET));
console.log(`Wrote ${out}`);
