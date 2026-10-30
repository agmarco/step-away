/**
 * The core's state in SQLite. Thin: rows <-> CoreState, plus the guarded
 * Response updates (Skip, Snooze) and the Response log. The schema is in
 * migrations.ts. Every function taking a `Db` is meant
 * to run inside `write()` (one BEGIN IMMEDIATE transaction).
 */
import { defaultSettings, MAX_SNOOZES, type CoreState, type Instant, type Reminder, type ResponseKind, type Settings } from '../core';
import { db, type Db } from './db';

/** Who handled an action tap: the background task or the foreground response listener. */
export type Source = 'bg-task' | 'fg-listener';

interface ReminderRow {
  id: string;
  fires_at: number;
  suggestion: string;
  status: string;
  snoozes: number;
  refires_at: number | null;
}

const META = {
  settings: 'settings',
  lastResponseAt: 'last_response_at',
  lastAppOpenAt: 'last_app_open_at',
} as const;

/** Rows per multi-row INSERT: 6 params each, well under SQLite's bound-parameter limit. */
const BATCH = 100;

export async function loadState(d: Db): Promise<CoreState> {
  const meta = new Map(
    (await d.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM meta')).map((m) => [m.key, m.value]),
  );
  const rows = await d.getAllAsync<ReminderRow>('SELECT id, fires_at, suggestion, status, snoozes, refires_at FROM reminders ORDER BY fires_at',);
  const instant = (key: string): Instant | null => (meta.has(key) ? Number(meta.get(key)) : null);
  const settings = meta.get(META.settings);
  return {
    settings: settings ? (JSON.parse(settings) as Settings) : defaultSettings,
    lastResponseAt: instant(META.lastResponseAt),
    lastAppOpenAt: instant(META.lastAppOpenAt),
    reminders: rows.map(
      (r): Reminder => ({
        id: r.id,
        firesAt: r.fires_at,
        suggestion: JSON.parse(r.suggestion) as Reminder['suggestion'],
        status: r.status as Reminder['status'],
        // The core's optional fields: absent means 0 Snoozes and no re-fire.
        ...(r.snoozes > 0 && { snoozes: r.snoozes }),
        ...(r.refires_at !== null && { refiresAt: r.refires_at }),
      }),
    ),
  };
}

/**
 * Writes `state` back: Reminders after `now` (the chain ahead) are replaced by
 * the state's, fired ones are upserted with their settled status (Missed,
 * dropped), Snooze count and re-fire. `now` must be the clock time the core
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

  await d.runAsync('DELETE FROM reminders WHERE fires_at > ?', now);
  for (let i = 0; i < state.reminders.length; i += BATCH) {
    const batch = state.reminders.slice(i, i + BATCH);
    await d.runAsync(
      `INSERT INTO reminders (id, fires_at, suggestion, status, snoozes, refires_at)
       VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}
       ON CONFLICT(id) DO UPDATE SET fires_at = excluded.fires_at, suggestion = excluded.suggestion,
         status = excluded.status, snoozes = excluded.snoozes, refires_at = excluded.refires_at`,
      batch.flatMap((r) => [r.id, r.firesAt, JSON.stringify(r.suggestion), r.status, r.snoozes ?? 0, r.refiresAt ?? null]),
    );
  }
}

/**
 * The guarded Skip, the core's guard in SQL: a fired Reminder still
 * `scheduled` whose Snooze re-fire (if any) has fired too. True only when
 * exactly one row changed; anything else lost the race.
 */
export async function guardedSkip(d: Db, reminderId: string, now: Instant): Promise<boolean> {
  const res = await d.runAsync(
    `UPDATE reminders SET status = 'skipped'
     WHERE id = ? AND status = 'scheduled' AND fires_at <= ? AND (refires_at IS NULL OR refires_at <= ?)`,
    reminderId,
    now,
    now,
  );
  return res.changes === 1;
}

/**
 * The guarded Snooze: the Skip guard plus fewer than MAX_SNOOZES Snoozes so
 * far (core/notification.ts). `refiresAt` is the re-fire the core
 * computed. True only when exactly one row changed.
 */
export async function guardedSnooze(d: Db, reminderId: string, refiresAt: Instant, now: Instant): Promise<boolean> {
  const res = await d.runAsync(
    `UPDATE reminders SET snoozes = snoozes + 1, refires_at = ?
     WHERE id = ? AND status = 'scheduled' AND fires_at <= ? AND (refires_at IS NULL OR refires_at <= ?) AND snoozes < ?`,
    refiresAt,
    reminderId,
    now,
    now,
    MAX_SNOOZES,
  );
  return res.changes === 1;
}

/** One row per accepted Response, for the device check. Write it only when the guarded update won. */
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
