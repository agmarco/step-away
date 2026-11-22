import { describe, expect, it } from 'vitest';
import { initialState, isDayOff, localDateOf, type CoreState } from './index';

describe('isDayOff', () => {
  const state: CoreState = { ...initialState, daysOff: [{ year: 2026, month: 11, day: 11 }] };

  it('is true on a date taken off', () => {
    expect(isDayOff(state, { year: 2026, month: 11, day: 11 })).toBe(true);
  });

  it('is false on any other date', () => {
    expect(isDayOff(state, { year: 2026, month: 11, day: 10 })).toBe(false);
    expect(isDayOff(state, { year: 2026, month: 12, day: 11 })).toBe(false);
  });
});

describe('localDateOf', () => {
  it('is the calendar date in the given time zone, not UTC', () => {
    // 23:30 UTC on Tuesday 2026-11-10 is 00:30 on Wednesday in Madrid.
    expect(localDateOf(Date.UTC(2026, 10, 10, 23, 30), 'Europe/Madrid')).toEqual({ year: 2026, month: 11, day: 11 });
    expect(localDateOf(Date.UTC(2026, 10, 10, 23, 30), 'UTC')).toEqual({ year: 2026, month: 11, day: 10 });
  });
});
