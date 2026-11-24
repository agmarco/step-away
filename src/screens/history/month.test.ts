import { describe, expect, it } from 'vitest';
import { dayKindOf, leadingBlanks, monthBefore, selectionAfterStep, shiftMonth, weeksOf } from './month';

describe("leadingBlanks: the empty cells before a month's first day, weeks starting Monday", () => {
  it('is 0 for a month that starts on a Monday (June 2026)', () => {
    expect(leadingBlanks({ year: 2026, month: 6 })).toBe(0);
  });

  it('is 3 for a month that starts on a Thursday (October 2026)', () => {
    expect(leadingBlanks({ year: 2026, month: 10 })).toBe(3);
  });

  it('is 6 for a month that starts on a Sunday (November 2026)', () => {
    expect(leadingBlanks({ year: 2026, month: 11 })).toBe(6);
  });
});

describe('shiftMonth: the month some months before or after', () => {
  it('steps forward and back within a year', () => {
    expect(shiftMonth({ year: 2026, month: 6 }, 1)).toEqual({ year: 2026, month: 7 });
    expect(shiftMonth({ year: 2026, month: 6 }, -1)).toEqual({ year: 2026, month: 5 });
  });

  it('crosses a year end both ways', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 11 }, 12)).toEqual({ year: 2027, month: 11 });
  });
});

describe('monthBefore: whether one month comes before another', () => {
  it('compares by year, then by month', () => {
    expect(monthBefore({ year: 2026, month: 3 }, { year: 2026, month: 4 })).toBe(true);
    expect(monthBefore({ year: 2026, month: 4 }, { year: 2026, month: 4 })).toBe(false);
    expect(monthBefore({ year: 2025, month: 12 }, { year: 2026, month: 1 })).toBe(true);
    expect(monthBefore({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBe(false);
  });
});

describe("weeksOf: a month's days as Monday-first rows of seven, blanks as null", () => {
  const daysOf = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('starts the first row with the 1st for a month that starts on a Monday (June 2026)', () => {
    const weeks = weeksOf({ year: 2026, month: 6 }, daysOf(30));
    expect(weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weeks).toHaveLength(5);
    expect(weeks[4]).toEqual([29, 30, null, null, null, null, null]);
  });

  it('puts the 1st under Sunday after 6 blanks for a month that starts on a Sunday (November 2026)', () => {
    const weeks = weeksOf({ year: 2026, month: 11 }, daysOf(30));
    expect(weeks[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(weeks[4]?.[0]).toBe(23);
    expect(weeks).toHaveLength(6);
    expect(weeks[5]).toEqual([30, null, null, null, null, null, null]);
  });

  it('is exactly 4 full rows for a 28-day February that starts on a Monday (February 2027)', () => {
    const weeks = weeksOf({ year: 2027, month: 2 }, daysOf(28));
    expect(weeks).toHaveLength(4);
    expect(weeks.flat()).toEqual(daysOf(28));
  });

  it('makes every row seven long, whatever the month', () => {
    for (let month = 1; month <= 12; month++) {
      const days = new Date(Date.UTC(2026, month, 0)).getUTCDate();
      for (const row of weeksOf({ year: 2026, month }, daysOf(days))) expect(row).toHaveLength(7);
    }
  });
});

describe('selectionAfterStep: the selected day after stepping to another month', () => {
  const today = { year: 2026, month: 11, day: 24 };

  it("is today when the month is today's month", () => {
    expect(selectionAfterStep({ year: 2026, month: 11 }, today)).toEqual(today);
  });

  it('is nothing for any other month, even the same month of another year', () => {
    expect(selectionAfterStep({ year: 2026, month: 10 }, today)).toBeNull();
    expect(selectionAfterStep({ year: 2026, month: 12 }, today)).toBeNull();
    expect(selectionAfterStep({ year: 2027, month: 11 }, today)).toBeNull();
  });
});

describe('dayKindOf: whether a day is past, today or ahead', () => {
  const today = { year: 2026, month: 11, day: 24 };

  it('is today for the same date', () => {
    expect(dayKindOf({ year: 2026, month: 11, day: 24 }, today)).toBe('today');
  });

  it('is past for an earlier day of the month and future for a later one', () => {
    expect(dayKindOf({ year: 2026, month: 11, day: 23 }, today)).toBe('past');
    expect(dayKindOf({ year: 2026, month: 11, day: 25 }, today)).toBe('future');
  });

  it('orders across a month boundary by month, not by day number', () => {
    expect(dayKindOf({ year: 2026, month: 10, day: 31 }, today)).toBe('past');
    expect(dayKindOf({ year: 2026, month: 12, day: 1 }, today)).toBe('future');
  });

  it('orders across a year boundary by year, not by month or day number', () => {
    expect(dayKindOf({ year: 2025, month: 12, day: 31 }, today)).toBe('past');
    expect(dayKindOf({ year: 2027, month: 1, day: 1 }, today)).toBe('future');
  });
});
