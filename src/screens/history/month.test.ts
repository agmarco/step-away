import { describe, expect, it } from 'vitest';
import { leadingBlanks, monthBefore, shiftMonth } from './month';

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
