/**
 * The one place JS turns platform happenings into core events: Responses
 * (notification action taps from both delivery paths, and the guided screen's
 * Snooze and Skip), the guided screen opening, swapping and finishing,
 * corrections, Pause, Resume and Day Off from Today, changes on the Settings
 * page, opening Achievements, and the app coming to the front.
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
import {
  guidedFinish,
  type BadgeId,
  isOutstanding,
  reduce,
  settle,
  type CoreDeps,
  type CoreEvent,
  type CoreResult,
  type CoreState,
  type Intent,
  type LocalDate,
  type Outcome,
  type PauseLength,
  type Reminder,
  type ResponseKind,
  type SettingsChange,
} from '../core';
import { exercises } from '../library';
import { write, type Db } from './db';
import { ACTION, dismissNotifications, dismissReminder, dismissStale, scheduleChains } from './notifications';
import {
  guardedDone,
  guardedSkip,
  guardedSnooze,
  loadState,
  logResponse,
  notifyStateChanged,
  readState,
  saveState,
  type Source,
} from './store';
import { trace } from './trace';

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

/** The notification actions that are Responses. Start isn't one: it opens the guided screen. */
const RESPONSE_OF: Partial<Record<string, Exclude<ResponseKind, 'Done'>>> = { [ACTION.skip]: 'Skip', [ACTION.snooze]: 'Snooze' };

/** A Response event: from a notification action, or from the guided screen. */
export type ResponseEvent = Extract<CoreEvent, { type: 'Response' }>;

/**
 * The guarded UPDATE for an accepted Response, chosen by what the core made of
 * it (`next` is the reduced state): a Snooze stores the re-fire time the core
 * computed; a Done stores the Exercises the core kept, or, with none kept, is
 * a Skip. Returns what to log, or null when the guard lost the race.
 */
async function guarded(d: Db, event: ResponseEvent, next: CoreState, now: number): Promise<ResponseKind | null> {
  const { reminderId } = event;
  const answered = next.reminders.find((r) => r.id === reminderId);
  if (event.kind === 'Snooze') {
    const refiresAt = answered?.refiresAt;
    return refiresAt !== undefined && (await guardedSnooze(d, reminderId, refiresAt, now)) ? 'Snooze' : null;
  }
  if (answered?.status === 'done') return (await guardedDone(d, reminderId, answered.done ?? [], now)) ? 'Done' : null;
  return (await guardedSkip(d, reminderId, now)) ? 'Skip' : null;
}

/**
 * The one guarded path for every Response, whoever delivers it. Dismiss
 * first, then in one `write()`: load, the core's guard, reduce, the SQL guard,
 * log, save and schedule the chain; after the commit, the dismissals. True
 * when the Response was accepted, false for a no-op. A Badge or a reached
 * Daily Goal posts no notification: only the guided finish shows it.
 */
export async function respond(event: ResponseEvent, source: Source): Promise<boolean> {
  return (await respondWithIntents(event, source)) !== null;
}

