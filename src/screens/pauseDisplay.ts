import { endsAtMidnight, isRunning, type Instant, type Pause, type Reminder } from '../core';

/** One line of Today's list: a fired Reminder, or a Pause. */
export type TodayLine = { kind: 'reminder'; reminder: Reminder } | { kind: 'pause'; pause: Pause };

/**
 * Today's Reminders and Pauses in one list, newest first: a Reminder by when
 * it fired, a Pause by when it started. A Pause started at the same instant a
 * Reminder fired goes above it (it can only have come after). History's day
 * panel lists any day's Reminders and Pauses the same way.
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
 * A Pause's line in Today's list: its span, from its start to its end, the
 * planned end while it runs (the hero's "until"; a Resume or an extension
 * moves it). A running Pause for the rest of today (its `until` a local
 * midnight in `timeZone`, the core's `endsAtMidnight`) ends at "end of day".
 * `timeOf` formats a time (Today's `timeOf`; tests pass a fixed one).
 */
export function pauseLine(pause: Pause, now: Instant, timeZone: string, timeOf: (at: Instant) => string): string {
  const end = isRunning(pause, now) && endsAtMidnight(pause.until, timeZone) ? 'end of day' : timeOf(pause.until);
  return `Paused ${timeOf(pause.from)}–${end}`;
}
