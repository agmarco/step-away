/**
 * The core's state in SQLite. Thin: rows <-> CoreState, plus the guarded
 * Response updates (Done, Skip, Snooze) and the Response log. The schema is in
 * migrations.ts. Every function taking a `Db` is meant
 * to run inside `write()` (one BEGIN IMMEDIATE transaction).
 */
import {
  defaultSettings,
  EQUIPMENT,
  MAX_SNOOZES,
  type CoreState,
  type DoneExercise,
  type DropReason,
  type GoalChange,
  type Instant,
  type LocalDate,
  type Pause,
  type Reminder,
  type ResponseKind,
  type Settings,
} from '../core';
import { exercises } from '../library';
import { db, write, type Db } from './db';
import { withBodyAreas } from './suggestionBackfill';

/**
 * Who handled a Response: the background task or the foreground response
 * listener (notification action taps), or the app's own screens (the guided
 * flow). `guided-late` is a guided finish saved as a correction, because its
 * Reminder was no longer outstanding (core/guidedFinish.ts).
 */
export type Source = 'bg-task' | 'fg-listener' | 'app' | 'guided-late';

interface ReminderRow {
  id: string;
  fires_at: number;
  suggestion: string;
  status: string;
  snoozes: number;
  refires_at: number | null;
  done_exercises: string | null;
  fallback: number;
  swapped_out: string | null;
  rotation: number | null;
  dropped_by: string | null;
}

const META = {
  settings: 'settings',
  lastResponseAt: 'last_response_at',
  lastAppOpenAt: 'last_app_open_at',
  goalChanges: 'goal_changes',
  pauses: 'pauses',
  daysOff: 'days_off',
  badges: 'badges',
  achievementsSeenAt: 'achievements_seen_at',
  onboardingDone: 'onboarding_done',
} as const;

/**
 * Rows per multi-row INSERT: 90 rows of 11 params bind 990, under SQLite's
 * bound-parameter limit (999 before 3.32). 91 rows would bind 1001.
 */
const BATCH = 90;

/**
 * Stored settings over the defaults: settings stored before a field existed
 * (e.g. #21's, without `snoozeMinutes`) get its default. Equipment that is no
 * longer one of the types (kettlebell, medicine ball, exercise ball and foam
 * roller left in #20) is dropped, so the next ChangeSettings isn't rejected
 * for a stale value.
 */
function loadSettings(json: string): Settings {
  const settings: Settings = { ...defaultSettings, ...(JSON.parse(json) as Partial<Settings>) };
  const known = new Set<string>(EQUIPMENT);
  return { ...settings, equipment: settings.equipment.filter((e) => known.has(e)) };
}

