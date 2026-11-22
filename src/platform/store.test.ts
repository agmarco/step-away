/**
 * The store's row mapping and the migrations, through a fake connection: an
 * in-memory SQLite database (Node's `node:sqlite`) behind the slice of
 * expo-sqlite's async API that store.ts and migrations.ts use, so the real
 * SQL runs. No expo module is loaded.
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, type CoreState, type Reminder, type SuggestedExercise } from '../core';
import type { Db } from './db';
import { MIGRATIONS, migrate, SCHEMA_VERSION } from './migrations';

vi.mock('expo-sqlite', () => ({}));
// The bundled library pulls in photos; the backfill only needs Ids, and every snapshot here has its Body Area.
vi.mock('../library', () => ({ exercises: [] }));

const { isOnboardingDone, loadState, markOnboardingDone, saveState } = await import('./store');

/** expo-sqlite takes bound parameters spread or as one array. */
const paramsOf = (params: unknown[]) => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as SQLInputValue[];

/** SQLite's bound-parameter limit before 3.32 (SQLITE_MAX_VARIABLE_NUMBER); node:sqlite's own is higher. */
const MAX_PARAMS = 999;

/** The most parameters any one statement bound, across every fake connection. */
let maxBound = 0;

function fakeDb(): Db {
  const sqlite = new DatabaseSync(':memory:');
  const prepare = (sql: string, params: unknown[]) => {
    maxBound = Math.max(maxBound, paramsOf(params).length);
    return sqlite.prepare(sql);
  };
  const fake = {
    execAsync: async (sql: string) => sqlite.exec(sql),
    getFirstAsync: async (sql: string, ...params: unknown[]) => prepare(sql, params).get(...paramsOf(params)) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) => prepare(sql, params).all(...paramsOf(params)),
    runAsync: async (sql: string, ...params: unknown[]) => {
      const { changes, lastInsertRowid } = prepare(sql, params).run(...paramsOf(params));
      return { changes: Number(changes), lastInsertRowId: Number(lastInsertRowid) };
    },
  };
  return fake as unknown as Db;
}

