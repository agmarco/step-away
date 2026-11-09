import { MAX_SNOOZES, notificationFor, refireNotificationFor } from './notification';
import { chainTimes, outstandingReminder, reminderId } from './schedule';
import { dateKey, dayOf, sameDate } from './days';
import { addDays, localDateOf, MINUTE } from './localTime';
import { refirePending, refireScheduled, settle } from './settle';
import { buildSuggestion, coverageOf, rotationStart, suggestionSource } from './suggest';
import { swapReplacement } from './swap';
import { guidedStart } from './guidedFinish';
import type {
  CoreDeps,
  CoreEvent,
  CoreResult,
  CoreState,
  DoneExercise,
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
  appearance: 'System',
};

export const initialState: CoreState = {
  lastAppOpenAt: null,
  settings: defaultSettings,
  reminders: [],
  lastResponseAt: null,
  goalChanges: [],
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
 * chain stay. Anything else (a past day, outstanding, not fired, unknown)
 * returns the input state. Neither returns intents.
 *
 * Swap replaces one Exercise of a Suggestion in place (see `swapReplacement`)
 * and appends it to `swappedOut`. Accepted, on the settled state, on the
 * Reminders the guided screen can open (`guidedStart`) and only for an Id in
 * the Suggestion. Not a Response: `lastResponseAt`, `snoozes`, `refiresAt`
 * and `rotation` stay; the chain ahead is rebuilt (only `ScheduleChain`).
 * With nothing to swap in, or anything else, it returns the input state
 * unchanged, with no intents.
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

      let answered: CoreState;
      if (event.kind === 'Snooze') {
        if (!canSnooze(target, now)) return { state, intents: [dismiss] };
        const refiresAt = now + settled.settings.snoozeMinutes * MINUTE;
        // Not a final Response: lastResponseAt stays as it is.
        const snoozes = (target.snoozes ?? 0) + 1;
        answered = { ...settled, reminders: replace(settled, { ...target, snoozes, refiresAt }) };
      } else {
        // A final Response before a pending re-fire cancels it; the Snooze count stays.
        const { refiresAt: _cancelled, ...withoutRefire } = target;
        const base: Reminder = refirePending(target, now) ? withoutRefire : target;
        const done = event.kind === 'Done' ? doneExercises(target, event.did) : [];
        const answer: Reminder = done.length > 0 ? { ...base, status: 'done', done } : { ...base, status: 'skipped' };
        answered = { ...settled, lastResponseAt: now, reminders: replace(settled, answer) };
      }
      const rebuilt = rearm(answered, deps);
      return { state: rebuilt.state, intents: [dismiss, ...rebuilt.intents] };
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
      const settled = settle(state, now);
      // From tomorrow: today's goal never moves. A change dated tomorrow or later is replaced.
      const from = addDays(localDateOf(now, settled.settings.timeZone), 1);
      const kept = settled.goalChanges.filter((c) => dateKey(c.from) < dateKey(from));
      return { state: { ...settled, goalChanges: [...kept, { from, goal: event.goal }] }, intents: [] };
    }
    case 'Correct': {
      // Settled first, so a fired Reminder superseded but not yet persisted counts as Missed.
      const settled = settle(state, now);
      const target = settled.reminders.find((r) => r.id === event.reminderId);
      if (!target || target.firesAt > now || target.status === 'scheduled') return { state, intents: [] };
      const { timeZone } = settled.settings;
      if (!sameDate(dayOf(target, timeZone), localDateOf(now, timeZone))) return { state, intents: [] };

      const { done: _removed, ...withoutDone } = target;
      let corrected: Reminder;
      if (event.to === 'Done') {
        const done = doneExercises(target, event.did ?? []);
        if (done.length === 0) return { state, intents: [] };
        corrected = { ...target, status: 'done', done };
      } else {
        // Only the outcome changes: `snoozes` and `refiresAt` stay.
        corrected = { ...withoutDone, status: event.to === 'Skip' ? 'skipped' : 'missed' };
      }
      // History only: lastResponseAt and the chain stay, and there are no intents.
      return { state: { ...settled, reminders: replace(settled, corrected) }, intents: [] };
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
    case 'ChangeSettings':
      throw new Error('ChangeSettings: not implemented (#29 CP2)');
    case 'ResetSettings':
      throw new Error('ResetSettings: not implemented (#29 CP2)');
  }
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
