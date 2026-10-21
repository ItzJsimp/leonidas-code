// @effect-diagnostics nodeBuiltinImport:off - the log is a plain append-only file.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import {
  parseLog,
  serializeEntry,
  type ActionLogEntry,
  type ActionLogStore,
} from "@t3tools/mail-autopilot";

export interface JsonlActionLogOptions {
  /** The per-user data folder (`ServerConfig.stateDir`). The log lives in `<stateDir>/mail-autopilot/`. */
  readonly stateDir: string;
  readonly inbox: string;
}

/** Letters, digits and `._@-` only, and never a name made of dots. */
const fileNameFor = (inbox: string): string => {
  if (inbox === "") throw new Error("inbox id is empty");
  const safe = inbox.replaceAll(/[^A-Za-z0-9._@-]/g, "_").replace(/^\.+$/, "_");
  return `${safe}.jsonl`;
};

/** Append-only JSONL, one file per inbox. Appends run one at a time, in call order. */
export const makeJsonlActionLog = (options: JsonlActionLogOptions): ActionLogStore => {
  const dir = NodePath.join(options.stateDir, "mail-autopilot");
  const file = NodePath.join(dir, fileNameFor(options.inbox));
  let queue: Promise<unknown> = Promise.resolve();
  let checkedTail = false;

  /** After a crash the last line may have no newline. Start the next entry on a fresh line. */
  const needsNewline = async (): Promise<boolean> => {
    if (checkedTail) return false;
    checkedTail = true;
    try {
      const text = await NodeFSP.readFile(file, "utf8");
      return text !== "" && !text.endsWith("\n");
    } catch {
      return false;
    }
  };

  const write = async (entry: ActionLogEntry) => {
    await NodeFSP.mkdir(dir, { recursive: true });
    const prefix = (await needsNewline()) ? "\n" : "";
    await NodeFSP.appendFile(file, prefix + serializeEntry(entry), "utf8");
  };

  return {
    append(entry) {
      const next = queue.then(() => write(entry));
      queue = next.catch(() => undefined);
      return next;
    },
    async readAll() {
      try {
        return parseLog(await NodeFSP.readFile(file, "utf8"));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw err;
      }
    },
  };
};
