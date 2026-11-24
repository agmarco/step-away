import { MAX_SNOOZES, notificationFor, refireNotificationFor } from './notification';
import { chainTimes, outstandingReminder, reminderId } from './schedule';
import { badgesToUnlock } from './achievements';
import { canSetDayOff, dailyGoalFor, dateKey, dayOf, dayTally, DEFAULT_DAILY_GOAL, isDayOff, sameDate } from './days';
import { addDays, instantAt, localDateOf, MINUTE } from './localTime';
import { runningPause } from './pause';
import { refirePending, refireScheduled, settle } from './settle';
import { buildSuggestion, coverageOf, rotationStart, suggestionSource } from './suggest';
import { isValidChange } from './settingsChange';
import { swapReplacement } from './swap';
import { guidedStart } from './guidedFinish';
import type {
  CoreDeps,
  CoreEvent,
  CoreResult,
  CoreState,
  DoneExercise,
  DropReason,
  Instant,
  Intent,
  Reminder,
  ScheduledNotification,
  Settings,
} from './types';

const weekday = { start: 9 * 60, end: 18 * 60 };

/**
 * Mon-Fri 09:00-18:00, weekends off, 45-minute Interval, 10-minute Snooze
 * delay, 1 Exercise per Suggestion. The adapter sets `timeZone` from the device.
 */
export const defaultSettings: Settings = {
  activeHours: { mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: null, sun: null },
  intervalMinutes: 45,
  timeZone: 'UTC',
  snoozeMinutes: 10,
  exercisesPerSuggestion: 1,
  bodyAreaMode: 'Weighted',
  difficulty: 'Intermediate',
  energetic: false,
  floor: false,
  equipment: [],
  excluded: [],
  doseOverrides: {},
  appearance: 'System',
};

export const initialState: CoreState = {
  lastAppOpenAt: null,
  settings: defaultSettings,
  reminders: [],
  lastResponseAt: null,
  goalChanges: [],
  pauses: [],
  daysOff: [],
  badges: [],
  achievementsSeenAt: null,
};

/**
 * The core's one entry point: (state, event, { clock, random, library }) -> { state, intents }.
 *
 * Every event first settles the state (Missed and dropped Reminders, see
 * `settle`). An accepted event returns state built on the settled state; a
 * guarded Response returns the input state unchanged and only dismisses the
 * notification. A Response acts only on the outstanding Reminder; a Snooze
 * also needs its re-fire (if any) to have fired and fewer than 2 Snoozes. A
 * Done or Skip is final: it cancels a pending re-fire and rebuilds the chain
 * from now. A Done with none of its Ids in the Suggestion counts as a Skip.
 * An accepted Done or Skip then evaluates Badges (`evaluateAchievements`).
 *
 * GuidedStarted (the guided screen opened) is not a Response: on the
 * outstanding Reminder with a re-fire pending it cancels the re-fire (the
 * Snooze count and `lastResponseAt` stay) and rebuilds the chain, which then
 * counts from the Reminder's own fire time. Anything else returns the input
 * state unchanged, with no intents.
 *
 * SetDailyGoal records the goal from tomorrow (Settings' time zone), replacing
 * any change dated tomorrow or later; a goal that isn't a whole number of at
 * least 1 returns the input state. Correct changes the outcome of one of
 * today's fired Reminders already done, skipped, Missed or dropped (by the
 * settled state): to Done with the same mapping as a Done Response (at least
 * one Id left, else rejected), to Skip or Missed without its `done` list. A
 * correction is history: `lastResponseAt`, `snoozes`, `refiresAt` and the
 * chain stay. An accepted one evaluates Badges (`evaluateAchievements`),
 * whose intents are the only ones it returns. Anything else (a past day, outstanding, not fired,
 * unknown) returns the input state. SetDailyGoal returns no intents.
 *
 * Swap replaces one Exercise of a Suggestion in place (see `swapReplacement`)
 * and appends it to `swappedOut`. Accepted, on the settled state, on the
 * Reminders the guided screen can open (`guidedStart`) and only for an Id in
 * the Suggestion. Not a Response: `lastResponseAt`, `snoozes`, `refiresAt`
 * and `rotation` stay; the chain ahead is rebuilt (only `ScheduleChain`).
 * With nothing to swap in, or anything else, it returns the input state
 * unchanged, with no intents.
 *
 * ChangeSettings merges a valid change (`isValidChange`) into the settled
 * settings and rebuilds the chain; an invalid one returns the input state with
 * no intents. ResetSettings sets every setting but `timeZone` back to
 * `defaultSettings` and the Daily Goal to the default from tomorrow (the
 * SetDailyGoal rule), then rebuilds the chain; the Activity Log stays.
 *
 * Pause, rejected on a Day Off, drops the outstanding Reminder (see
 * `dropOutstanding`) and records `{ from: now, until }`, `until` being now +
 * 1 or 2 hours or the next local midnight; a Pause already running keeps its
 * `from` and takes the new `until`. Resume, only while a Pause is running,
 * sets its `until` to now. SetDayOff, only for a date the Day Off date rule
 * allows (`canSetDayOff`: today or later) and only when it changes something,
 * adds or removes the date (`daysOff` stays sorted); taking today off drops
 * the outstanding Reminder. All three rebuild the chain (see `chainTimes`); a
 * rejected one returns the input state with no intents.
 *
 * AchievementsOpened settles and sets `achievementsSeenAt` to now, with no
 * intents. No event but an accepted Done or Skip Response or Correct
 * evaluates Badges.
 */
