// PROTOTYPE — throwaway (agmarco/activityReminder#12, branch prototype/background-responses).
// One SQLite file shared by the background notification task and the foreground UI.
// Every handler call is logged in `attempts`; a Response is only written when the
// guarded state transition on `reminders` wins, so duplicates show up as losing attempts.
import * as SQLite from 'expo-sqlite';
import { AppState } from 'react-native';

// Identifies the JS context that wrote a row: a headless task context gets its own id.
export const CONTEXT_ID = Math.random().toString(36).slice(2, 7);

export type Source = 'bg-task' | 'fg-listener' | 'ui';
export type Kind = 'Done' | 'Skip' | 'Snooze';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function db() {
  dbPromise ??= (async () => {
    const d = await SQLite.openDatabaseAsync('probe.db');
    await d.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending',
        snoozes INTEGER NOT NULL DEFAULT 0, fired_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reminder_id INTEGER NOT NULL, kind TEXT NOT NULL,
        source TEXT NOT NULL, context TEXT NOT NULL, app_state TEXT, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, reminder_id INTEGER, kind TEXT, source TEXT,
        context TEXT, app_state TEXT, won INTEGER, error TEXT, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS heartbeats (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS task_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT, context TEXT, app_state TEXT, payload TEXT, result TEXT, at TEXT NOT NULL);
    `);
    return d;
  })();
  return dbPromise;
}

const now = () => new Date().toISOString();

// Writes are serialized per JS context and run as BEGIN IMMEDIATE on the one shared
// connection. Not withExclusiveTransactionAsync: it opens a second connection that lacks
// busy_timeout, and on the Pixel that lost both Skips to `database is locked`.
let writeChain: Promise<unknown> = Promise.resolve();
async function write<T>(fn: (d: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
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

export async function createReminder(): Promise<number> {
  return write(async (d) => (await d.runAsync('INSERT INTO reminders (fired_at) VALUES (?)', now())).lastInsertRowId);
}

// Guarded transition: only a pending Reminder can be answered, and a Snooze must see the
// snooze count it expects. Returns true if this call won (and wrote the Response).
export async function recordResponse(reminderId: number, kind: Kind, source: Source, expectedSnoozes?: number): Promise<boolean> {
  const appState = AppState.currentState ?? 'unknown';
  let won = false;
  let error: string | null = null;
  try {
    await write(async (txn) => {
      const res =
        kind === 'Snooze'
          ? await txn.runAsync(
              "UPDATE reminders SET snoozes = snoozes + 1 WHERE id = ? AND status = 'pending' AND snoozes = ? AND snoozes < 2",
              reminderId, expectedSnoozes ?? 0)
          : await txn.runAsync(
              "UPDATE reminders SET status = ? WHERE id = ? AND status = 'pending'",
              kind.toLowerCase(), reminderId);
      won = res.changes === 1;
      if (won) {
        await txn.runAsync(
          'INSERT INTO responses (reminder_id, kind, source, context, app_state, at) VALUES (?, ?, ?, ?, ?, ?)',
          reminderId, kind, source, CONTEXT_ID, appState, now());
      }
    });
  } catch (e) {
    error = String(e);
  }
  // Logged outside the transaction so a failed write is still visible.
  await write((d) => d.runAsync(
    'INSERT INTO attempts (reminder_id, kind, source, context, app_state, won, error, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    reminderId, kind, source, CONTEXT_ID, appState, won ? 1 : 0, error, now())).catch(() => {});
  return won;
}

// Raw background-task payloads, since their shape for local notifications isn't documented.
export async function logTaskCall(payload: unknown, result: string) {
  await write((d) => d.runAsync('INSERT INTO task_calls (context, app_state, payload, result, at) VALUES (?, ?, ?, ?, ?)',
    CONTEXT_ID, AppState.currentState ?? 'unknown', JSON.stringify(payload).slice(0, 2000), result, now()));
}

export async function heartbeat() {
  await write((d) => d.runAsync('INSERT INTO heartbeats (at) VALUES (?)', now()));
}

export async function snapshot() {
  const d = await db();
  const [reminders, responses, attempts, hb, dupes, lost, taskCalls] = await Promise.all([
    d.getAllAsync<{ id: number; status: string; snoozes: number }>('SELECT id, status, snoozes FROM reminders ORDER BY id DESC LIMIT 30'),
    d.getAllAsync<Record<string, unknown>>('SELECT * FROM responses ORDER BY id DESC LIMIT 30'),
    d.getAllAsync<Record<string, unknown>>('SELECT * FROM attempts ORDER BY id DESC LIMIT 40'),
    d.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM heartbeats'),
    // A Reminder with more than one terminal Response, or more Snooze rows than its count.
    d.getAllAsync<{ reminder_id: number; n: number }>(
      "SELECT reminder_id, COUNT(*) AS n FROM responses WHERE kind != 'Snooze' GROUP BY reminder_id HAVING n > 1"),
    // An answered Reminder with no terminal Response row: the state moved but the Response was lost.
    d.getAllAsync<{ id: number }>(
      "SELECT id FROM reminders r WHERE status != 'pending' AND NOT EXISTS (SELECT 1 FROM responses s WHERE s.reminder_id = r.id AND s.kind != 'Snooze')"),
    d.getAllAsync<Record<string, unknown>>('SELECT * FROM task_calls ORDER BY id DESC LIMIT 10'),
  ]);
  const errors = attempts.filter((a) => a.error);
  return { reminders, responses, attempts, heartbeats: hb?.n ?? 0, dupes, lost, errors, taskCalls };
}

export async function reset() {
  await write((d) => d.execAsync('DELETE FROM reminders; DELETE FROM responses; DELETE FROM attempts; DELETE FROM heartbeats; DELETE FROM task_calls;'));
}
