// Root `preinstall` guard. A `pnpm install` in the main checkout deletes node_modules, and the
// always-on dev server then fails until the install finishes (20+ minutes on a slow disk).
// Refuse that install when a working one exists (never in CI, where the cache restores node_modules). Set LEONIDAS_ALLOW_MAIN_INSTALL=1 to allow it.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.env.INIT_CWD ?? process.cwd();
const gitPath = join(root, ".git");
// A worktree has a .git file; only the main checkout has a .git folder.
const isMainCheckout = existsSync(gitPath) && statSync(gitPath).isDirectory();
const hasWorkingInstall = existsSync(join(root, "node_modules", ".modules.yaml"));

if (
  isMainCheckout &&
  hasWorkingInstall &&
  !process.env.CI &&
  process.env.LEONIDAS_ALLOW_MAIN_INSTALL !== "1"
) {
  console.error(
    [
      "",
      "Install blocked: this is the main checkout and it has a working node_modules.",
      "An install here deletes node_modules and stops the dev server until it finishes.",
      "Install in a worktree under C:/lcw instead.",
      "If you must install here, run: LEONIDAS_ALLOW_MAIN_INSTALL=1 pnpm install --frozen-lockfile",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