export async function loadState(d: Db): Promise<CoreState> {
  const meta = new Map(
    (await d.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM meta')).map((m) => [m.key, m.value]),
  );
  const rows = await d.getAllAsync<ReminderRow>(
    `SELECT id, fires_at, suggestion, status, snoozes, refires_at, done_exercises, fallback, swapped_out, rotation, dropped_by
     FROM reminders ORDER BY fires_at`,
  );
  const instant = (key: string): Instant | null => (meta.has(key) ? Number(meta.get(key)) : null);
  const settings = meta.get(META.settings);
  const goalChanges = meta.get(META.goalChanges);
  const pauses = meta.get(META.pauses);
  const daysOff = meta.get(META.daysOff);
  const badges = meta.get(META.badges);
  return {
    settings: settings ? loadSettings(settings) : defaultSettings,
    lastResponseAt: instant(META.lastResponseAt),
    lastAppOpenAt: instant(META.lastAppOpenAt),
    // Absent before #25: no Daily Goal change recorded, so the default goal.
    goalChanges: goalChanges ? (JSON.parse(goalChanges) as GoalChange[]) : [],
    // Absent before #26: no Pause and no Day Off recorded.
    pauses: pauses ? (JSON.parse(pauses) as Pause[]) : [],
    daysOff: daysOff ? (JSON.parse(daysOff) as LocalDate[]) : [],
    // Absent before #28: no Badge unlocked and Achievements never opened.
    badges: badges ? (JSON.parse(badges) as CoreState['badges']) : [],
    achievementsSeenAt: instant(META.achievementsSeenAt),
    reminders: rows.map(
      (r): Reminder => ({
        id: r.id,
        firesAt: r.fires_at,
        // Suggestions stored before #23 lack `bodyArea`: filled in from the library by Id.
        suggestion: withBodyAreas(JSON.parse(r.suggestion) as Reminder['suggestion'], exercises),
        status: r.status as Reminder['status'],
        // The core's optional fields: absent means 0 Snoozes, no re-fire, nothing done,
        // not a fallback, nothing swapped out, no Strict rotation and no stored drop
        // reason (read as closing).
        ...(r.snoozes > 0 && { snoozes: r.snoozes }),
        ...(r.refires_at !== null && { refiresAt: r.refires_at }),
        ...(r.done_exercises !== null && { done: JSON.parse(r.done_exercises) as DoneExercise[] }),
        ...(r.fallback === 1 && { fallback: true as const }),
        ...(r.swapped_out !== null && { swappedOut: JSON.parse(r.swapped_out) as string[] }),
        ...(r.rotation !== null && { rotation: r.rotation }),
        ...(r.dropped_by !== null && { droppedBy: r.dropped_by as DropReason }),
      }),
    ),
  };
}

/**
 * Writes `state` back: Reminders after `now` (the chain ahead) are replaced by
 * the state's, fired ones are upserted with their settled status (Missed,
 * dropped, with what dropped it), Snooze count, re-fire, the Exercises
 * done, and a Swap's new Suggestion and `swappedOut`. A Correct out of
 * dropped clears `dropped_by`. `now` must be the clock time the core
 * computed `state` at. The first save on a fresh DB also marks onboarding
 * pending (isOnboardingDone).
 *
 * With `previous`, the state as loaded in the same transaction (#39), it
 * writes only the Reminders that are new or differ from it in a stored field
 * (one upsert each) and deletes those it holds that `state` no longer has;
 * every other row stays as it is, whether fired or ahead. Without it, every
 * row is written.
 */
export async function saveState(d: Db, state: CoreState, now: Instant, previous?: CoreState): Promise<void> {
  // The first save on a fresh DB (no settings stored yet) marks onboarding pending,
  // before the settings land and would read as an existing install (isOnboardingDone).
  await d.runAsync(
    `INSERT INTO meta (key, value) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM meta WHERE key = ?)
     ON CONFLICT(key) DO NOTHING`,
    META.onboardingDone,
    ONBOARDING_PENDING,
    META.settings,
  );
  await setMeta(d, META.settings, JSON.stringify(state.settings));
  await setMeta(d, META.lastResponseAt, state.lastResponseAt === null ? null : String(state.lastResponseAt));
  await setMeta(d, META.lastAppOpenAt, state.lastAppOpenAt === null ? null : String(state.lastAppOpenAt));
  await setMeta(d, META.goalChanges, JSON.stringify(state.goalChanges));
  await setMeta(d, META.pauses, JSON.stringify(state.pauses));
  await setMeta(d, META.daysOff, JSON.stringify(state.daysOff));
  await setMeta(d, META.badges, JSON.stringify(state.badges));
  await setMeta(d, META.achievementsSeenAt, state.achievementsSeenAt === null ? null : String(state.achievementsSeenAt));

  if (previous) {
    const before = new Map(previous.reminders.map((r) => [r.id, rowOf(r)]));
    const ids = new Set(state.reminders.map((r) => r.id));
    const gone = previous.reminders.filter((r) => !ids.has(r.id)).map((r) => r.id);
    for (let i = 0; i < gone.length; i += DELETE_BATCH) {
      const batch = gone.slice(i, i + DELETE_BATCH);
      await d.runAsync(`DELETE FROM reminders WHERE id IN (${batch.map(() => '?').join(', ')})`, batch);
    }
    const changed = state.reminders.map(rowOf).filter((row) => {
      const old = before.get(row[0] as string);
      return !old || row.some((v, k) => v !== old[k]);
    });
    await upsertRows(d, changed);
  } else {
    await d.runAsync('DELETE FROM reminders WHERE fires_at > ?', now);
    await upsertRows(d, state.reminders.map(rowOf));
  }
}

/** The SQLite parameters bound per DELETE: SQLite's bound-parameter limit (999 before 3.32), and then some. */
const DELETE_BATCH = 900;

type Row = (string | number | null)[];

/** A Reminder as its `reminders` row, in the column order of `upsertRows`. */
function rowOf(r: Reminder): Row {
  return [
    r.id,
    r.firesAt,
    JSON.stringify(r.suggestion),
    r.status,
    r.snoozes ?? 0,
    r.refiresAt ?? null,
    r.done ? JSON.stringify(r.done) : null,
    r.fallback ? 1 : 0,
    r.swappedOut ? JSON.stringify(r.swappedOut) : null,
    r.rotation ?? null,
    r.droppedBy ?? null,
  ];
}

/** Inserts `rows` (see `rowOf`), updating every column of a row whose Id is already stored. */
async function upsertRows(d: Db, rows: Row[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await d.runAsync(
      `INSERT INTO reminders (id, fires_at, suggestion, status, snoozes, refires_at, done_exercises, fallback, swapped_out, rotation, dropped_by)
       VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
       ON CONFLICT(id) DO UPDATE SET fires_at = excluded.fires_at, suggestion = excluded.suggestion,
         status = excluded.status, snoozes = excluded.snoozes, refires_at = excluded.refires_at,
         done_exercises = excluded.done_exercises, fallback = excluded.fallback,
         swapped_out = excluded.swapped_out, rotation = excluded.rotation, dropped_by = excluded.dropped_by`,
      batch.flat(),
    );
  }
}

/**
 * The core's guard for a final Response (Done, Skip) in SQL, binding (id, now):
 * this fired Reminder is still `scheduled`. A pending Snooze re-fire doesn't
 * block it: the Response cancels the re-fire (CLEARS_PENDING_REFIRE).
 */
const ACCEPTS_FINAL = `id = ? AND status = 'scheduled' AND fires_at <= ?`;

/** Binding (now): drops a re-fire still ahead, keeps one that has fired. `snoozes` stays. */
const CLEARS_PENDING_REFIRE = `refires_at = CASE WHEN refires_at > ? THEN NULL ELSE refires_at END`;

/**
 * The core's Snooze guard in SQL, binding (id, now, now): the final guard,
 * plus its Snooze re-fire (if any) has fired too.
 */
const ACCEPTS_SNOOZE = `${ACCEPTS_FINAL} AND (refires_at IS NULL OR refires_at <= ?)`;

/** The guarded Skip. True only when exactly one row changed; anything else lost the race. */
export async function guardedSkip(d: Db, reminderId: string, now: Instant): Promise<boolean> {
  const res = await d.runAsync(
    `UPDATE reminders SET status = 'skipped', ${CLEARS_PENDING_REFIRE} WHERE ${ACCEPTS_FINAL}`,
    now,
    reminderId,
    now,
  );
  return res.changes === 1;
}

/**
 * The guarded Done: the Skip guard; `done` is what the core recorded (at least
 * one Exercise; none is a Skip). True only when exactly one row changed.
 */
export async function guardedDone(d: Db, reminderId: string, done: DoneExercise[], now: Instant): Promise<boolean> {
  const res = await d.runAsync(
    `UPDATE reminders SET status = 'done', done_exercises = ?, ${CLEARS_PENDING_REFIRE} WHERE ${ACCEPTS_FINAL}`,
    JSON.stringify(done),
    now,
    reminderId,
    now,
  );
  return res.changes === 1;
}

/**
 * The guarded Snooze: the Snooze guard plus fewer than MAX_SNOOZES Snoozes so
 * far (core/notification.ts). `refiresAt` is the re-fire the core
 * computed. True only when exactly one row changed.
 */
export async function guardedSnooze(d: Db, reminderId: string, refiresAt: Instant, now: Instant): Promise<boolean> {
  const res = await d.runAsync(
    `UPDATE reminders SET snoozes = snoozes + 1, refires_at = ? WHERE ${ACCEPTS_SNOOZE} AND snoozes < ?`,
    refiresAt,
    reminderId,
    now,
    now,
    MAX_SNOOZES,
  );
  return res.changes === 1;
}

/**
 * One row per accepted Response, for the device check: what the core made of
 * it (a Done with nothing done is logged as a Skip). Write it only when the
 * guarded update won.
 */
export async function logResponse(d: Db, reminderId: string, kind: ResponseKind, source: Source, at: Instant) {
  await d.runAsync('INSERT INTO responses (reminder_id, kind, source, at) VALUES (?, ?, ?, ?)', reminderId, kind, source, at);
}

/** `onboarding_done`'s values: pending (set by the first save on a fresh DB) and done. */
const ONBOARDING_PENDING = '0';
const ONBOARDING_DONE = '1';

const metaValue = async (d: Db, key: string) =>
  (await d.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key))?.value ?? null;

