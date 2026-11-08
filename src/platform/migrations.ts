/**
 * The schema, as versioned migrations keyed by SQLite's `PRAGMA user_version`.
 * `db()` runs `migrate` once per connection, right after opening it.
 *
 * Rules:
 * - Never drop or recreate a table: the owner's device holds real data.
 * - Each step runs inside one BEGIN IMMEDIATE transaction together with the
 *   `user_version` bump, so a step is applied entirely or not at all, and a
 *   second JS context opening at the same moment waits (busy_timeout) and then
 *   sees the new version instead of applying the step twice.
 *
 * How to add the next migration (v3 -> v4):
 * 1. Append one function to MIGRATIONS. Its index + 1 is the version it
 *    produces; never edit or reorder a step that has shipped to a device.
 * 2. Make it safe on any DB at the previous version: ADD COLUMN, CREATE TABLE
 *    IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, UPDATE to backfill. No DROP,
 *    no table rebuild. Use `addColumnIfMissing` for columns.
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

async function addColumnIfMissing(d: MigrationDb, table: string, column: string, definition: string) {
  const columns = await d.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((c) => c.name === column)) await d.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export const MIGRATIONS: readonly Migration[] = [
  // v0 -> v1: the #21 schema. A DB created by #21 is at user_version 0 but
  // already has these tables, so every statement is IF NOT EXISTS.
  (d) =>
    d.execAsync(`
      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        fires_at INTEGER NOT NULL,
        suggestion TEXT NOT NULL,
        status TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS reminders_fires_at ON reminders (fires_at);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reminder_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        at INTEGER NOT NULL);
    `),
  // v1 -> v2 (#22): Snooze. Existing rows get snoozes 0 and no re-fire. The
  // statuses `missed` and `dropped` are plain TEXT values: no change needed.
  async (d) => {
    await addColumnIfMissing(d, 'reminders', 'snoozes', 'INTEGER NOT NULL DEFAULT 0');
    await addColumnIfMissing(d, 'reminders', 'refires_at', 'INTEGER NULL');
  },
  // v2 -> v3 (#23): the guided Done. The Exercises done, as a JSON array of
  // `{ id, name, bodyArea }`; NULL for every Reminder that isn't `done`, which
  // is every existing row (the status `done` is a plain TEXT value).
  (d) => addColumnIfMissing(d, 'reminders', 'done_exercises', 'TEXT NULL'),
];

export const SCHEMA_VERSION = MIGRATIONS.length;

const versionOf = async (d: MigrationDb) =>
  (await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;

/**
 * Brings the DB to SCHEMA_VERSION, one transaction per step. An up-to-date DB
 * costs one read and takes no lock. The version is re-read inside each
 * transaction, so a step another JS context applied meanwhile is not re-run.
 */
export async function migrate(d: MigrationDb): Promise<void> {
  if ((await versionOf(d)) >= SCHEMA_VERSION) return;
  for (;;) {
    await d.execAsync('BEGIN IMMEDIATE');
    try {
      const version = await versionOf(d);
      if (version >= SCHEMA_VERSION) {
        await d.execAsync('COMMIT');
        return;
      }
      await MIGRATIONS[version](d);
      // PRAGMA takes no bound parameters; `version + 1` is an integer we computed.
      await d.execAsync(`PRAGMA user_version = ${version + 1}`);
      await d.execAsync('COMMIT');
    } catch (e) {
      await d.execAsync('ROLLBACK').catch(() => {});
      throw e;
    }
  }
}
