import { describe, expect, it } from 'vitest';
import { initialState, outstandingReminder, type CoreState, type Reminder } from './index';

// Plain epoch instants: the rule is about order in time, not wall-clock zones.
const T = (minutes: number): number => Date.UTC(2026, 10, 2, 9, 0) + minutes * 60_000;

const reminder = (firesAt: number, status: Reminder['status'] = 'scheduled'): Reminder => ({
  id: `reminder-${firesAt}`,
  firesAt,
  suggestion: [],
  status,
});

const withReminders = (...reminders: Reminder[]): CoreState => ({ ...initialState, reminders });

describe('outstandingReminder', () => {
  it('is the latest fired Reminder while it has no Response', () => {
    const state = withReminders(reminder(T(45)), reminder(T(90)), reminder(T(135)));
    expect(outstandingReminder(state, T(100))?.id).toBe(`reminder-${T(90)}`);
  });

  it('counts a Reminder firing exactly now as fired', () => {
    const state = withReminders(reminder(T(45)), reminder(T(90)));
    expect(outstandingReminder(state, T(90))?.id).toBe(`reminder-${T(90)}`);
  });

  it('is none before the first Reminder fires', () => {
    expect(outstandingReminder(withReminders(reminder(T(45))), T(44))).toBeUndefined();
  });

  it('is none once the latest fired Reminder was skipped, even if an earlier one was not', () => {
    const state = withReminders(reminder(T(45)), reminder(T(90), 'skipped'), reminder(T(135)));
    expect(outstandingReminder(state, T(100))).toBeUndefined();
  });

  it('keeps a snoozed Reminder whose re-fire lands past closing outstanding until the window end', () => {
    // Default Settings: Monday 09:00-18:00 UTC. Fired 17:15, re-fire 18:05 is past the 18:00 end.
    const state = withReminders({ ...reminder(T(495)), snoozes: 1, refiresAt: T(545) });
    expect(outstandingReminder(state, T(530))?.id).toBe(`reminder-${T(495)}`);
    expect(outstandingReminder(state, T(540))).toBeUndefined();
  });

  it('is none for an empty state', () => {
    expect(outstandingReminder(initialState, T(0))).toBeUndefined();
  });
});