const userVersion = async (d: Db) => (await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;
const columnsOf = async (d: Db, table: string) =>
  (await d.getAllAsync<{ name: string; dflt_value: string | null; notnull: number }>(`PRAGMA table_info(${table})`));

const exercise = (id: string): SuggestedExercise => ({
  id,
  name: id,
  dose: { kind: 'reps', amount: 10, eachSide: false },
  cue: `${id} cue`,
  bodyArea: 'Neck',
});

const NOW = 1_000_000;

const state = (reminders: Reminder[]): CoreState => ({
  settings: defaultSettings,
  lastResponseAt: null,
  lastAppOpenAt: null,
  goalChanges: [],
  pauses: [],
  daysOff: [],
  reminders,
});

describe('migrations', () => {
  it('v3 -> v4 adds fallback, swapped_out and rotation to an existing DB and keeps its rows', async () => {
    const d = fakeDb();
    // A DB as #23 left it: the first three steps, at user_version 3, with history.
    for (const step of MIGRATIONS.slice(0, 3)) await step(d);
    await d.execAsync('PRAGMA user_version = 3');
    await d.runAsync(
      `INSERT INTO reminders (id, fires_at, suggestion, status, snoozes, refires_at, done_exercises) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      'r1',
      NOW - 1,
      JSON.stringify([exercise('A')]),
      'done',
      1,
      null,
      JSON.stringify([{ id: 'A', name: 'A', bodyArea: 'Neck' }]),
    );
    await d.runAsync(`INSERT INTO responses (reminder_id, kind, source, at) VALUES ('r1', 'Done', 'app', 1)`);

    await migrate(d);

    expect(await userVersion(d)).toBe(SCHEMA_VERSION);
    const columns = await columnsOf(d, 'reminders');
    expect(columns.find((c) => c.name === 'fallback')).toMatchObject({ dflt_value: '0', notnull: 1 });
    expect(columns.find((c) => c.name === 'swapped_out')).toMatchObject({ dflt_value: null, notnull: 0 });
    expect(columns.find((c) => c.name === 'rotation')).toMatchObject({ dflt_value: null, notnull: 0 });
    expect(await d.getAllAsync('SELECT id, status, snoozes, fallback, swapped_out, rotation FROM reminders')).toEqual([
      { id: 'r1', status: 'done', snoozes: 1, fallback: 0, swapped_out: null, rotation: null },
    ]);
    expect(await d.getAllAsync('SELECT reminder_id, kind FROM responses')).toEqual([{ reminder_id: 'r1', kind: 'Done' }]);
    // The existing Reminder loads with none of the new keys.
    expect((await loadState(d)).reminders[0]).not.toHaveProperty('fallback');
  });

  it('v3 -> v4 adds only the columns that are missing', async () => {
    const d = fakeDb();
    for (const step of MIGRATIONS.slice(0, 3)) await step(d);
    await d.execAsync('PRAGMA user_version = 3');
    await d.execAsync('ALTER TABLE reminders ADD COLUMN fallback INTEGER NOT NULL DEFAULT 0');

    await migrate(d);

    expect(await userVersion(d)).toBe(SCHEMA_VERSION);
    const names = (await columnsOf(d, 'reminders')).map((c) => c.name);
    expect(names.filter((n) => n === 'fallback')).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining(['swapped_out', 'rotation']));
  });

  it('v4 -> v5 adds dropped_by to an existing DB and keeps its rows', async () => {
    const d = fakeDb();
    // A DB as #24 left it: the first four steps, at user_version 4, with history.
    for (const step of MIGRATIONS.slice(0, 4)) await step(d);
    await d.execAsync('PRAGMA user_version = 4');
    await d.runAsync(
      `INSERT INTO reminders (id, fires_at, suggestion, status, snoozes, refires_at, fallback, swapped_out, rotation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      'r1',
      NOW - 1,
      JSON.stringify([exercise('A')]),
      'dropped',
      1,
      NOW + 1,
      0,
      JSON.stringify(['B']),
      2,
    );
    await d.runAsync(`INSERT INTO responses (reminder_id, kind, source, at) VALUES ('r1', 'Snooze', 'app', 1)`);

    await migrate(d);

    expect(SCHEMA_VERSION).toBe(5);
    expect(await userVersion(d)).toBe(5);
    const columns = await columnsOf(d, 'reminders');
    expect(columns.find((c) => c.name === 'dropped_by')).toMatchObject({ dflt_value: null, notnull: 0 });
    expect(await d.getAllAsync('SELECT id, status, snoozes, swapped_out, rotation, dropped_by FROM reminders')).toEqual([
      { id: 'r1', status: 'dropped', snoozes: 1, swapped_out: '["B"]', rotation: 2, dropped_by: null },
    ]);
    expect(await d.getAllAsync('SELECT reminder_id, kind FROM responses')).toEqual([{ reminder_id: 'r1', kind: 'Snooze' }]);
    // The existing dropped Reminder loads with no stored reason (read as closing).
    expect((await loadState(d)).reminders[0]).not.toHaveProperty('droppedBy');
  });

  it('v4 -> v5 adds dropped_by only if it is missing', async () => {
    const d = fakeDb();
    for (const step of MIGRATIONS.slice(0, 4)) await step(d);
    await d.execAsync('PRAGMA user_version = 4');
    await d.execAsync('ALTER TABLE reminders ADD COLUMN dropped_by TEXT NULL');

    await migrate(d);

    expect(await userVersion(d)).toBe(5);
    const names = (await columnsOf(d, 'reminders')).map((c) => c.name);
    expect(names.filter((n) => n === 'dropped_by')).toHaveLength(1);
  });
});

describe('saveState and loadState', () => {
  async function roundTrip(reminders: Reminder[]): Promise<Reminder[]> {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state(reminders), NOW);
    return (await loadState(d)).reminders;
  }

  it('round-trips a Reminder with fallback, swappedOut and rotation', async () => {
    const fired: Reminder = {
      id: 'fired',
      firesAt: NOW - 60_000,
      suggestion: [exercise('C')],
      status: 'scheduled',
      fallback: true,
      swappedOut: ['A', 'B'],
      rotation: 0,
    };
    const ahead: Reminder = {
      id: 'ahead',
      firesAt: NOW + 60_000,
      suggestion: [exercise('D'), exercise('E')],
      status: 'scheduled',
      rotation: 5,
    };
    expect(await roundTrip([fired, ahead])).toEqual([fired, ahead]);
  });

  it('keeps the keys absent on a Reminder without them', async () => {
    const plain: Reminder = { id: 'plain', firesAt: NOW - 60_000, suggestion: [exercise('A')], status: 'skipped' };
    const [loaded] = await roundTrip([plain]);
    expect(loaded).toEqual(plain);
    expect(Object.keys(loaded)).toEqual(Object.keys(plain));
  });

  it('round-trips a dropped Reminder with each droppedBy, and one with none stored', async () => {
    const dropped = (id: string, i: number): Reminder => ({
      id,
      firesAt: NOW - (i + 1) * 60_000,
      suggestion: [exercise('A')],
      status: 'dropped',
    });
    const reminders: Reminder[] = [
      { ...dropped('closing', 3), droppedBy: 'closing' },
      { ...dropped('pause', 2), droppedBy: 'pause' },
      { ...dropped('dayOff', 1), droppedBy: 'dayOff' },
      dropped('none', 0),
    ];
    const loaded = await roundTrip(reminders);
    expect(loaded).toEqual(reminders);
    expect(loaded[3]).not.toHaveProperty('droppedBy');
  });

  it('clears dropped_by when a later save no longer has droppedBy (a Correct)', async () => {
    const d = fakeDb();
    await migrate(d);
    const dropped: Reminder = {
      id: 'fired',
      firesAt: NOW - 60_000,
      suggestion: [exercise('A')],
      status: 'dropped',
      droppedBy: 'pause',
    };
    await saveState(d, state([dropped]), NOW);
    const corrected: Reminder = { id: 'fired', firesAt: NOW - 60_000, suggestion: [exercise('A')], status: 'skipped' };
    await saveState(d, state([corrected]), NOW);
    expect(await d.getAllAsync('SELECT dropped_by FROM reminders')).toEqual([{ dropped_by: null }]);
    expect((await loadState(d)).reminders).toEqual([corrected]);
  });

  it('writes a Swap on a fired Reminder over its stored row', async () => {
    const d = fakeDb();
    await migrate(d);
    const before: Reminder = { id: 'fired', firesAt: NOW - 60_000, suggestion: [exercise('A')], status: 'scheduled' };
    await saveState(d, state([before]), NOW);
    const swapped: Reminder = { ...before, suggestion: [exercise('B')], swappedOut: ['A'] };
    await saveState(d, state([swapped]), NOW);
    expect((await loadState(d)).reminders).toEqual([swapped]);
  });

  it('saves more Reminders than one multi-row INSERT holds, within the bound-parameter limit', async () => {
    maxBound = 0;
    const many: Reminder[] = Array.from({ length: 250 }, (_, i) => ({
      id: `r${i}`,
      firesAt: NOW + (i + 1) * 60_000,
      suggestion: [exercise('A')],
      status: 'scheduled',
      fallback: true,
      swappedOut: ['B'],
      rotation: i % 6,
    }));
    expect(await roundTrip(many)).toEqual(many);
    expect(maxBound).toBeLessThanOrEqual(MAX_PARAMS);
  });

  it('saves more dropped Reminders, each with its droppedBy, than one multi-row INSERT holds, within the limit', async () => {
    maxBound = 0;
    const reasons = ['closing', 'pause', 'dayOff'] as const;
    // All fired, so every row goes through the upsert; 250 crosses two batch boundaries.
    const many: Reminder[] = Array.from({ length: 250 }, (_, i) => ({
      id: `r${i}`,
      firesAt: NOW - (250 - i) * 60_000,
      suggestion: [exercise('A')],
      status: 'dropped',
      snoozes: 1,
      refiresAt: NOW - (250 - i) * 60_000 + 1,
      fallback: true,
      swappedOut: ['B'],
      rotation: i % 6,
      droppedBy: reasons[i % 3],
    }));
    expect(await roundTrip(many)).toEqual(many);
    expect(maxBound).toBeGreaterThan(900);
    expect(maxBound).toBeLessThanOrEqual(MAX_PARAMS);
  });
});

describe('Pauses and Days Off', () => {
  it('round-trips the Pause history and the Days Off', async () => {
    const d = fakeDb();
    await migrate(d);
    const saved: CoreState = {
      ...state([]),
      pauses: [
        { from: NOW + 60_000, until: NOW + 120_000 },
        { from: NOW + 600_000, until: NOW + 4_200_000 },
      ],
      daysOff: [
        { year: 2026, month: 11, day: 10 },
        { year: 2026, month: 11, day: 12 },
      ],
    };
    await saveState(d, saved, NOW);
    const loaded = await loadState(d);
    expect(loaded.pauses).toEqual(saved.pauses);
    expect(loaded.daysOff).toEqual(saved.daysOff);
  });

  it('reads no Pauses and no Days Off from a DB stored before #26', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state([]), NOW);
    // As a pre-#26 DB: neither key was ever written.
    await d.runAsync(`DELETE FROM meta WHERE key IN ('pauses', 'days_off')`);
    const loaded = await loadState(d);
    expect(loaded.pauses).toEqual([]);
    expect(loaded.daysOff).toEqual([]);
  });
});

