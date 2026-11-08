import { describe, expect, it } from 'vitest';
import { initialState, isOutstanding, type CoreState, type Reminder } from './index';

// Plain epoch instants: the rule is about order in time, not wall-clock zones.
const T = (minutes: number): number => Date.UTC(2026, 10, 2, 9, 0) + minutes * 60_000;

const reminder = (firesAt: number, status: Reminder['status'] = 'scheduled'): Reminder => ({
  id: `reminder-${firesAt}`,
  firesAt,
  suggestion: [],
  status,
});

const withReminders = (...reminders: Reminder[]): CoreState => ({ ...initialState, reminders });

describe('isOutstanding', () => {
  it('is true for the latest fired Reminder while it has no Response', () => {
    const state = withReminders(reminder(T(45)), reminder(T(90)));
    expect(isOutstanding(state, `reminder-${T(90)}`, T(100))).toBe(true);
  });

  it('is false for a Reminder a newer one has replaced', () => {
    const state = withReminders(reminder(T(45)), reminder(T(90)));
    expect(isOutstanding(state, `reminder-${T(45)}`, T(100))).toBe(false);
  });

  it('is false for an unknown Reminder', () => {
    const state = withReminders(reminder(T(45)));
    expect(isOutstanding(state, 'reminder-unknown', T(50))).toBe(false);
  });

  it('is false when nothing is outstanding', () => {
    expect(isOutstanding(initialState, 'reminder-unknown', T(0))).toBe(false);
  });
});
