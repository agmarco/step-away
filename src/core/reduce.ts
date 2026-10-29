import type { CoreDeps, CoreEvent, CoreResult, CoreState } from './types';

export const initialState: CoreState = { lastAppOpenAt: null };

/** The core's one entry point: (state, event, { clock, random }) -> { state, intents }. */
export function reduce(state: CoreState, event: CoreEvent, deps: CoreDeps): CoreResult {
  switch (event.type) {
    case 'AppOpened':
      return { state: { ...state, lastAppOpenAt: deps.clock.now() }, intents: [] };
  }
}
