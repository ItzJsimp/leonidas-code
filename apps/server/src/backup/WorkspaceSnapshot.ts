// @effect-diagnostics globalDateInEffect:off nodeBuiltinImport:off preferSchemaOverJson:off - synchronous node and global APIs are used on purpose in this file.
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

/** Saved item tables the snapshot keeps. Order is the restore order. */
const SAVED_ITEM_TABLES = [
  "saved_item_events",
  "projection_saved_items",
  "saved_item_commands",
  "saved_item_effects",
] as const;

const FORMAT_VERSION = 1;
const MANIFEST_FILE = "manifest.json";
const SAVED_ITEMS_FILE = "saved-items.json";
const CARDS_DIR = "cards";

export class WorkspaceSnapshotError extends Data.TaggedError("WorkspaceSnapshotError")<{
  readonly reason: "malformed" | "unsupported" | "mismatch" | "io";
  readonly message: string;
}> {}

export interface SnapshotManifest {
  readonly formatVersion: number;
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly cards: ReadonlyArray<{ readonly path: string; readonly sha256: string }>;
  readonly savedItemsSha256: string;
  readonly savedItems: Readonly<Record<string, number>>;
}

const sha256 = (data: string | Buffer) =>
  NodeCrypto.createHash("sha256").update(data).digest("hex");

const fail = (reason: WorkspaceSnapshotError["reason"], message: string) =>
  new WorkspaceSnapshotError({ reason, message });

const io = <A>(label: string, run: () => A) =>
  Effect.try({
    try: run,
    catch: (error) =>
      fail("io", `${label}: ${error instanceof Error ? error.message : String(error)}`),
  });

/** Relative paths of every card file under a folder, with forward slashes. */
function listCards(root: string): string[] {
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of NodeFS.readdirSync(current, { withFileTypes: true })) {
      const full = NodePath.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
        found.push(NodePath.relative(root, full).replaceAll("\\", "/"));
      }
    }
  };
  if (NodeFS.existsSync(root)) walk(root);
  return found.toSorted();
}

const currentSchemaVersion = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    readonly version: number | null;
  }>`SELECT MAX(migration_id) AS version FROM effect_sql_migrations`;
  return rows[0]?.version ?? 0;
});

/** Copies task cards and saved item tables into a new snapshot folder. Source data is only read. */
export const createSnapshot = (input: {
  readonly tasksDir: string;
  readonly snapshotDir: string;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const schemaVersion = yield* currentSchemaVersion;
    const tables: Record<string, ReadonlyArray<Record<string, unknown>>> = {};
    for (const table of SAVED_ITEM_TABLES) {
      tables[table] = yield* sql.unsafe<Record<string, unknown>>(`SELECT * FROM ${table}`);
    }
    const savedItemsJson = JSON.stringify(tables);
    const cards = yield* io("copy cards", () => {
      NodeFS.mkdirSync(NodePath.join(input.snapshotDir, CARDS_DIR), { recursive: true });
      return listCards(input.tasksDir).map((path) => {
        const bytes = NodeFS.readFileSync(NodePath.join(input.tasksDir, path));
        const target = NodePath.join(input.snapshotDir, CARDS_DIR, path);
        NodeFS.mkdirSync(NodePath.dirname(target), { recursive: true });
        NodeFS.writeFileSync(target, bytes);
        return { path, sha256: sha256(bytes) };
      });
    });
    const manifest: SnapshotManifest = {
      formatVersion: FORMAT_VERSION,
      schemaVersion,
      createdAt: new Date().toISOString(),
      cards,
      savedItemsSha256: sha256(savedItemsJson),
      savedItems: Object.fromEntries(SAVED_ITEM_TABLES.map((t) => [t, tables[t]!.length])),
    };
    // The manifest is written last, so a snapshot without one is known to be unfinished.
    yield* io("write snapshot", () => {
      NodeFS.writeFileSync(NodePath.join(input.snapshotDir, SAVED_ITEMS_FILE), savedItemsJson);
      NodeFS.writeFileSync(
        NodePath.join(input.snapshotDir, MANIFEST_FILE),
        JSON.stringify(manifest, null, 2),
      );
    });
    return manifest;
  });