export function reduce(state: CoreState, event: CoreEvent, deps: CoreDeps): CoreResult {
  const now = deps.clock.now();
  switch (event.type) {
    case 'AppOpened':
      return { state: { ...settle(state, now), lastAppOpenAt: now }, intents: [] };
    case 'Rearm': {
      const timeZone = event.timeZone ?? state.settings.timeZone;
      return rearm(settle({ ...state, settings: { ...state.settings, timeZone } }, now), deps);
    }
    case 'Response': {
      const dismiss: Intent = { type: 'DismissNotification', reminderId: event.reminderId };
      const settled = settle(state, now);
      const target = outstandingReminder(settled, now);
      if (target?.id !== event.reminderId) return { state, intents: [dismiss] };

      if (event.kind === 'Snooze') {
        if (!canSnooze(target, now)) return { state, intents: [dismiss] };
        const refiresAt = now + settled.settings.snoozeMinutes * MINUTE;
        // Not a final Response: lastResponseAt stays as it is, and no Badge is evaluated.
        const snoozes = (target.snoozes ?? 0) + 1;
        const rebuilt = rearm({ ...settled, reminders: replace(settled, { ...target, snoozes, refiresAt }) }, deps);
        return { state: rebuilt.state, intents: [dismiss, ...rebuilt.intents] };
      }
      // A final Response before a pending re-fire cancels it; the Snooze count stays.
      const { refiresAt: _cancelled, ...withoutRefire } = target;
      const base: Reminder = refirePending(target, now) ? withoutRefire : target;
      const done = event.kind === 'Done' ? doneExercises(target, event.did) : [];
      const answer: Reminder = done.length > 0 ? { ...base, status: 'done', done } : { ...base, status: 'skipped' };
      const rebuilt = rearm({ ...settled, lastResponseAt: now, reminders: replace(settled, answer) }, deps);
      return evaluateAchievements(settled, { state: rebuilt.state, intents: [dismiss, ...rebuilt.intents] }, now, answer);
    }
    case 'GuidedStarted': {
      const settled = settle(state, now);
      const target = outstandingReminder(settled, now);
      if (target?.id !== event.reminderId || !refirePending(target, now)) return { state, intents: [] };
      // Not a Response: lastResponseAt and the Snooze count stay as they are.
      const { refiresAt: _cancelled, ...withoutRefire } = target;
      return rearm({ ...settled, reminders: replace(settled, withoutRefire) }, deps);
    }
    case 'SetDailyGoal': {
      if (!Number.isInteger(event.goal) || event.goal < 1) return { state, intents: [] };
      return { state: goalFromTomorrow(settle(state, now), event.goal, now), intents: [] };
    }
    case 'Correct': {
      // Settled first, so a fired Reminder superseded but not yet persisted counts as Missed.
      const settled = settle(state, now);
      const target = settled.reminders.find((r) => r.id === event.reminderId);
      if (!target || target.firesAt > now || target.status === 'scheduled') return { state, intents: [] };
      const { timeZone } = settled.settings;
      if (!sameDate(dayOf(target, timeZone), localDateOf(now, timeZone))) return { state, intents: [] };

      // No longer dropped, so no `droppedBy`.
      const { done: _removed, droppedBy: _notDropped, ...outcomeless } = target;
      let corrected: Reminder;
      if (event.to === 'Done') {
        const done = doneExercises(target, event.did ?? []);
        if (done.length === 0) return { state, intents: [] };
        corrected = { ...outcomeless, status: 'done', done };
      } else {
        // Only the outcome changes: `snoozes` and `refiresAt` stay.
        corrected = { ...outcomeless, status: event.to === 'Skip' ? 'skipped' : 'missed' };
      }
      // History only: lastResponseAt and the chain stay. The only intents are the achievements'.
      const result = { state: { ...settled, reminders: replace(settled, corrected) }, intents: [] };
      return evaluateAchievements(settled, result, now, corrected);
    }
    case 'Swap': {
      // Settled first, so a fired Reminder replaced but not yet persisted counts as Missed.
      const settled = settle(state, now);
      const target = guidedStart(settled, event.reminderId, now);
      if (!target?.suggestion.some((e) => e.id === event.exerciseId)) return { state, intents: [] };
      const earlier = settled.reminders.filter((r) => r.firesAt < target.firesAt);
      const library = deps.library ?? [];
      const replacement = swapReplacement(target, event.exerciseId, earlier, settled.settings, library, deps.random);
      if (!replacement) return { state, intents: [] };
      // Not a Response: lastResponseAt, snoozes, refiresAt and rotation stay.
      const swapped: Reminder = {
        ...target,
        suggestion: target.suggestion.map((e) => (e.id === event.exerciseId ? replacement : e)),
        swappedOut: [...(target.swappedOut ?? []), event.exerciseId],
      };
      // The window of the chain ahead changed, and a pending re-fire carries the new body.
      return rearm({ ...settled, reminders: replace(settled, swapped) }, deps);
    }
    case 'ChangeSettings': {
      if (!isValidChange(event.change)) return { state, intents: [] };
      const settled = settle(state, now);
      // Rearmed even for a Suggestion-only change: the chain ahead is rebuilt under the new rules.
      return rearm({ ...settled, settings: { ...settled.settings, ...event.change } }, deps);
    }
    case 'ResetSettings': {
      const settled = settle(state, now);
      // Every setting but the time zone; the Activity Log is never touched.
      const settings: Settings = { ...defaultSettings, timeZone: settled.settings.timeZone };
      return rearm(goalFromTomorrow({ ...settled, settings }, DEFAULT_DAILY_GOAL, now), deps);
    }
    case 'Pause': {
      const { timeZone } = state.settings;
      const today = localDateOf(now, timeZone);
      if (isDayOff(state, today)) return { state, intents: [] };
      const until =
        event.length === 'restOfToday'
          ? instantAt(addDays(today, 1), 0, timeZone)
          : now + (event.length === 'hour' ? 60 : 120) * MINUTE;
      const { state: dropped, intents } = dropOutstanding(settle(state, now), now, 'pause');
      const running = runningPause(dropped, now);
      const pauses = running
        ? dropped.pauses.map((p) => (p === running ? { from: p.from, until } : p))
        : [...dropped.pauses, { from: now, until }];
      return rearmAfterDrop({ ...dropped, pauses }, intents, deps);
    }
    case 'Resume': {
      const running = runningPause(state, now);
      if (!running) return { state, intents: [] };
      const settled = settle(state, now);
      const pauses = settled.pauses.map((p) => (p === running ? { from: p.from, until: now } : p));
      return rearm({ ...settled, pauses }, deps);
    }
    case 'SetDayOff': {
      if (!canSetDayOff(state, event.date, now) || isDayOff(state, event.date) === event.off) {
        return { state, intents: [] };
      }
      const day = dateKey(event.date);
      const today = dateKey(localDateOf(now, state.settings.timeZone));
      const settled = settle(state, now);
      // Taking today off drops the waiting Reminder; any other change only moves the chain.
      const { state: dropped, intents } =
        event.off && day === today ? dropOutstanding(settled, now, 'dayOff') : { state: settled, intents: [] };
      const daysOff = event.off
        ? [...dropped.daysOff, event.date].sort((a, b) => dateKey(a) - dateKey(b))
        : dropped.daysOff.filter((d) => dateKey(d) !== day);
      return rearmAfterDrop({ ...dropped, daysOff }, intents, deps);
    }
    case 'AchievementsOpened':
      return { state: { ...settle(state, now), achievementsSeenAt: now }, intents: [] };
  }
}