/** `respond`, returning the accepted Response's intents (null for a no-op), for `finishGuided`'s celebration. */
async function respondWithIntents(event: ResponseEvent, source: Source): Promise<Intent[] | null> {
  const { reminderId, kind } = event;
  const span = trace.span(source, `${kind} ${reminderId}`);
  // Dismiss first: on a cold start JS takes seconds to reach the database.
  await dismissReminder(reminderId);
  span.step('dismiss');
  const { deps, now } = frozenDeps();
  let logged: ResponseKind | null = null;
  const result = await write(async (d) => {
    span.step('lock', 'db open + mutex + BEGIN IMMEDIATE');
    const state = await loadState(d);
    span.step('load', `${state.reminders.length} reminders`);
    // The core's guard, asked before reducing: only the outstanding Reminder
    // takes a Response (a pending re-fire doesn't stop a Done or Skip). Anything
    // else (duplicate, stale, unknown) is a no-op; its notification was already
    // dismissed above.
    if (!isOutstanding(state, reminderId, now)) {
      span.step('guard', 'not outstanding');
      return { state, intents: [] };
    }
    const next = reduce(state, event, deps);
    span.step('reduce', next.state === state ? 'unchanged' : undefined);
    // A guarded no-op returns the input state itself (e.g. a third Snooze, or a Snooze before the re-fire).
    if (next.state === state) return { state, intents: [] };
    // The same guard in SQL, accepted only when exactly one row changed.
    logged = await guarded(d, event, next.state, now);
    span.step('guarded', logged ?? 'lost the race');
    if (!logged) return { state, intents: [] };
    await logResponse(d, reminderId, logged, source, now);
    span.step('logResponse');
    // Also persists what settling changed (Missed, dropped).
    await saveState(d, next.state, now, state);
    span.step('save', `${next.state.reminders.length} reminders`);
    // Inside the lock, before COMMIT: see the header comment.
    await scheduleChains(next.intents, span);
    return next;
  }).catch((e: unknown) => {
    console.warn(`[handler] ${kind} ${reminderId} from ${source} rolled back: ${e}`);
    span.end(`rolled back: ${e}`);
    throw e;
  });
  span.step('commit');
  console.log(`[handler] ${kind} ${reminderId} from ${source}: ${logged ? `accepted as ${logged}` : 'no-op'}`);
  if (logged) notifyStateChanged();
  await dismissNotifications(result.intents);
  span.step('dismissNotifications');
  // The clock after the commit: a Reminder that fired during the write is outstanding now, so it stays (#39).
  await dismissStale(result.state, Date.now(), span).catch((e: unknown) => span.step('dismissStale', `failed: ${e}`));
  span.end(logged ? `accepted as ${logged}` : 'no-op');
  return logged !== null ? result.intents : null;
}

/**
 * The guided screen opened on `reminderId`: GuidedStarted in one `write()`.
 * On the outstanding Reminder with a Snooze re-fire pending, the core cancels
 * the re-fire; the new state is saved and the chain rescheduled without it.
 * Anything else is a no-op that writes nothing. Returns the resulting state
 * and the instant it was computed at, for the screen's `guidedStart`.
 */
export async function startGuided(reminderId: string): Promise<{ state: CoreState; now: number }> {
  const { deps, now } = frozenDeps();
  let changed = false;
  const state = await write(async (d) => {
    const loaded = await loadState(d);
    const next = reduce(loaded, { type: 'GuidedStarted', reminderId }, deps);
    if (next.state === loaded) return loaded;
    changed = true;
    await saveState(d, next.state, now, loaded);
    // Inside the lock, before COMMIT: see the header comment.
    await scheduleChains(next.intents);
    return next.state;
  }).catch((e: unknown) => {
    console.warn(`[handler] GuidedStarted ${reminderId} rolled back: ${e}`);
    throw e;
  });
  console.log(`[handler] GuidedStarted ${reminderId}: ${changed ? 'cancelled the re-fire' : 'no-op'}`);
  if (changed) notifyStateChanged();
  return { state, now };
}

/**
 * Swap on the guided card: the core's `Swap` in one `write()`. Only if the
 * core changed the state (it accepts a Swap on the Reminders `guidedStart`
 * opens, for an Id in the Suggestion, when it has a replacement), it is saved
 * and the chain ahead rescheduled inside the lock, then notified after the
 * commit. Not a Response: no `responses` row. Returns the swapped Reminder,
 * or null for a no-op (nothing else fits, or the Reminder no longer accepts it).
 */
export async function swap(reminderId: string, exerciseId: string): Promise<Reminder | null> {
  const { deps, now } = frozenDeps();
  const swapped = await write(async (d) => {
    const state = await loadState(d);
    const next = reduce(state, { type: 'Swap', reminderId, exerciseId }, deps);
    if (next.state === state) return null;
    await saveState(d, next.state, now, state);
    // Inside the lock, before COMMIT: see the header comment.
    await scheduleChains(next.intents);
    return next.state.reminders.find((r) => r.id === reminderId) ?? null;
  }).catch((e: unknown) => {
    console.warn(`[handler] Swap ${exerciseId} on ${reminderId} rolled back: ${e}`);
    throw e;
  });
  console.log(`[handler] Swap ${exerciseId} on ${reminderId}: ${swapped ? 'accepted' : 'no-op'}`);
  if (swapped) notifyStateChanged();
  return swapped;
}