/** Reads and checks a snapshot. Touches nothing outside the snapshot folder. */
const verifySnapshot = (snapshotDir: string) =>
  Effect.gen(function* () {
    const schemaVersion = yield* currentSchemaVersion;
    const parsed = yield* Effect.try({
      try: () =>
        JSON.parse(
          NodeFS.readFileSync(NodePath.join(snapshotDir, MANIFEST_FILE), "utf8"),
        ) as SnapshotManifest,
      catch: () => fail("malformed", "Snapshot has no readable manifest. It may be unfinished."),
    });
    if (parsed.formatVersion !== FORMAT_VERSION) {
      return yield* fail(
        "unsupported",
        `Snapshot format ${parsed.formatVersion} is not supported.`,
      );
    }
    if (parsed.schemaVersion > schemaVersion) {
      return yield* fail(
        "unsupported",
        `Snapshot schema ${parsed.schemaVersion} is newer than this app (${schemaVersion}).`,
      );
    }
    const savedItemsRaw = yield* io("read saved items", () =>
      NodeFS.readFileSync(NodePath.join(snapshotDir, SAVED_ITEMS_FILE), "utf8"),
    );
    if (sha256(savedItemsRaw) !== parsed.savedItemsSha256) {
      return yield* fail("mismatch", "Saved items data does not match the manifest.");
    }
    for (const card of parsed.cards) {
      const bytes = yield* io(`read card ${card.path}`, () =>
        NodeFS.readFileSync(NodePath.join(snapshotDir, CARDS_DIR, card.path)),
      );
      if (sha256(bytes) !== card.sha256) {
        return yield* fail("mismatch", `Card ${card.path} does not match the manifest.`);
      }
    }
    return {
      manifest: parsed,
      tables: JSON.parse(savedItemsRaw) as Record<string, ReadonlyArray<Record<string, unknown>>>,
    };
  });

/**
 * Replaces task cards and saved items with the snapshot. The snapshot is fully checked first.
 * The new cards are staged beside the old folder. The database change and the folder swap
 * happen in one transaction, so a failed swap rolls the tables back and the old cards stay.
 */
export const restoreSnapshot = (input: {
  readonly snapshotDir: string;
  readonly tasksDir: string;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const { manifest, tables } = yield* verifySnapshot(input.snapshotDir);
    const suffix = NodeCrypto.randomUUID();
    const staged = `${input.tasksDir}.restore-${suffix}`;
    const previous = `${input.tasksDir}.previous-${suffix}`;
    yield* io("stage cards", () => {
      NodeFS.mkdirSync(staged, { recursive: true });
      for (const card of manifest.cards) {
        const target = NodePath.join(staged, card.path);
        NodeFS.mkdirSync(NodePath.dirname(target), { recursive: true });
        NodeFS.copyFileSync(NodePath.join(input.snapshotDir, CARDS_DIR, card.path), target);
      }
    }).pipe(
      Effect.tapError(() =>
        io("clean staging", () => NodeFS.rmSync(staged, { recursive: true, force: true })).pipe(
          Effect.ignore,
        ),
      ),
    );

    const hadPrevious = NodeFS.existsSync(input.tasksDir);
    const swap = io("swap cards", () => {
      if (hadPrevious) NodeFS.renameSync(input.tasksDir, previous);
      try {
        NodeFS.renameSync(staged, input.tasksDir);
      } catch (error) {
        if (hadPrevious) NodeFS.renameSync(previous, input.tasksDir);
        throw error;
      }
    });
    const replaceTables = Effect.gen(function* () {
      for (const table of SAVED_ITEM_TABLES) yield* sql.unsafe(`DELETE FROM ${table}`);
      for (const table of SAVED_ITEM_TABLES) {
        const rows = tables[table] ?? [];
        if (rows.length > 0) yield* sql`INSERT INTO ${sql(table)} ${sql.insert(rows as never)}`;
      }
    });
    yield* sql
      .withTransaction(
        Effect.gen(function* () {
          yield* replaceTables;
          yield* swap;
        }),
      )
      .pipe(
        Effect.tapError(() =>
          io("clean staging", () => NodeFS.rmSync(staged, { recursive: true, force: true })).pipe(
            Effect.ignore,
          ),
        ),
      );
    // Only now is the old folder unneeded. A failure here leaves a harmless leftover.
    if (hadPrevious) {
      yield* io("remove old cards", () =>
        NodeFS.rmSync(previous, { recursive: true, force: true }),
      ).pipe(Effect.ignore);
    }
    return manifest;
  });
