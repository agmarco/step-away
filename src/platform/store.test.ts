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
import { migrate } from './migrations';

vi.mock('expo-sqlite', () => ({}));
// The bundled library pulls in photos; the backfill only needs Ids, and every snapshot here has its Body Area.
vi.mock('../library', () => ({ exercises: [] }));

const { loadState, saveState } = await import('./store');
const { isOnboardingDone, markOnboardingDone } = await import('./store');

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
  badges: [],
  achievementsSeenAt: null,
  reminders,
});

describe('the v5 baseline (#68)', () => {
  type Column = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };
  const col = (name: string, type: string, notnull: 0 | 1, dflt_value: string | null = null, pk: 0 | 1 = 0): Column => ({
    name,
    type,
    notnull,
    dflt_value,
    pk,
  });

  /**
   * The v5 schema as the five steps of #21-#26 left it on the owner's phone:
   * written from the schema those steps produced and verified against them in
   * #68 CP1. Literal on purpose: it must not follow the baseline in migrations.ts.
   * `reminders` lists its columns in ALTER order, the phone's order.
   */
  const V5_SCHEMA = {
    objects: [
      { type: 'index', name: 'reminders_fires_at', tbl_name: 'reminders' },
      { type: 'index', name: 'sqlite_autoindex_meta_1', tbl_name: 'meta' },
      { type: 'index', name: 'sqlite_autoindex_reminders_1', tbl_name: 'reminders' },
      { type: 'table', name: 'meta', tbl_name: 'meta' },
      { type: 'table', name: 'reminders', tbl_name: 'reminders' },
      { type: 'table', name: 'responses', tbl_name: 'responses' },
      // AUTOINCREMENT on responses.id.
      { type: 'table', name: 'sqlite_sequence', tbl_name: 'sqlite_sequence' },
    ],
    reminders: [
      col('id', 'TEXT', 0, null, 1),
      col('fires_at', 'INTEGER', 1),
      col('suggestion', 'TEXT', 1),
      col('status', 'TEXT', 1),
      col('snoozes', 'INTEGER', 1, '0'),
      col('refires_at', 'INTEGER', 0),
      col('done_exercises', 'TEXT', 0),
      col('fallback', 'INTEGER', 1, '0'),
      col('swapped_out', 'TEXT', 0),
      col('rotation', 'INTEGER', 0),
      col('dropped_by', 'TEXT', 0),
    ],
    meta: [col('key', 'TEXT', 0, null, 1), col('value', 'TEXT', 1)],
    responses: [
      col('id', 'INTEGER', 0, null, 1),
      col('reminder_id', 'TEXT', 1),
      col('kind', 'TEXT', 1),
      col('source', 'TEXT', 1),
      col('at', 'INTEGER', 1),
    ],
    remindersIndexes: [
      { name: 'reminders_fires_at', unique: 0, origin: 'c', partial: 0, columns: ['fires_at'] },
      { name: 'sqlite_autoindex_reminders_1', unique: 1, origin: 'pk', partial: 0, columns: ['id'] },
    ],
  };

  /**
   * The phone's schema at each version, as literal SQL: the #21 tables, then
   * each ALTER the steps of #22-#26 ran. Literal on purpose, like V5_SCHEMA.
   */
  const PHONE_SQL_BY_VERSION = [
    `CREATE TABLE reminders (
       id TEXT PRIMARY KEY,
       fires_at INTEGER NOT NULL,
       suggestion TEXT NOT NULL,
       status TEXT NOT NULL);
     CREATE INDEX reminders_fires_at ON reminders (fires_at);
     CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
     CREATE TABLE responses (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       reminder_id TEXT NOT NULL,
       kind TEXT NOT NULL,
       source TEXT NOT NULL,
       at INTEGER NOT NULL);`,
    `ALTER TABLE reminders ADD COLUMN snoozes INTEGER NOT NULL DEFAULT 0;
     ALTER TABLE reminders ADD COLUMN refires_at INTEGER NULL;`,
    'ALTER TABLE reminders ADD COLUMN done_exercises TEXT NULL;',
    `ALTER TABLE reminders ADD COLUMN fallback INTEGER NOT NULL DEFAULT 0;
     ALTER TABLE reminders ADD COLUMN swapped_out TEXT NULL;
     ALTER TABLE reminders ADD COLUMN rotation INTEGER NULL;`,
    'ALTER TABLE reminders ADD COLUMN dropped_by TEXT NULL;',
  ];

  /** A DB built the way the phone's was, stopped at `version`. */
  async function phoneDbAt(d: Db, version: number) {
    for (const sql of PHONE_SQL_BY_VERSION.slice(0, version)) await d.execAsync(sql);
    await d.execAsync(`PRAGMA user_version = ${version}`);
  }

  /** The live schema, in V5_SCHEMA's shape. */
  async function schemaOf(d: Db) {
    const columns = (table: string) =>
      d.getAllAsync<Column>(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`);
    const indexes = await d.getAllAsync<{ name: string; unique: number; origin: string; partial: number }>(
      `SELECT name, "unique", origin, partial FROM pragma_index_list('reminders') ORDER BY name`,
    );
    return {
      objects: await d.getAllAsync('SELECT type, name, tbl_name FROM sqlite_master ORDER BY type, name'),
      reminders: await columns('reminders'),
      meta: await columns('meta'),
      responses: await columns('responses'),
      remindersIndexes: await Promise.all(
        indexes.map(async (i) => ({
          ...i,
          columns: (await d.getAllAsync<{ name: string }>(`SELECT name FROM pragma_index_info('${i.name}') ORDER BY seqno`)).map(
            (c) => c.name,
          ),
        })),
      ),
    };
  }

  const rowsOf = async (d: Db) => ({
    reminders: await d.getAllAsync('SELECT * FROM reminders ORDER BY rowid'),
    meta: await d.getAllAsync('SELECT * FROM meta ORDER BY key'),
    responses: await d.getAllAsync('SELECT * FROM responses ORDER BY id'),
    sequence: await d.getAllAsync('SELECT * FROM sqlite_sequence ORDER BY name'),
  });

  /** fakeDb that counts the transactions opened on it. */
  function countingDb() {
    const d = fakeDb();
    const counter = { begins: 0 };
    const execAsync = d.execAsync.bind(d);
    d.execAsync = async (sql: string) => {
      if (/^\s*BEGIN IMMEDIATE\b/i.test(sql)) counter.begins += 1;
      return execAsync(sql);
    };
    return { d, counter };
  }

  it('creates the v5 schema on a fresh DB, columns in the phone order', async () => {
    const d = fakeDb();

    await migrate(d);

    expect(await userVersion(d)).toBe(5);
    expect(await schemaOf(d)).toEqual(V5_SCHEMA);
  });

  it('leaves a v5 DB with history as it is', async () => {
    const d = fakeDb();
    await phoneDbAt(d, 5);
    const insert = `INSERT INTO reminders
       (id, fires_at, suggestion, status, snoozes, refires_at, done_exercises, fallback, swapped_out, rotation, dropped_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const done = [{ id: 'A', name: 'A', bodyArea: 'Neck' }];
    await d.runAsync(insert, 'done', NOW - 3, JSON.stringify([exercise('A')]), 'done', 1, null, JSON.stringify(done), 0, null, 3);
    await d.runAsync(insert, 'dropped', NOW - 2, JSON.stringify([exercise('B')]), 'dropped', 2, NOW - 1, null, 1, '["C"]', null, 'pause');
    await d.runAsync(insert, 'missed', NOW - 1, JSON.stringify([exercise('D')]), 'missed', 0, null, null, 0, null, null, null);
    await d.runAsync(insert, 'ahead', NOW + 1, JSON.stringify([exercise('E')]), 'scheduled', 0, null, null, 0, null, 4, null);
    await d.runAsync(`INSERT INTO meta (key, value) VALUES ('settings', ?)`, JSON.stringify(defaultSettings));
    await d.runAsync(`INSERT INTO meta (key, value) VALUES ('last_response_at', ?)`, String(NOW - 3));
    await d.runAsync(`INSERT INTO responses (reminder_id, kind, source, at) VALUES ('done', 'Done', 'app', ?)`, NOW - 3);
    await d.runAsync(`INSERT INTO responses (reminder_id, kind, source, at) VALUES ('dropped', 'Snooze', 'bg-task', ?)`, NOW - 2);
    const schema = await schemaOf(d);
    const rows = await rowsOf(d);

    await migrate(d);

    expect(await userVersion(d)).toBe(5);
    expect(await schemaOf(d)).toEqual(schema);
    expect(await rowsOf(d)).toEqual(rows);
    const loaded = await loadState(d);
    expect(loaded.settings).toEqual(defaultSettings);
    expect(loaded.reminders.map((r) => [r.id, r.status])).toEqual([
      ['done', 'done'],
      ['dropped', 'dropped'],
      ['missed', 'missed'],
      ['ahead', 'scheduled'],
    ]);
    expect(loaded.reminders[1]).toMatchObject({ snoozes: 2, refiresAt: NOW - 1, fallback: true, swappedOut: ['C'], droppedBy: 'pause' });
    expect(loaded.reminders[0]).toMatchObject({ done, rotation: 3 });
  });

  it('brings a fresh DB to v5 in one step', async () => {
    const { d, counter } = countingDb();

    await migrate(d);

    expect(await userVersion(d)).toBe(5);
    expect(counter.begins).toBe(1);
  });

  it.each([1, 2, 3, 4])('rejects a DB at user_version %i as unsupported and leaves it as it is', async (version) => {
    const d = fakeDb();
    // No such DB exists any more: the phone is at v5. One would be a dev DB left behind.
    await phoneDbAt(d, version);
    const schema = await schemaOf(d);

    await expect(migrate(d)).rejects.toThrow(new RegExp(`user_version ${version}.*unsupported`, 'i'));

    expect(await userVersion(d)).toBe(version);
    expect(await schemaOf(d)).toEqual(schema);
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

describe('saveState against the state it was loaded as (#39)', () => {
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

  /** 200 fired Reminders (the last one outstanding, the rest Done) and 100 in the chain ahead. */
  const history: Reminder[] = [
    ...Array.from(
      { length: 200 },
      (_, i): Reminder => ({
        id: `fired${i}`,
        firesAt: NOW - (200 - i) * 60_000,
        suggestion: [exercise('A')],
        status: i === 199 ? 'scheduled' : 'done',
        ...(i < 199 && { done: [{ id: 'A', name: 'A', bodyArea: 'Neck' as const }] }),
      }),
    ),
    ...Array.from(
      { length: 100 },
      (_, i): Reminder => ({
        id: `ahead${i}`,
        firesAt: NOW + (i + 1) * 60_000,
        suggestion: [exercise('B')],
        status: 'scheduled',
      }),
    ),
  ];

  /** A Skip on the outstanding Reminder: one row changes, nothing else. */
  const skipOutstanding = (s: CoreState): CoreState => ({
    ...s,
    lastResponseAt: NOW,
    reminders: s.reminders.map((r) => (r.id === 'fired199' ? { ...r, status: 'skipped' } : r)),
  });

  it('writes only the changed Reminder, not every row', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state(history), NOW);
    const loaded = await loadState(d);
    const rowWrites = await countRowWrites(d);

    await saveState(d, skipOutstanding(loaded), NOW, loaded);

    expect(await rowWrites()).toBe(1);
  });

  it('round-trips the changed state: a Skip, a Reminder dropped from the chain ahead and one added', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state(history), NOW);
    const loaded = await loadState(d);
    const added: Reminder = { id: 'added', firesAt: NOW + 500 * 60_000, suggestion: [exercise('C')], status: 'scheduled' };
    const changed: CoreState = {
      ...skipOutstanding(loaded),
      reminders: [...skipOutstanding(loaded).reminders.filter((r) => r.id !== 'ahead99'), added],
    };

    await saveState(d, changed, NOW, loaded);

    expect(await loadState(d)).toEqual(changed);
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

describe('Badges and the Achievements visit (#28)', () => {
  it('round-trips the Badges, in unlock order, and when Achievements was last opened', async () => {
    const d = fakeDb();
    await migrate(d);
    const saved: CoreState = {
      ...state([]),
      badges: [
        { id: 'done-1', unlockedAt: NOW - 600_000 },
        { id: 'perfect-day', unlockedAt: NOW - 60_000 },
        { id: 'balance', unlockedAt: NOW - 60_000 },
      ],
      achievementsSeenAt: NOW - 300_000,
    };
    await saveState(d, saved, NOW);
    const loaded = await loadState(d);
    expect(loaded.badges).toEqual([
      { id: 'done-1', unlockedAt: NOW - 600_000 },
      { id: 'perfect-day', unlockedAt: NOW - 60_000 },
      { id: 'balance', unlockedAt: NOW - 60_000 },
    ]);
    expect(loaded.achievementsSeenAt).toBe(NOW - 300_000);
  });

  it('round-trips Achievements never opened', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, { ...state([]), achievementsSeenAt: NOW - 300_000 }, NOW);
    await saveState(d, { ...state([]), badges: [{ id: 'done-1', unlockedAt: NOW }] }, NOW);
    const loaded = await loadState(d);
    expect(loaded.badges).toEqual([{ id: 'done-1', unlockedAt: NOW }]);
    expect(loaded.achievementsSeenAt).toBeNull();
  });

  it('reads no Badges and Achievements never opened from a DB stored before #28', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, { ...state([]), badges: [{ id: 'done-1', unlockedAt: NOW }], achievementsSeenAt: NOW }, NOW);
    // As a pre-#28 DB: neither key was ever written.
    await d.runAsync(`DELETE FROM meta WHERE key IN ('badges', 'achievements_seen_at')`);
    const loaded = await loadState(d);
    expect(loaded.badges).toEqual([]);
    expect(loaded.achievementsSeenAt).toBeNull();
  });
});