/** What the guided screen's celebration card shows: the core's `CelebrationDue` for the finished Reminder. */
export interface Celebration {
  goalReached: boolean;
  badges: BadgeId[];
}

/** What a guided finish recorded, and the celebration it brought, if any. */
export interface GuidedFinishResult {
  recorded: boolean;
  celebration?: Celebration;
}

/** The `CelebrationDue` for `reminderId` among `intents`, as a result. */
function finished(reminderId: string, intents: Intent[]): GuidedFinishResult {
  const due = intents.find((i) => i.type === 'CelebrationDue' && i.reminderId === reminderId);
  return due?.type === 'CelebrationDue'
    ? { recorded: true, celebration: { goalReached: due.goalReached, badges: due.badges } }
    : { recorded: true };
}

/**
 * The guided screen finished on `reminderId` (its last card answered, or End
 * here), with `did` the Ids marked Did it. The core's `guidedFinish` says what
 * that records: on the outstanding Reminder, the Done Response through
 * `respond`; once it is no longer outstanding, a late answer as a correction
 * (logged with source `guided-late`); or nothing. If the Done Response loses a
 * race (a newer Reminder fired, or a shade answer landed, between the read and
 * the lock), it falls through to the late path once. `recorded` is whether
 * something was recorded; `celebration` is the core's `CelebrationDue` for
 * this Reminder, from either path, for the celebration card.
 */
export async function finishGuided(reminderId: string, did: string[]): Promise<GuidedFinishResult> {
  const event = guidedFinish(await readState(), reminderId, did, frozenDeps().now);
  if (!event) {
    console.log(`[handler] GuidedFinish ${reminderId}: nothing to record`);
    return { recorded: false };
  }
  if (event.type === 'Response') {
    const intents = await respondWithIntents(event, 'app');
    if (intents) return finished(reminderId, intents);
  }
  return finishGuidedLate(reminderId, did);
}

/**
 * The late path of `finishGuided`: the correction, recomputed and applied in one `write()`.
 * The new state is saved whenever the core changed it (the Did it list may change), but a
 * `guided-late` row is logged only when the Reminder's settled status changes. Its only
 * intents are `BadgesUnlocked` and `CelebrationDue`: nothing is scheduled or posted, and a
 * `CelebrationDue` goes to the guided screen's card.
 */
async function finishGuidedLate(reminderId: string, did: string[]): Promise<GuidedFinishResult> {
  const { deps, now } = frozenDeps();
  let recorded: 'Done' | 'Skip' | null = null;
  let logged = false;
  let intents: Intent[] = [];
  await write(async (d) => {
    const state = await loadState(d);
    const event = guidedFinish(state, reminderId, did, now);
    if (event?.type !== 'Correct') return;
    const next = reduce(state, event, deps);
    if (next.state === state) return;
    await saveState(d, next.state, now, state);
    recorded = event.to;
    intents = next.intents;
    const statusOf = (s: CoreState) => settle(s, now).reminders.find((r) => r.id === reminderId)?.status;
    if (statusOf(next.state) === statusOf(state)) return;
    await logResponse(d, reminderId, event.to, 'guided-late', now);
    logged = true;
  }).catch((e: unknown) => {
    console.warn(`[handler] GuidedFinish ${reminderId} rolled back: ${e}`);
    throw e;
  });
  console.log(
    `[handler] GuidedFinish ${reminderId}: ${recorded ? `accepted as Correct ${recorded}${logged ? '' : ' (status unchanged, not logged)'}` : 'no-op'}`,
  );
  if (!recorded) return { recorded: false };
  notifyStateChanged();
  return finished(reminderId, intents);
}