/**
 * The end of a Pause or a Day Off, after `dropOutstanding`: rearm `state` (the
 * drop's state with the Pause or Day Off applied), the drop's `intents` (its
 * dismissal) first, then the rearm's.
 */
function rearmAfterDrop(state: CoreState, intents: Intent[], deps: CoreDeps): CoreResult {
  const rebuilt = rearm(state, deps);
  return { state: rebuilt.state, intents: [...intents, ...rebuilt.intents] };
}

/**
 * Badge evaluation, after an accepted Done or Skip Response or an accepted
 * Correct: `before` is the settled state before the event, `result` what the
 * event returns, and `recorded` the Reminder as it recorded it. Every Badge
 * met and not yet held (`badgesToUnlock`) is appended with `unlockedAt =
 * now`, and the intents are appended after `result`'s:
 * - `BadgesUnlocked` when at least one Badge is new;
 * - `CelebrationDue` when `recorded` is Done and either a Badge is new or
 *   today's Done count (the local date of `now`) crossed today's Daily Goal:
 *   below it in `before`, at or above it after (`goalReached`).
 */
function evaluateAchievements(before: CoreState, result: CoreResult, now: Instant, recorded: Reminder): CoreResult {
  const badges = badgesToUnlock(result.state, now);
  const today = localDateOf(now, before.settings.timeZone);
  const goal = dailyGoalFor(before, today);
  const goalReached =
    recorded.status === 'done' && dayTally(before, today).done < goal && dayTally(result.state, today).done >= goal;

  const intents: Intent[] = [...result.intents];
  if (badges.length > 0) intents.push({ type: 'BadgesUnlocked', badges });
  if (recorded.status === 'done' && (goalReached || badges.length > 0)) {
    intents.push({ type: 'CelebrationDue', reminderId: recorded.id, goalReached, badges });
  }
  if (badges.length === 0) return { state: result.state, intents };
  const unlocked = badges.map((id) => ({ id, unlockedAt: now }));
  return { state: { ...result.state, badges: [...result.state.badges, ...unlocked] }, intents };
}

