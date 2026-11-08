import { MAX_SNOOZES, notificationFor, refireNotificationFor } from './notification';
import { chainTimes, outstandingReminder, reminderId } from './schedule';
import { MINUTE } from './localTime';
import { refirePending, refireScheduled, settle } from './settle';
import { suggest } from './suggest';
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
};

export const initialState: CoreState = {
  lastAppOpenAt: null,
  settings: defaultSettings,
  reminders: [],
  lastResponseAt: null,
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
 * future is replaced by the freshly computed chain. A Reminder whose fire time
 * is unchanged keeps its Id and its Suggestion; new ones get a Suggestion
 * picked now. With an empty library no Suggestion can be made, so nothing is
 * scheduled.
 *
 * A pending Snooze re-fire is scheduled too (the chain intent replaces every
 * scheduled notification), unless it lands at or after its day's window end:
 * that one is never scheduled and settles as dropped at closing.
 */
function rearm(state: CoreState, deps: CoreDeps): CoreResult {
  const now = deps.clock.now();
  const library = deps.library ?? [];
  const fired = state.reminders.filter((r) => r.firesAt <= now);
  const previous = new Map(state.reminders.filter((r) => r.firesAt > now).map((r) => [r.id, r]));

  const refires: ScheduledNotification[] = [];
  for (const r of fired) {
    if (r.refiresAt === undefined || !refireScheduled(r, state.settings, now)) continue;
    refires.push(refireNotificationFor({ ...r, refiresAt: r.refiresAt }));
  }

  const chain: Reminder[] = [];
  for (const firesAt of library.length > 0 ? chainTimes(state, now) : []) {
    const id = reminderId(firesAt);
    const suggestion =
      previous.get(id)?.suggestion ?? suggest(library, state.settings.exercisesPerSuggestion, deps.random);
    chain.push({ id, firesAt, suggestion, status: 'scheduled' });
  }

  return {
    state: { ...state, reminders: [...fired, ...chain] },
    intents: [
      { type: 'ScheduleChain', reminders: [...refires, ...chain.map(notificationFor)].sort((a, b) => a.at - b.at) },
    ],
  };
}
