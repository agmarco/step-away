import type { Pause, Reminder } from '../../core';

/** One line of Today's list: a fired Reminder, or a Pause. */
export type TodayLine = { kind: 'reminder'; reminder: Reminder } | { kind: 'pause'; pause: Pause };

/**
 * Today's Reminders and Pauses in one list, newest first: a Reminder by when
 * it fired, a Pause by when it started. A Pause started at the same instant a
 * Reminder fired goes above it (it can only have come after).
 */
export function todayLines(reminders: Reminder[], pauses: Pause[]): TodayLine[] {
  const at = (line: TodayLine) => (line.kind === 'reminder' ? line.reminder.firesAt : line.pause.from);
  const lines: TodayLine[] = [
    ...reminders.map((reminder) => ({ kind: 'reminder' as const, reminder })),
    ...pauses.map((pause) => ({ kind: 'pause' as const, pause })),
  ];
  return lines.sort((a, b) => at(b) - at(a) || (a.kind === 'pause' ? -1 : 0) - (b.kind === 'pause' ? -1 : 0));
}
