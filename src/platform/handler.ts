/**
 * The one place JS turns platform happenings into core events: notification
 * action taps (from both delivery paths) and the app coming to the front.
 * Each read-modify-write runs inside one `write()` transaction, so it sees the
 * latest committed state even when another JS context wrote in between.
 *
 * The `ScheduleChain` intent is carried out inside that same transaction,
 * after the state is saved and before COMMIT. The per-context mutex (one JS
 * context) and the BEGIN IMMEDIATE lock (two contexts) then hold "commit +
 * schedule" as one critical section, so the last chain committed is the last
 * chain armed. If scheduling throws, the transaction rolls back and state and
 * alarms don't diverge. Dismissals are idempotent and run after the commit.
 */
import * as Notifications from 'expo-notifications';
import { outstandingReminder, reduce, type CoreDeps, type CoreResult, type CoreState, type ResponseKind } from '../core';
import { exercises } from '../library';
import { write, type Db } from './db';
import { ACTION, dismissNotifications, dismissStale, scheduleChains } from './notifications';
import { guardedSkip, guardedSnooze, loadState, logResponse, notifyStateChanged, saveState, type Source } from './store';

/**
 * The real randomness and library, with the clock frozen at one instant, so
 * the core and the SQL written in the same transaction agree on what "now" is.
 * Only adapters may touch Date.now and Math.random; the core may not.
 */
function frozenDeps(): { deps: CoreDeps; now: number } {
  const now = Date.now();
  return { deps: { clock: { now: () => now }, random: { next: Math.random }, library: exercises }, now };
}

/** The device's IANA time zone, e.g. `Europe/Madrid`. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The Reminder Id in a notification's content. The background task gets the
 * data as a JSON string in `content.dataString` (seen on the Pixel, #12); the
 * foreground listener gets `content.data`.
 */
export function reminderIdOf(content: unknown): string | undefined {
  const c = (content ?? {}) as { dataString?: unknown; data?: unknown };
  let data: unknown = c.data;
  if (typeof c.dataString === 'string') {
    try {
      data = JSON.parse(c.dataString);
    } catch {
      // fall back to content.data
    }
  }
  const id = (data as { reminderId?: unknown } | null | undefined)?.reminderId;
  return typeof id === 'string' ? id : undefined;
}

/** The notification actions that are Responses. Start isn't one: it opens the app. */
const RESPONSE_OF: Partial<Record<string, ResponseKind>> = { [ACTION.skip]: 'Skip', [ACTION.snooze]: 'Snooze' };

/**
 * The guarded UPDATE for an accepted Response. A Snooze stores the re-fire
 * time the core computed (`next` is the reduced state).
 */
async function guarded(d: Db, kind: ResponseKind, reminderId: string, next: CoreState, now: number): Promise<boolean> {
  if (kind === 'Skip') return guardedSkip(d, reminderId, now);
  const refiresAt = next.reminders.find((r) => r.id === reminderId)?.refiresAt;
  return refiresAt !== undefined && guardedSnooze(d, reminderId, refiresAt, now);
}

/**
 * The shared action handler, called by the background task and by the
 * foreground response listener. When the app is alive in the background both
 * fire in this one JS context; the guard turns the second call into a no-op.
 */
export async function handleAction(actionId: string, payload: { reminderId?: string }, source: Source) {
  const reminderId = payload.reminderId;
  if (!reminderId) return;

  const kind = RESPONSE_OF[actionId];
  if (kind) {
    // Dismiss first: on a cold start JS takes seconds to reach the database.
    await Notifications.dismissNotificationAsync(reminderId).catch(() => {});
    const { deps, now } = frozenDeps();
    let accepted = false;
    const result = await write(async (d) => {
      const state = await loadState(d);
      // The core's guard, asked before reducing: only the outstanding Reminder
      // takes a Response. Anything else (duplicate, stale, unknown, re-fire
      // still pending) is a no-op; its notification was already dismissed above.
      if (outstandingReminder(state, now)?.id !== reminderId) return { state, intents: [] };
      const next = reduce(state, { type: 'Response', reminderId, kind }, deps);
      // A guarded no-op returns the input state itself (e.g. a third Snooze).
      if (next.state === state) return { state, intents: [] };
      // The same guard in SQL, accepted only when exactly one row changed.
      if (!(await guarded(d, kind, reminderId, next.state, now))) return { state, intents: [] };
      await logResponse(d, reminderId, kind, source, now);
      // Also persists what settling changed (Missed, dropped).
      await saveState(d, next.state, now);
      // Inside the lock, before COMMIT: see the header comment.
      await scheduleChains(next.intents);
      accepted = true;
      return next;
    }).catch((e: unknown) => {
      console.warn(`[handler] ${kind} ${reminderId} from ${source} rolled back: ${e}`);
      throw e;
    });
    console.log(`[handler] ${kind} ${reminderId} from ${source}: ${accepted ? 'accepted' : 'no-op'}`);
    if (accepted) notifyStateChanged();
    await dismissNotifications(result.intents);
    await dismissStale(result.state, now).catch(() => {});
    return;
  }

  // Start, or a tap on the notification body: the app opens. Nothing to record
  // until the guided flow lands (#23).
}

/**
 * JS is running in front: AppOpened, then Rearm in the device's time zone,
 * persisted and the chain rescheduled in one transaction; then stale
 * Reminders leave the shade. `prepare` lets the dev test mode change the
 * stored settings in the same transaction.
 */
export async function rearmOnOpen(prepare?: (state: CoreState) => CoreState): Promise<CoreResult> {
  const { deps, now } = frozenDeps();
  const result = await write(async (d) => {
    const loaded = await loadState(d);
    const state = prepare ? prepare(loaded) : loaded;
    const opened = reduce(state, { type: 'AppOpened' }, deps);
    const rearmed = reduce(opened.state, { type: 'Rearm', timeZone: deviceTimeZone() }, deps);
    await saveState(d, rearmed.state, now);
    const intents = [...opened.intents, ...rearmed.intents];
    // Inside the lock, before COMMIT: see the header comment.
    await scheduleChains(intents);
    return { state: rearmed.state, intents };
  }).catch((e: unknown) => {
    console.warn(`[handler] Rearm rolled back: ${e}`);
    throw e;
  });
  notifyStateChanged();
  await dismissNotifications(result.intents);
  await dismissStale(result.state, now).catch(() => {});
  return result;
}
