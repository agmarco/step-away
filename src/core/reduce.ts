import { notificationFor } from './notification';
import { chainTimes, outstandingReminder, reminderId } from './schedule';
import { suggest } from './suggest';
import type { CoreDeps, CoreEvent, CoreResult, CoreState, Intent, Reminder, Settings } from './types';

const weekday = { start: 9 * 60, end: 18 * 60 };

/** Mon-Fri 09:00-18:00, weekends off, 45-minute Interval, 10-minute Snooze delay. The adapter sets `timeZone` from the device. */
export const defaultSettings: Settings = {
  activeHours: { mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: null, sun: null },
  intervalMinutes: 45,
  timeZone: 'UTC',
  snoozeMinutes: 10,
};

export const initialState: CoreState = {
  lastAppOpenAt: null,
  settings: defaultSettings,
  reminders: [],
  lastResponseAt: null,
};

/** The core's one entry point: (state, event, { clock, random, library }) -> { state, intents }. */
export function reduce(state: CoreState, event: CoreEvent, deps: CoreDeps): CoreResult {
  const now = deps.clock.now();
  switch (event.type) {
    case 'AppOpened':
      return { state: { ...state, lastAppOpenAt: now }, intents: [] };
    case 'Rearm': {
      const timeZone = event.timeZone ?? state.settings.timeZone;
      return rearm({ ...state, settings: { ...state.settings, timeZone } }, deps);
    }
    case 'Response': {
      if (event.kind === 'Snooze') throw new Error('not implemented');
      const dismiss: Intent = { type: 'DismissNotification', reminderId: event.reminderId };
      if (outstandingReminder(state, now)?.id !== event.reminderId) return { state, intents: [dismiss] };
      const skipped: CoreState = {
        ...state,
        lastResponseAt: now,
        reminders: state.reminders.map((r) => (r.id === event.reminderId ? { ...r, status: 'skipped' } : r)),
      };
      const rebuilt = rearm(skipped, deps);
      return { state: rebuilt.state, intents: [dismiss, ...rebuilt.intents] };
    }
  }
}

/**
 * Rebuilds the chain ahead: fired Reminders stay in state as they are; the
 * future is replaced by the freshly computed chain. A Reminder whose fire time
 * is unchanged keeps its Id and its Suggestion; new ones get a Suggestion
 * picked now. With an empty library no Suggestion can be made, so nothing is
 * scheduled.
 */
function rearm(state: CoreState, deps: CoreDeps): CoreResult {
  const now = deps.clock.now();
  const library = deps.library ?? [];
  const fired = state.reminders.filter((r) => r.firesAt <= now);
  const previous = new Map(state.reminders.filter((r) => r.firesAt > now).map((r) => [r.id, r]));

  const chain: Reminder[] = [];
  for (const firesAt of library.length > 0 ? chainTimes(state, now) : []) {
    const id = reminderId(firesAt);
    const suggestion = previous.get(id)?.suggestion ?? suggest(library, deps.random);
    chain.push({ id, firesAt, suggestion, status: 'scheduled' });
  }

  return {
    state: { ...state, reminders: [...fired, ...chain] },
    intents: [{ type: 'ScheduleChain', reminders: chain.map(notificationFor) }],
  };
}
