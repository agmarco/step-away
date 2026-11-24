import { describe, expect, it } from 'vitest';
import { monthBefore, sameMonth, type LocalDate, type YearMonth } from './index';

const ym = (year: number, month: number): YearMonth => ({ year, month });

describe('monthBefore: whether one month comes strictly before another', () => {
  it('is true for an earlier month in the same year', () => {
    expect(monthBefore(ym(2026, 3), ym(2026, 11))).toBe(true);
  });

  it('is true across a year end: December before the next January', () => {
    expect(monthBefore(ym(2025, 12), ym(2026, 1))).toBe(true);
  });

  it('is false for a later month, across a year end too', () => {
    expect(monthBefore(ym(2026, 11), ym(2026, 3))).toBe(false);
    expect(monthBefore(ym(2026, 1), ym(2025, 12))).toBe(false);
  });

  it('is false for an earlier month number in a later year', () => {
    expect(monthBefore(ym(2027, 2), ym(2026, 11))).toBe(false);
  });

  it('is false for the same month', () => {
    expect(monthBefore(ym(2026, 11), ym(2026, 11))).toBe(false);
  });
});

describe('sameMonth: whether two months are the same', () => {
  it('is true for the same year and month', () => {
    expect(sameMonth(ym(2026, 11), ym(2026, 11))).toBe(true);
  });

  it('is false for the same month number in another year', () => {
    expect(sameMonth(ym(2025, 11), ym(2026, 11))).toBe(false);
  });

  it('is false for another month in the same year, and across a year end', () => {
    expect(sameMonth(ym(2026, 10), ym(2026, 11))).toBe(false);
    expect(sameMonth(ym(2025, 12), ym(2026, 1))).toBe(false);
  });

  it("takes a LocalDate as it is: today's month", () => {
    const today: LocalDate = { year: 2026, month: 11, day: 24 };
    expect(sameMonth(ym(2026, 11), today)).toBe(true);
    expect(sameMonth(ym(2026, 12), today)).toBe(false);
  });
});