describe('the onboarding flag (#31)', () => {
  it('is not done on a fresh DB', async () => {
    const d = fakeDb();
    await migrate(d);
    expect(await isOnboardingDone(d)).toBe(false);
  });

  it('is done on an install whose settings were stored before #31', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state([]), NOW);
    // As a pre-#31 DB: the flag was never written.
    await d.runAsync(`DELETE FROM meta WHERE key = 'onboarding_done'`);
    expect(await isOnboardingDone(d)).toBe(true);
  });

  it('is done once marked', async () => {
    const d = fakeDb();
    await migrate(d);
    await markOnboardingDone(d);
    expect(await isOnboardingDone(d)).toBe(true);
  });

  it('stays not done on a fresh DB after the first save (the Rearm at launch stores the settings)', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state([]), NOW);
    await saveState(d, state([]), NOW + 1);
    expect(await isOnboardingDone(d)).toBe(false);
  });

  it('stays done on an install stored before #31 after a later save', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state([]), NOW);
    await d.runAsync(`DELETE FROM meta WHERE key = 'onboarding_done'`);
    await saveState(d, state([]), NOW + 1);
    expect(await isOnboardingDone(d)).toBe(true);
  });

  it('is done once marked after the first save on a fresh DB', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state([]), NOW);
    await markOnboardingDone(d);
    expect(await isOnboardingDone(d)).toBe(true);
  });
});
