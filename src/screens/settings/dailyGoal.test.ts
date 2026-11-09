import { describe, expect, it } from 'vitest';
import { defaultSettings, initialState, type CoreState, type GoalChange } from '../../core';
import { dailyGoalRow } from './dailyGoal';

const MADRID = { ...defaultSettings, timeZone: 'Europe/Madrid' };
const stateWith = (goalChanges: GoalChange[]): CoreState => ({ ...initialState, settings: MADRID, goalChanges });

// Tuesday 2026-11-10, 23:30 in Madrid (22:30 UTC).
const lateTuesday = Date.UTC(2026, 10, 10, 22, 30);

describe('the Daily Goal row', () => {
  it('is the default 4 today and tomorrow with no change', () => {
    expect(dailyGoalRow(stateWith([]), lateTuesday)).toEqual({ today: 4, tomorrow: 4 });
  });

  it('shows a goal set today for tomorrow, today keeping its own', () => {
    expect(dailyGoalRow(stateWith([{ from: { year: 2026, month: 11, day: 11 }, goal: 7 }]), lateTuesday)).toEqual({
      today: 4,
      tomorrow: 7,
    });
  });

  it('reads today in the Settings time zone, not UTC', () => {
    // 00:30 on Wednesday in Madrid is still Tuesday in UTC.
    const earlyWednesday = Date.UTC(2026, 10, 10, 23, 30);
    expect(dailyGoalRow(stateWith([{ from: { year: 2026, month: 11, day: 11 }, goal: 7 }]), earlyWednesday)).toEqual({
      today: 7,
      tomorrow: 7,
    });
  });

  it('crosses a month end', () => {
    const lastOfNovember = Date.UTC(2026, 10, 30, 12);
    expect(dailyGoalRow(stateWith([{ from: { year: 2026, month: 12, day: 1 }, goal: 2 }]), lastOfNovember)).toEqual({
      today: 4,
      tomorrow: 2,
    });
  });
});
