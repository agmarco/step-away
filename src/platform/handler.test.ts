/**
 * The handler's shade clean-up after a slow write (#39), through fakes at the
 * platform edges: an in-memory SQLite database (Node's `node:sqlite`) behind
 * the slice of expo-sqlite's API the store uses, `write()` running the
 * transaction on it while the clock moves on, and expo-notifications' shade.
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, reduce, seededRandom, type CoreState, type Exercise } from '../core';
import type { Db } from './db';
import { migrate } from './migrations';

const library: Exercise[] = [
  {
    id: 'Side_Neck_Stretch',
    source: 'free-exercise-db',
    name: 'Side Neck Stretch',
    targetMuscles: ['neck'],
    bodyArea: 'Neck',
    exerciseType: 'Stretch',
    difficulty: 'Beginner',
    position: 'Either',
    equipment: null,
    energetic: false,
    dose: { kind: 'seconds', amount: 20, eachSide: true },
    cue: 'Ear to shoulder, shoulders stay down',
    steps: ['Do it.'],
    photos: null,
  },
];

/** How long the write takes: the CP1 device run saw 11–13 s in Test mode. */
const WRITE_MS = 12_000;

/** The notifications presented in the shade when the handler looks, by Reminder Id. */
let shade: string[] = [];

const paramsOf = (params: unknown[]) => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as SQLInputValue[];

function fakeDb(): Db {
  const sqlite = new DatabaseSync(':memory:');
  const fake = {
    execAsync: async (sql: string) => sqlite.exec(sql),
    getFirstAsync: async (sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...paramsOf(params)) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) => sqlite.prepare(sql).all(...paramsOf(params)),
    runAsync: async (sql: string, ...params: unknown[]) => {
      const { changes, lastInsertRowid } = sqlite.prepare(sql).run(...paramsOf(params));
      return { changes: Number(changes), lastInsertRowId: Number(lastInsertRowid) };
    },
  };
  return fake as unknown as Db;
}

const conn = vi.hoisted(() => ({ d: undefined as unknown as Db }));

vi.mock('expo-sqlite', () => ({}));
vi.mock('../library', () => ({ exercises: library }));
vi.mock('./db', () => ({
  db: async () => conn.d,
  // One transaction that takes WRITE_MS: the clock has moved on by the time it commits.
  write: async <T>(fn: (d: Db) => Promise<T>): Promise<T> => {
    const out = await fn(conn.d);
    vi.setSystemTime(Date.now() + WRITE_MS);
    return out;
  },
}));
vi.mock('expo-notifications', () => ({
  getPresentedNotificationsAsync: vi.fn(async () =>
    shade.map((identifier) => ({ date: Date.now(), request: { identifier, content: {}, trigger: null } })),
  ),
  dismissNotificationAsync: vi.fn(async () => {}),
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {}),
  scheduleNotificationAsync: vi.fn(async () => 'scheduled'),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));

const Notifications = await import('expo-notifications');
const { deviceTimeZone, rearmOnOpen, respond } = await import('./handler');
const { saveState } = await import('./store');

/** The chain a Rearm at `at` stores, in the device's time zone (as the handler reads it). */
async function storedChain(at: number): Promise<CoreState> {
  const stored = reduce(
    { ...initialState, settings: { ...initialState.settings, timeZone: deviceTimeZone() } },
    { type: 'Rearm', timeZone: deviceTimeZone() },
    { clock: { now: () => at }, random: seededRandom(7), library },
  ).state;
  await saveState(conn.d, stored, at);
  return stored;
}

/** Counts every reminders row inserted, updated or deleted from here on, however the SQL is shaped. */
async function countRowWrites(d: Db): Promise<() => Promise<number>> {
  await d.execAsync(`
    CREATE TABLE row_writes (n INTEGER NOT NULL);
    INSERT INTO row_writes (n) VALUES (0);
    CREATE TRIGGER count_insert AFTER INSERT ON reminders BEGIN UPDATE row_writes SET n = n + 1; END;
    CREATE TRIGGER count_update AFTER UPDATE ON reminders BEGIN UPDATE row_writes SET n = n + 1; END;
    CREATE TRIGGER count_delete AFTER DELETE ON reminders BEGIN UPDATE row_writes SET n = n + 1; END;
  `);
  return async () => (await d.getFirstAsync<{ n: number }>('SELECT n FROM row_writes'))?.n ?? -1;
}

describe('the shade after a slow write (#39)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(Notifications.dismissNotificationAsync).mockClear();
    conn.d = fakeDb();
    await migrate(conn.d);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps a Reminder that fired while the app-open write was in progress, and dismisses the one before it', async () => {
    // The chain as the previous Rearm stored it, in the device's time zone (as rearmOnOpen reads it).
    const before = Date.parse('2026-11-02T06:00:00Z');
    const stored: CoreState = reduce(
      { ...initialState, settings: { ...initialState.settings, timeZone: deviceTimeZone() } },
      { type: 'Rearm', timeZone: deviceTimeZone() },
      { clock: { now: () => before }, random: seededRandom(7), library },
    ).state;
    await saveState(conn.d, stored, before);
    const [earlier, firing] = stored.reminders;

    // The app opens 5 s before `firing` is due; it fires during the 12 s write and is in the shade with `earlier`.
    vi.setSystemTime(firing.firesAt - 5_000);
    shade = [earlier.id, firing.id];

    await rearmOnOpen();

    const dismissed = vi.mocked(Notifications.dismissNotificationAsync).mock.calls.map(([id]) => id);
    expect(dismissed).toEqual([earlier.id]);
  });
  it('keeps a Reminder that fired while a shade tap was being written, and dismisses the one it superseded', async () => {
    const before = Date.parse('2026-11-02T06:00:00Z');
    const [stale, outstanding, firing] = (await storedChain(before)).reminders;

    // A tap on a stale notification 5 s before `firing` is due: a no-op Response, so the stored chain
    // is what commits, and `firing` fires during the 12 s write. All three are in the shade.
    vi.setSystemTime(firing.firesAt - 5_000);
    shade = [stale.id, outstanding.id, firing.id];

    expect(await respond({ type: 'Response', reminderId: stale.id, kind: 'Skip' }, 'bg-task')).toBe(false);

    // The tapped one first, then everything stale as of the commit: `firing` is outstanding by then.
    const dismissed = vi.mocked(Notifications.dismissNotificationAsync).mock.calls.map(([id]) => id);
    expect(dismissed).toEqual([stale.id, stale.id, outstanding.id]);
  });

  it('writes only the answered Reminder row for a Skip on a stored chain', async () => {
    const before = Date.parse('2026-11-02T06:00:00Z');
    const stored = await storedChain(before);
    const [outstanding] = stored.reminders;
    const rowWrites = await countRowWrites(conn.d);

    // Skipped as it fires: the chain rebuilt from the Skip is the one stored, so only that Reminder changes.
    vi.setSystemTime(outstanding.firesAt);
    expect(await respond({ type: 'Response', reminderId: outstanding.id, kind: 'Skip' }, 'bg-task')).toBe(true);

    // 11 a day (09:45 to 17:15 every 45 min), Monday to Friday. A full rewrite would delete the 54 ahead and
    // upsert all 55, 110 row writes with the guarded UPDATE; the diff writes that one row twice: the guarded
    // UPDATE and the save's upsert.
    expect(stored.reminders).toHaveLength(55);
    expect(await rowWrites()).toBe(2);
  });
});