describe('Dose overrides (#30)', () => {
  it('round-trips the Dose overrides', async () => {
    const d = fakeDb();
    await migrate(d);
    const saved: CoreState = {
      ...state([]),
      settings: { ...defaultSettings, doseOverrides: { Neck_Turn: { kind: 'seconds', amount: 25, eachSide: true } } },
    };
    await saveState(d, saved, NOW);
    expect((await loadState(d)).settings.doseOverrides).toEqual({
      Neck_Turn: { kind: 'seconds', amount: 25, eachSide: true },
    });
  });

  it('reads no Dose overrides from settings stored before #30', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state([]), NOW);
    // As pre-#30 settings: the stored JSON has no `doseOverrides` key.
    const { doseOverrides: _, ...before } = defaultSettings;
    await d.runAsync(`UPDATE meta SET value = ? WHERE key = 'settings'`, JSON.stringify(before));
    expect((await loadState(d)).settings.doseOverrides).toEqual({});
  });
});

describe('Equipment that left v1 (#20)', () => {
  it('drops a stored Equipment that is no longer one of the types, keeping the rest in order', async () => {
    const d = fakeDb();
    await migrate(d);
    await saveState(d, state([]), NOW);
    // As settings stored when kettlebell and foam roller were still Equipment.
    const stored = { ...defaultSettings, equipment: ['kettlebell', 'dumbbells', 'foam roller', 'resistance bands'] };
    await d.runAsync(`UPDATE meta SET value = ? WHERE key = 'settings'`, JSON.stringify(stored));
    expect((await loadState(d)).settings.equipment).toEqual(['dumbbells', 'resistance bands']);
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
