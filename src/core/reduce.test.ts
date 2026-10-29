import { describe, expect, it } from 'vitest';
import { initialState, reduce, seededRandom, type Clock } from './index';

const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso).getTime() });

describe('reduce', () => {
  it('records when the app was opened and asks the platform for nothing', () => {
    const deps = { clock: fixedClock('2026-10-29T09:15:00Z'), random: seededRandom(42) };

    const result = reduce(initialState, { type: 'AppOpened' }, deps);

    expect(result.state.lastAppOpenAt).toBe(Date.UTC(2026, 9, 29, 9, 15));
    expect(result.intents).toEqual([]);
  });
});
