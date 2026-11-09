import { dailyGoalFor, type CoreState, type LocalDate } from '../../core';
import { localDateIn } from '../today/format';

/** The calendar day after `date`. */
function nextDay({ year, month, day }: LocalDate): LocalDate {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/**
 * The Daily Goal row: today's goal (`dailyGoalFor` today in the Settings'
 * time zone), and tomorrow's, which is what the picker sets (`SetDailyGoal`
 * applies from tomorrow). They differ when a change starts tomorrow.
 */
export function dailyGoalRow(state: CoreState, now: number): { today: number; tomorrow: number } {
  const today = localDateIn(now, state.settings.timeZone);
  return { today: dailyGoalFor(state, today), tomorrow: dailyGoalFor(state, nextDay(today)) };
}