/** Upserts one meta key; null deletes it. */
const setMeta = async (d: Db, key: string, value: string | null) => {
  if (value === null) await d.runAsync('DELETE FROM meta WHERE key = ?', key);
  else await d.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
};

/**
 * Whether onboarding (#31) has run on this install. The `onboarding_done`
 * meta key decides when set: done, or pending (the first save on a fresh DB
 * writes it, see saveState). Absent, it's an install from before #31 when
 * settings are stored (done: it skips onboarding), else a fresh DB (not done).
 */
export async function isOnboardingDone(d: Db): Promise<boolean> {
  const flag = await metaValue(d, META.onboardingDone);
  if (flag !== null) return flag === ONBOARDING_DONE;
  return (await metaValue(d, META.settings)) !== null;
}

/** Onboarding finished (declining notifications included): it doesn't run again. */
export async function markOnboardingDone(d: Db): Promise<void> {
  await setMeta(d, META.onboardingDone, ONBOARDING_DONE);
}

/** A read for screens, outside any write transaction. */
export async function readState(): Promise<CoreState> {
  return loadState(await db());
}

/** For screens: whether onboarding has run, outside any write transaction. */
export async function readOnboardingDone(): Promise<boolean> {
  return isOnboardingDone(await db());
}

/** For screens: onboarding finished, in its own write transaction. */
export function finishOnboarding(): Promise<void> {
  return write(markOnboardingDone);
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Called after a write in this JS context committed new state. Returns an unsubscribe. */
export function onStateChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyStateChanged() {
  for (const l of listeners) l();
}
