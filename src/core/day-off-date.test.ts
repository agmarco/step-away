import { describe, expect, it } from 'vitest';
import { canSetDayOff, initialState, type CoreState, type LocalDate } from './index';

const inZone = (timeZone: string): CoreState => ({ ...initialState, settings: { ...initialState.settings, timeZone } });
const date = (iso: string): LocalDate => {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
};

// Europe/Madrid in November 2026 is CET, UTC+1; America/New_York is EST, UTC-5.
const MADRID = inZone('Europe/Madrid');
const NEW_YORK = inZone('America/New_York');

describe('canSetDayOff: a Day Off can be set or undone for today or a later date', () => {
  const now = Date.parse('2026-11-03T10:00:00+01:00'); // Tuesday 3 November, Madrid

  it('is false for yesterday', () => {
    expect(canSetDayOff(MADRID, date('2026-11-02'), now)).toBe(false);
  });

  it('is true for today', () => {
    expect(canSetDayOff(MADRID, date('2026-11-03'), now)).toBe(true);
  });

  it('is true for tomorrow, and further ahead', () => {
    expect(canSetDayOff(MADRID, date('2026-11-04'), now)).toBe(true);
    expect(canSetDayOff(MADRID, date('2027-01-15'), now)).toBe(true);
  });

  it('is false for a day long past', () => {
    expect(canSetDayOff(MADRID, date('2025-12-31'), now)).toBe(false);
  });
});

describe("canSetDayOff: today is the Settings' time zone's date, not UTC's", () => {
  it('just after local midnight, while UTC is still on the previous day', () => {
    const now = Date.parse('2026-11-03T00:30:00+01:00'); // 2 November 23:30 UTC

    expect(canSetDayOff(MADRID, date('2026-11-02'), now)).toBe(false);
    expect(canSetDayOff(MADRID, date('2026-11-03'), now)).toBe(true);
  });

  it('late in the local evening, while UTC is already on the next day', () => {
    const now = Date.parse('2026-11-02T23:30:00-05:00'); // 3 November 04:30 UTC

    expect(canSetDayOff(NEW_YORK, date('2026-11-01'), now)).toBe(false);
    expect(canSetDayOff(NEW_YORK, date('2026-11-02'), now)).toBe(true);
  });
});
