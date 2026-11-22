import type { DropReason, Pause, Reminder } from '../../core';

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

/**
 * Whether `until` is a local midnight in `timeZone` (the Settings' time zone),
 * as a Pause for the rest of today ends: the hero then says "Paused for the
 * rest of today" instead of a time.
 */
export function endsAtMidnight(until: number, timeZone: string): boolean {
  const time = new Date(until).toLocaleTimeString('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return time === '00:00:00' && until % 1000 === 0;
}

/**
 * Why a dropped Reminder was dropped, for its line on Today: the reason the
 * core stored when it dropped it. None stored means closing: every Reminder
 * dropped before the reason was stored was a Snooze re-fire past closing.
 */
export function dropReason(reminder: Reminder): DropReason {
  return reminder.droppedBy ?? 'closing';
}