/**
 * A correction from Today: Correct in one `write()`. The core accepts it only
 * for one of today's answered Reminders (done, skipped, Missed or dropped);
 * then the new state is saved (the Reminder's status and `done` list, the
 * Badges it unlocked, plus whatever settling changed). A correction is
 * history: no scheduling and no Response logged. Its only intents,
 * `BadgesUnlocked` and `CelebrationDue`, are ignored here: the stored Badges
 * light Today's new-Badge dot, and Today shows no celebration card. Anything
 * else (a past day, the outstanding Reminder, a Done with nothing done)
 * writes nothing. True when the correction was accepted.
 */
export async function correct(reminderId: string, to: Outcome, did?: string[]): Promise<boolean> {
  const { deps, now } = frozenDeps();
  const accepted = await write(async (d) => {
    const state = await loadState(d);
    const next = reduce(state, { type: 'Correct', reminderId, to, did }, deps);
    if (next.state === state) return false;
    await saveState(d, next.state, now, state);
    return true;
  }).catch((e: unknown) => {
    console.warn(`[handler] Correct ${reminderId} to ${to} rolled back: ${e}`);
    throw e;
  });
  console.log(`[handler] Correct ${reminderId} to ${to}: ${accepted ? 'accepted' : 'no-op'}`);
  if (accepted) notifyStateChanged();
  return accepted;
}

/**
 * A Settings page, Pause, Day Off or Achievements event in one `write()`: load, `reduce`,
 * and only if the core accepted it (a new state), save it and schedule the
 * chain inside the lock; after the commit, apply the dismissals (a Pause or a
 * Day Off drops the waiting Reminder) and notify. Not a Response: no
 * `responses` row. True when it was accepted.
 */
async function commitEvent(event: CoreEvent, label: string): Promise<boolean> {
  const span = trace.span('app', label);
  const { deps, now } = frozenDeps();
  const intents = await write(async (d) => {
    span.step('lock', 'db open + mutex + BEGIN IMMEDIATE');
    const state = await loadState(d);
    span.step('load', `${state.reminders.length} reminders`);
    const next = reduce(state, event, deps);
    span.step('reduce', next.state === state ? 'unchanged' : undefined);
    if (next.state === state) return null;
    await saveState(d, next.state, now, state);
    span.step('save', `${next.state.reminders.length} reminders`);
    // Inside the lock, before COMMIT: see the header comment.
    await scheduleChains(next.intents, span);
    return next.intents;
  }).catch((e: unknown) => {
    console.warn(`[handler] ${label} rolled back: ${e}`);
    span.end(`rolled back: ${e}`);
    throw e;
  });
  span.step('commit');
  console.log(`[handler] ${label}: ${intents ? 'accepted' : 'no-op'}`);
  if (!intents) {
    span.end('no-op');
    return false;
  }
  await dismissNotifications(intents);
  span.step('dismissNotifications');
  notifyStateChanged();
  span.end('accepted');
  return true;
}

/**
 * Achievements was opened: AchievementsOpened records the visit, which clears
 * Today's new-Badge dot. No intents, so nothing is scheduled. True when
 * accepted (the core always accepts it).
 */
export function openAchievements(): Promise<boolean> {
  return commitEvent({ type: 'AchievementsOpened' }, 'AchievementsOpened');
}

/**
 * ChangeSettings from the Settings page. The core validates the change (an
 * invalid one writes nothing) and rearms: the chain is rescheduled at once.
 * True when the change was accepted.
 */
export function changeSettings(change: SettingsChange): Promise<boolean> {
  return commitEvent({ type: 'ChangeSettings', change }, `ChangeSettings ${Object.keys(change).join(', ')}`);
}

/**
 * ResetSettings from the Settings page: every setting back to its default
 * (Appearance to System, the Daily Goal from tomorrow), the time zone kept and
 * the Activity Log untouched, then the chain rescheduled. True when accepted.
 */
