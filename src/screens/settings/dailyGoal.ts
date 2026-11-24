import { addDays, dailyGoalFor, localDateOf, type CoreState } from '../../core';

/**
 * The Daily Goal row: today's goal (`dailyGoalFor` today in the Settings'
 * time zone), and tomorrow's, which is what the picker sets (`SetDailyGoal`
 * applies from tomorrow). They differ when a change starts tomorrow.
 */
export function dailyGoalRow(state: CoreState, now: number): { today: number; tomorrow: number } {
  const today = localDateOf(now, state.settings.timeZone);
  return { today: dailyGoalFor(state, today), tomorrow: dailyGoalFor(state, addDays(today, 1)) };
}
