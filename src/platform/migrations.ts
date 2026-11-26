/**
 * The schema, versioned by SQLite's `PRAGMA user_version`.
 * `db()` runs `migrate` once per connection, right after opening it.
 *
 * The baseline: a fresh DB (version 0) gets the whole v5 schema in one step.
 * The five steps of #21-#26 that built it on the owner's phone were folded
 * into it before release (#68); a DB at version 1-4 no longer exists and is
 * rejected, left as it is. A DB at 5 or later is never recreated.
 *
 * Rules:
 * - Never drop or recreate a table: the owner's device holds real data.
 * - Each step runs inside one BEGIN IMMEDIATE transaction together with the
 *   `user_version` bump, so a step is applied entirely or not at all.
 * - The version is re-read inside the transaction, so a second JS context
 *   opening at the same moment waits (busy_timeout) and then sees the new
 *   version instead of applying the step twice.
 *
 * How to add the next migration (v5 -> v6):
 * 1. Append one function to MIGRATIONS. The step at index i produces version
 *    BASELINE_VERSION + i + 1; never edit or reorder a step that has shipped
 *    to a device, and never edit the baseline once v6 exists.
 * 2. Make it safe on any DB at the previous version: ALTER TABLE ... ADD
 *    COLUMN, CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, UPDATE to
 *    backfill. No DROP, no table rebuild.
 * 3. Don't issue BEGIN/COMMIT or touch user_version in the step: `migrate`
 *    does both.
 * 4. Update the row mapping in store.ts and the schema line in src/README.md.
 */

/** The slice of an expo-sqlite connection the migrations need. */
export interface MigrationDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  getAllAsync<T>(sql: string): Promise<T[]>;
}

type Migration = (d: MigrationDb) => Promise<void>;

/** The version the baseline produces. */
export const BASELINE_VERSION = 5;

/**
 * v0 -> v5: the whole schema. `reminders` keeps the column order the phone's
 * ALTERs left (#22 snoozes, refires_at; #23 done_exercises; #24 fallback,
 * swapped_out, rotation; #26 dropped_by). `done_exercises` and `swapped_out`
 * are JSON; `dropped_by` is `closing`, `pause` or `dayOff`, NULL unless
 * `dropped` (NULL on a dropped row reads as `closing`).
 */
const baseline: Migration = (d) =>
  d.execAsync(`
    CREATE TABLE reminders (
      id TEXT PRIMARY KEY,
      fires_at INTEGER NOT NULL,
      suggestion TEXT NOT NULL,
      status TEXT NOT NULL,
      snoozes INTEGER NOT NULL DEFAULT 0,
      refires_at INTEGER NULL,
      done_exercises TEXT NULL,
      fallback INTEGER NOT NULL DEFAULT 0,
      swapped_out TEXT NULL,
      rotation INTEGER NULL,
      dropped_by TEXT NULL);
    CREATE INDEX reminders_fires_at ON reminders (fires_at);
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reminder_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      at INTEGER NOT NULL);
  `);

/** The steps after the baseline: index i takes BASELINE_VERSION + i to BASELINE_VERSION + i + 1. */
export const MIGRATIONS: readonly Migration[] = [];

export const SCHEMA_VERSION = BASELINE_VERSION + MIGRATIONS.length;

const versionOf = async (d: MigrationDb) =>
  (await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;

function assertSupported(version: number) {
  if (version > 0 && version < BASELINE_VERSION) {
    throw new Error(
      `Unsupported schema: user_version ${version} is unsupported; only 0 (fresh) or ${BASELINE_VERSION} and later is supported`,
    );
  }
}

/**
 * Brings the DB to SCHEMA_VERSION, one transaction per step, and returns after
 * the last one. An up-to-date DB costs one read and takes no lock. The version
 * is re-read inside each transaction, so a step another JS context applied
 * meanwhile is not re-run. A DB at version 1-4 is rejected, untouched.
 */
export async function migrate(d: MigrationDb): Promise<void> {
  const current = await versionOf(d);
  if (current >= SCHEMA_VERSION) return;
  assertSupported(current);
  for (;;) {
    await d.execAsync('BEGIN IMMEDIATE');
    try {
      const version = await versionOf(d);
      assertSupported(version);
      if (version >= SCHEMA_VERSION) {
        await d.execAsync('COMMIT');
        return;
      }
      const next = version === 0 ? BASELINE_VERSION : version + 1;
      await (version === 0 ? baseline : MIGRATIONS[version - BASELINE_VERSION])(d);
      // PRAGMA takes no bound parameters; `next` is an integer we computed.
      await d.execAsync(`PRAGMA user_version = ${next}`);
      await d.execAsync('COMMIT');
      if (next >= SCHEMA_VERSION) return;
    } catch (e) {
      await d.execAsync('ROLLBACK').catch(() => {});
      throw e;
    }
  }
}
