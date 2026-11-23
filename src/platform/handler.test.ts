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
const { deviceTimeZone, rearmOnOpen } = await import('./handler');
const { saveState } = await import('./store');

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
});