/**
 * Drops the outstanding Reminder, if any, as a Pause or taking today off
 * does: it becomes `dropped` (never Missed, never counted), any Snooze
 * re-fire goes with it (`refiresAt` cleared, so the chain anchors on its own
 * fire time), and its notification is dismissed. `droppedBy` records `reason`.
 */
function dropOutstanding(
  state: CoreState,
  now: Instant,
  reason: Extract<DropReason, 'pause' | 'dayOff'>,
): { state: CoreState; intents: Intent[] } {
  const target = outstandingReminder(state, now);
  if (!target) return { state, intents: [] };
  const { refiresAt: _noRefire, ...withoutRefire } = target;
  return {
    state: { ...state, reminders: replace(state, { ...withoutRefire, status: 'dropped', droppedBy: reason }) },
    intents: [{ type: 'DismissNotification', reminderId: target.id }],
  };
}

/**
 * Whether a Snooze on this (outstanding) Reminder is accepted at `now`: fewer
 * than `MAX_SNOOZES` Snoozes so far and no Snooze re-fire still pending.
 * Screens use it to show or hide Snooze.
 */
export function canSnooze(reminder: Reminder, now: Instant): boolean {
  return (reminder.snoozes ?? 0) < MAX_SNOOZES && !refirePending(reminder, now);
}

