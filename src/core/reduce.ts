import type { CoreDeps, CoreEvent, CoreResult, CoreState, Settings } from './types';

const weekday = { start: 9 * 60, end: 18 * 60 };

/** Mon-Fri 09:00-18:00, weekends off, 45-minute Interval. The adapter sets `timeZone` from the device. */
export const defaultSettings: Settings = {
  activeHours: { mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: null, sun: null },
  intervalMinutes: 45,
  timeZone: 'UTC',
};

export const initialState: CoreState = {
  lastAppOpenAt: null,
  settings: defaultSettings,
  reminders: [],
  lastResponseAt: null,
};

/** The core's one entry point: (state, event, { clock, random, library }) -> { state, intents }. */
export function reduce(state: CoreState, event: CoreEvent, deps: CoreDeps): CoreResult {
  switch (event.type) {
    case 'AppOpened':
      return { state: { ...state, lastAppOpenAt: deps.clock.now() }, intents: [] };
    case 'Rearm':
      throw new Error('not implemented');
    case 'Response':
      throw new Error('not implemented');
  }
}
