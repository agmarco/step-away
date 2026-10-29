/**
 * The one SQLite connection of this JS context, and the write helper.
 *
 * Rules proven on the Pixel by the background-responses probe (#12):
 * - one shared connection per JS context (the UI and a headless background
 *   task are separate contexts, each with its own connection);
 * - WAL plus busy_timeout, so a second context waits instead of failing;
 * - writes serialized per context by a promise-chain mutex, each one a
 *   BEGIN IMMEDIATE ... COMMIT transaction, ROLLBACK on error;
 * - never withExclusiveTransactionAsync: it opens a second connection without
 *   busy_timeout, and on the Pixel it lost Skips to `database is locked`.
 */
import * as SQLite from 'expo-sqlite';

/** Under expo-sqlite's default directory: files/SQLite/activity-reminder.db on Android. */
export const DB_NAME = 'activity-reminder.db';

export type Db = SQLite.SQLiteDatabase;

let dbPromise: Promise<Db> | null = null;

export function db(): Promise<Db> {
  dbPromise ??= (async () => {
    const d = await SQLite.openDatabaseAsync(DB_NAME);
    await d.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
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
    `);
    return d;
  })();
  return dbPromise;
}

let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Runs `fn` as one BEGIN IMMEDIATE transaction on the shared connection,
 * after every earlier write of this JS context has finished.
 */
export async function write<T>(fn: (d: Db) => Promise<T>): Promise<T> {
  const d = await db();
  const run = writeChain.then(async () => {
    await d.execAsync('BEGIN IMMEDIATE');
    try {
      const out = await fn(d);
      await d.execAsync('COMMIT');
      return out;
    } catch (e) {
      await d.execAsync('ROLLBACK').catch(() => {});
      throw e;
    }
  });
  writeChain = run.catch(() => {});
  return run;
}