/**
 * What a Done records: the Ids marked Did it that are in the Reminder's
 * Suggestion, each once, in Suggestion order, as text snapshots copied from
 * the Suggestion (not the library). Empty means the Done counts as a Skip.
 */
function doneExercises(reminder: Reminder, did: readonly string[]): DoneExercise[] {
  const marked = new Set(did);
  // Deleting as it goes counts each Id once.
  return reminder.suggestion
    .filter(({ id }) => marked.delete(id))
    .map(({ id, name, bodyArea }) => ({ id, name, bodyArea }));
}

/**
 * Sets the Daily Goal from tomorrow (Settings' time zone): today's goal never
 * moves. A change dated tomorrow or later is replaced.
 */
function goalFromTomorrow(state: CoreState, goal: number, now: Instant): CoreState {
  const from = addDays(localDateOf(now, state.settings.timeZone), 1);
  const kept = state.goalChanges.filter((c) => dateKey(c.from) < dateKey(from));
  return { ...state, goalChanges: [...kept, { from, goal }] };
}

function replace(state: CoreState, reminder: Reminder): Reminder[] {
  return state.reminders.map((r) => (r.id === reminder.id ? reminder : r));
}

/**
 * Rebuilds the chain ahead: fired Reminders stay in state as they are; the
 * future is replaced by the freshly computed chain. Every Reminder not yet
 * fired gets its Suggestion rebuilt, in fire order, as if built when it fires
 * (no JS runs then): its no-repeat window and Strict rotation include the
 * chain Reminders before it, and Weighted coverage is its own local day's.
 * With nothing eligible and no fallback candidate either, no Suggestion can
 * be made, so nothing is scheduled.
 *
 * A pending Snooze re-fire is scheduled too (the chain intent replaces every
 * scheduled notification), unless it lands at or after its day's window end:
 * that one is never scheduled and settles as dropped at closing.
 */
function rearm(state: CoreState, deps: CoreDeps): CoreResult {
  const now = deps.clock.now();
  const fired = state.reminders.filter((r) => r.firesAt <= now);

  const refires: ScheduledNotification[] = [];
  for (const r of fired) {
    if (r.refiresAt === undefined || !refireScheduled(r, state.settings, now)) continue;
    refires.push(refireNotificationFor({ ...r, refiresAt: r.refiresAt }));
  }

  const chain = chainAhead(state, fired, deps);

  return {
    state: { ...state, reminders: [...fired, ...chain] },
    intents: [
      { type: 'ScheduleChain', reminders: [...refires, ...chain.map(notificationFor)].sort((a, b) => a.at - b.at) },
    ],
  };
}

/**
 * The Reminders of the chain ahead, each with its Suggestion built in fire
 * order after `fired` and the ones before it. Empty when nothing is eligible
 * and there is no fallback candidate either.
 *
 * Linear: `earlier` grows by one per Reminder, the rotation is carried
 * forward, and coverage comes from `fired` once (chain Reminders are never
 * `done`), looked up by each Reminder's local day.
 */
function chainAhead(state: CoreState, fired: readonly Reminder[], deps: CoreDeps): Reminder[] {
  const source = suggestionSource(state.settings, deps.library ?? []);
  if (!source) return [];
  const coveredOn = coverageOf(fired, state.settings.timeZone);
  const earlier = [...fired];
  let rotation = rotationStart(fired);
  const chain: Reminder[] = [];
  for (const firesAt of chainTimes(state, deps.clock.now())) {
    const built = buildSuggestion({ earlier, rotation, covered: coveredOn(firesAt) }, source, state.settings, deps.random);
    const reminder: Reminder = { id: reminderId(firesAt), firesAt, status: 'scheduled', ...built };
    earlier.push(reminder);
    chain.push(reminder);
    rotation = built.rotation ?? rotation;
  }
  return chain;
}
