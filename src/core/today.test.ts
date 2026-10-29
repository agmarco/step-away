import { describe, expect, it } from 'vitest';
import { initialState, nextReminder, todaysReminders, type CoreState, type Reminder } from './index';

// Local times are Europe/Madrid in November 2026: CET, UTC+1.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);

const reminder = (firesAt: number, status: Reminder['status'] = 'scheduled'): Reminder => ({
  id: `reminder-${firesAt}`,
  firesAt,
  suggestion: [],
  status,
});

const inMadrid = (...reminders: Reminder[]): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE },
  reminders,
});

const ids = (reminders: Reminder[]) => reminders.map((r) => r.id);

describe('todaysReminders', () => {
  it("is the fired Reminders of today's local date in the Settings' time zone, newest first", () => {
    // 00:15 on the 2nd in Madrid is 23:15 UTC on the 1st, so a day read in
    // UTC (or in the machine's zone) would drop it.
    const yesterdayLate = reminder(local('2026-11-01', '23:30'));
    const justAfterMidnight = reminder(local('2026-11-02', '00:15'), 'skipped');
    const morning = reminder(local('2026-11-02', '09:45'));
    const later = reminder(local('2026-11-02', '18:30'));
    const state = inMadrid(yesterdayLate, justAfterMidnight, morning, later);

    expect(ids(todaysReminders(state, local('2026-11-02', '10:00')))).toEqual([
      `reminder-${local('2026-11-02', '09:45')}`,
      `reminder-${local('2026-11-02', '00:15')}`,
    ]);
  });

  it('counts a Reminder firing exactly now as fired', () => {
    const state = inMadrid(reminder(local('2026-11-02', '09:45')));
    expect(ids(todaysReminders(state, local('2026-11-02', '09:45')))).toEqual([
      `reminder-${local('2026-11-02', '09:45')}`,
    ]);
  });

  it('is empty when nothing has fired today', () => {
    const state = inMadrid(reminder(local('2026-11-01', '17:15')), reminder(local('2026-11-02', '09:45')));
    expect(todaysReminders(state, local('2026-11-02', '09:00'))).toEqual([]);
  });
});

describe('nextReminder', () => {
  it('is the first scheduled Reminder that fires after now', () => {
    const state = inMadrid(
      reminder(local('2026-11-02', '09:45')),
      reminder(local('2026-11-02', '10:30'), 'skipped'),
      reminder(local('2026-11-02', '11:15')),
      reminder(local('2026-11-02', '12:00')),
    );
    expect(nextReminder(state, local('2026-11-02', '10:00'))?.id).toBe(`reminder-${local('2026-11-02', '11:15')}`);
  });

  it('does not count a Reminder firing exactly now', () => {
    const state = inMadrid(reminder(local('2026-11-02', '09:45')), reminder(local('2026-11-02', '10:30')));
    expect(nextReminder(state, local('2026-11-02', '09:45'))?.id).toBe(`reminder-${local('2026-11-02', '10:30')}`);
  });

  it('is none when nothing is ahead', () => {
    expect(nextReminder(inMadrid(reminder(local('2026-11-02', '09:45'))), local('2026-11-02', '10:00'))).toBeUndefined();
  });
});
