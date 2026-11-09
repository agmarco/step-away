/**
 * The core's state in SQLite. Thin: rows <-> CoreState, plus the guarded
 * Response updates (Done, Skip, Snooze) and the Response log. The schema is in
 * migrations.ts. Every function taking a `Db` is meant
 * to run inside `write()` (one BEGIN IMMEDIATE transaction).
 */
import {
  defaultSettings,
  MAX_SNOOZES,
  type CoreState,
  type DoneExercise,
  type GoalChange,
  type Instant,
  type Reminder,
  type ResponseKind,
  type Settings,
} from '../core';
import { exercises } from '../library';
import { db, type Db } from './db';
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
}

const META = {
  settings: 'settings',
  lastResponseAt: 'last_response_at',
  lastAppOpenAt: 'last_app_open_at',
  goalChanges: 'goal_changes',
} as const;

/**
 * Rows per multi-row INSERT: 90 rows of 10 params bind 900, under SQLite's
 * bound-parameter limit (999 before 3.32). 100 rows would bind 1000.
 */
const BATCH = 90;

export async function loadState(d: Db): Promise<CoreState> {
  const meta = new Map(
    (await d.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM meta')).map((m) => [m.key, m.value]),
  );
  const rows = await d.getAllAsync<ReminderRow>(
    `SELECT id, fires_at, suggestion, status, snoozes, refires_at, done_exercises, fallback, swapped_out, rotation
     FROM reminders ORDER BY fires_at`,
  );
  const instant = (key: string): Instant | null => (meta.has(key) ? Number(meta.get(key)) : null);
  const settings = meta.get(META.settings);
  const goalChanges = meta.get(META.goalChanges);
  return {
    // Over the defaults: settings stored before a field existed (e.g. #21's, without `snoozeMinutes`) get its default.
    settings: settings ? { ...defaultSettings, ...(JSON.parse(settings) as Partial<Settings>) } : defaultSettings,
    lastResponseAt: instant(META.lastResponseAt),
    lastAppOpenAt: instant(META.lastAppOpenAt),
    // Absent before #25: no Daily Goal change recorded, so the default goal.
    goalChanges: goalChanges ? (JSON.parse(goalChanges) as GoalChange[]) : [],
    reminders: rows.map(
      (r): Reminder => ({
        id: r.id,
        firesAt: r.fires_at,
        // Suggestions stored before #23 lack `bodyArea`: filled in from the library by Id.
        suggestion: withBodyAreas(JSON.parse(r.suggestion) as Reminder['suggestion'], exercises),
        status: r.status as Reminder['status'],
        // The core's optional fields: absent means 0 Snoozes, no re-fire, nothing done,
        // not a fallback, nothing swapped out and no Strict rotation.
        ...(r.snoozes > 0 && { snoozes: r.snoozes }),
        ...(r.refires_at !== null && { refiresAt: r.refires_at }),
        ...(r.done_exercises !== null && { done: JSON.parse(r.done_exercises) as DoneExercise[] }),
        ...(r.fallback === 1 && { fallback: true as const }),
        ...(r.swapped_out !== null && { swappedOut: JSON.parse(r.swapped_out) as string[] }),
        ...(r.rotation !== null && { rotation: r.rotation }),
      }),
    ),
  };
}

/**
 * Writes `state` back: Reminders after `now` (the chain ahead) are replaced by
 * the state's, fired ones are upserted with their settled status (Missed,
 * dropped), Snooze count, re-fire, the Exercises done, and a Swap's new
 * Suggestion and `swappedOut`. `now` must be the clock time the core
 * computed `state` at.
 */
export async function saveState(d: Db, state: CoreState, now: Instant): Promise<void> {
  const setMeta = async (key: string, value: string | null) => {
    if (value === null) await d.runAsync('DELETE FROM meta WHERE key = ?', key);
    else await d.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  };
  await setMeta(META.settings, JSON.stringify(state.settings));
  await setMeta(META.lastResponseAt, state.lastResponseAt === null ? null : String(state.lastResponseAt));
  await setMeta(META.lastAppOpenAt, state.lastAppOpenAt === null ? null : String(state.lastAppOpenAt));
  await setMeta(META.goalChanges, JSON.stringify(state.goalChanges));

  await d.runAsync('DELETE FROM reminders WHERE fires_at > ?', now);
  for (let i = 0; i < state.reminders.length; i += BATCH) {
    const batch = state.reminders.slice(i, i + BATCH);
    await d.runAsync(
      `INSERT INTO reminders (id, fires_at, suggestion, status, snoozes, refires_at, done_exercises, fallback, swapped_out, rotation)
       VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
       ON CONFLICT(id) DO UPDATE SET fires_at = excluded.fires_at, suggestion = excluded.suggestion,
         status = excluded.status, snoozes = excluded.snoozes, refires_at = excluded.refires_at,
         done_exercises = excluded.done_exercises, fallback = excluded.fallback,
         swapped_out = excluded.swapped_out, rotation = excluded.rotation`,
      batch.flatMap((r) => [
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
      ]),
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

/** A read for screens, outside any write transaction. */
export async function readState(): Promise<CoreState> {
  return loadState(await db());
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