export function resetSettings(): Promise<boolean> {
  return commitEvent({ type: 'ResetSettings' }, 'ResetSettings');
}

/**
 * SetDailyGoal from the Settings page, applied from tomorrow. It has no
 * intents, so nothing is scheduled. True when the goal was accepted.
 */
export function setDailyGoal(goal: number): Promise<boolean> {
  return commitEvent({ type: 'SetDailyGoal', goal }, `SetDailyGoal ${goal}`);
}

/**
 * Pause from Today: no Reminder for 1 hour, 2 hours or the rest of today. A
 * Pause already running is replaced from now; rejected on a Day Off. The
 * waiting Reminder is dropped and its notification dismissed after the
 * commit. True when accepted.
 */
export function pause(length: PauseLength): Promise<boolean> {
  return commitEvent({ type: 'Pause', length }, `Pause ${length}`);
}

/** Resume from Today: ends the running Pause now and rearms. True when accepted (a Pause was running). */
export function resume(): Promise<boolean> {
  return commitEvent({ type: 'Resume' }, 'Resume');
}

/**
 * Take a day off, or undo it (`off` false). Today or a future date only; a
 * no-op (already in that state) is rejected. Today off drops the waiting
 * Reminder and dismisses its notification after the commit. True when accepted.
 */
export function setDayOff(date: LocalDate, off: boolean): Promise<boolean> {
  return commitEvent(
    { type: 'SetDayOff', date, off },
    `SetDayOff ${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')} ${off}`,
  );
}

/**
 * The shared notification-action handler, called by the background task and
 * by the foreground response listener. When the app is alive in the
 * background both fire in this one JS context; the guard turns the second
 * call into a no-op. Start and a tap on the notification body record
 * nothing: the foreground side opens the guided screen (useReminderRuntime.ts).
 */
export async function handleAction(actionId: string, payload: { reminderId?: string }, source: Source) {
  const reminderId = payload.reminderId;
  const kind = RESPONSE_OF[actionId];
  if (!reminderId || !kind) return;
  await respond({ type: 'Response', reminderId, kind }, source);
}

/**
 * JS is running in front: AppOpened, then Rearm in the device's time zone,
 * persisted and the chain rescheduled in one transaction; then stale
 * Reminders leave the shade. `prepare` lets the dev test mode change the
 * stored settings in the same transaction.
 */
export async function rearmOnOpen(prepare?: (state: CoreState) => CoreState): Promise<CoreResult> {
  const span = trace.span('app', 'Rearm');
  const { deps, now } = frozenDeps();
  const result = await write(async (d) => {
    span.step('lock', 'db open + mutex + BEGIN IMMEDIATE');
    const loaded = await loadState(d);
    span.step('load', `${loaded.reminders.length} reminders`);
    const state = prepare ? prepare(loaded) : loaded;
    const opened = reduce(state, { type: 'AppOpened' }, deps);
    const rearmed = reduce(opened.state, { type: 'Rearm', timeZone: deviceTimeZone() }, deps);
    span.step('reduce', 'AppOpened + Rearm');
    await saveState(d, rearmed.state, now, loaded);
    span.step('save', `${rearmed.state.reminders.length} reminders`);
    const intents = [...opened.intents, ...rearmed.intents];
    // Inside the lock, before COMMIT: see the header comment.
    await scheduleChains(intents, span);
    return { state: rearmed.state, intents };
  }).catch((e: unknown) => {
    console.warn(`[handler] Rearm rolled back: ${e}`);
    span.end(`rolled back: ${e}`);
    throw e;
  });
  span.step('commit');
  notifyStateChanged();
  await dismissNotifications(result.intents);
  span.step('dismissNotifications');
  // The clock after the commit: a Reminder that fired during the write is outstanding now, so it stays (#39).
  await dismissStale(result.state, Date.now(), span).catch((e: unknown) => span.step('dismissStale', `failed: ${e}`));
  span.end('done');
  return result;
}
