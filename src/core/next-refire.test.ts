import { describe, expect, it } from 'vitest';
import { initialState, nextReminder, type CoreState, type Reminder } from './index';

// Local times are Europe/Madrid in November 2026: CET, UTC+1. Default Settings: Mon-Fri 09:00-18:00.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';
const at = (time: string) => local(MON, time);

const reminder = (firesAt: number, extra: Partial<Reminder> = {}): Reminder => ({
  id: `reminder-${firesAt}`,
  firesAt,
  suggestion: [],
  status: 'scheduled',
  ...extra,
});

const inMadrid = (...reminders: Reminder[]): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE },
  reminders,
});

describe('nextReminder with a pending Snooze re-fire', () => {
  it('is the snoozed Reminder when its re-fire comes before the chain', () => {
    // 09:45 snoozed at 09:45 + 10 min: back at 09:55; the chain counts from the re-fire, so 10:40.
    const state = inMadrid(reminder(at('09:45'), { snoozes: 1, refiresAt: at('09:55') }), reminder(at('10:40')));
    expect(nextReminder(state, at('09:50'))?.id).toBe(`reminder-${at('09:45')}`);
  });

  it('is the chain once the re-fire has fired', () => {
    const state = inMadrid(reminder(at('09:45'), { snoozes: 1, refiresAt: at('09:55') }), reminder(at('10:40')));
    expect(nextReminder(state, at('09:55'))?.id).toBe(`reminder-${at('10:40')}`);
  });

  it('is the earliest of the re-fire and the chain', () => {
    const state = inMadrid(reminder(at('09:45'), { snoozes: 1, refiresAt: at('11:00') }), reminder(at('10:30')));
    expect(nextReminder(state, at('10:00'))?.id).toBe(`reminder-${at('10:30')}`);
  });

  it('skips a re-fire that lands at or after its window end: it is never scheduled', () => {
    // 17:55 snoozed: 18:05 is past Monday's 18:00 close, so it will be dropped; next is Tuesday 09:45.
    const state = inMadrid(
      reminder(at('17:55'), { snoozes: 1, refiresAt: at('18:05') }),
      reminder(local('2026-11-03', '09:45')),
    );
    expect(nextReminder(state, at('17:58'))?.id).toBe(`reminder-${local('2026-11-03', '09:45')}`);
  });

  it('skips a Reminder no longer scheduled, even with a re-fire ahead', () => {
    const state = inMadrid(
      reminder(at('09:45'), { status: 'missed', snoozes: 1, refiresAt: at('09:55') }),
      reminder(at('10:40')),
    );
    expect(nextReminder(state, at('09:50'))?.id).toBe(`reminder-${at('10:40')}`);
  });
});
