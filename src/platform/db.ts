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
 *
 * The schema lives in migrations.ts (versioned by PRAGMA user_version).
 */
import * as SQLite from 'expo-sqlite';
import { migrate } from './migrations';

/** Under expo-sqlite's default directory: files/SQLite/activity-reminder.db on Android. */
export const DB_NAME = 'activity-reminder.db';

export type Db = SQLite.SQLiteDatabase;

let dbPromise: Promise<Db> | null = null;

export function db(): Promise<Db> {
  dbPromise ??= (async () => {
    const d = await SQLite.openDatabaseAsync(DB_NAME);
    // busy_timeout is 15 s, not 5: the Reminder chain (up to 100
    // notifications, notifications.ts MAX_SCHEDULED) is scheduled while
    // BEGIN IMMEDIATE is held (handler.ts), and a cold-start headless Skip in
    // the other JS context must outwait that, not fail with `database is locked`.
    await d.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 15000;
    `);
    // The schema, once per connection, after busy_timeout is set (the other
    // JS context may be migrating at the same moment): see migrations.ts.
    await migrate(d);
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
