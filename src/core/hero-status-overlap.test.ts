import { describe, expect, it } from 'vitest';
import { heroStatus, initialState, type CoreState, type Reminder } from './index';

// Europe/Madrid in November 2026: CET, UTC+1. 2 November 2026 is a Monday.
// heroStatus precedence when states overlap: dayOff > paused > next > none.
const ZONE = 'Europe/Madrid';
const at = (time: string): number => Date.parse(`2026-11-02T${time}:00+01:00`);
const MON = { year: 2026, month: 11, day: 2 };

const scheduledAt = (firesAt: number): Reminder => ({
  id: `reminder-${firesAt}`,
  firesAt,
  suggestion: [],
  status: 'scheduled',
});

const base: CoreState = {
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE },
  reminders: [scheduledAt(at('11:45'))],
};

describe('heroStatus: overlapping states', () => {
  it('a Pause running on a Day Off gives dayOff', () => {
    const state: CoreState = { ...base, daysOff: [MON], pauses: [{ from: at('10:00'), until: at('11:00') }] };

    expect(heroStatus(state, at('10:30'))).toEqual({ kind: 'dayOff' });
  });

  it('a Day Off with a Reminder still ahead gives dayOff, not next', () => {
    const state: CoreState = { ...base, daysOff: [MON] };

    expect(heroStatus(state, at('10:30'))).toEqual({ kind: 'dayOff' });
  });

  it('a running Pause with a Reminder ahead gives paused, not next', () => {
    const state: CoreState = { ...base, pauses: [{ from: at('10:00'), until: at('11:00') }] };

    expect(heroStatus(state, at('10:30'))).toEqual({ kind: 'paused', until: at('11:00') });
  });

  it("a future Pause doesn't count as paused before it starts", () => {
    const state: CoreState = { ...base, pauses: [{ from: at('11:00'), until: at('12:00') }] };

    expect(heroStatus(state, at('10:30'))).toEqual({ kind: 'next', at: at('11:45'), snoozed: false });
  });

  it("a Pause that has ended isn't paused: until is exclusive", () => {
    const state: CoreState = { ...base, pauses: [{ from: at('10:00'), until: at('11:00') }] };

    expect(heroStatus(state, at('11:00'))).toEqual({ kind: 'next', at: at('11:45'), snoozed: false });
  });

  it('a Day Off tomorrow leaves today as usual', () => {
    const state: CoreState = { ...base, daysOff: [{ year: 2026, month: 11, day: 3 }] };

    expect(heroStatus(state, at('10:30'))).toEqual({ kind: 'next', at: at('11:45'), snoozed: false });
  });
});
