import { endsAtMidnight, isRunning, type Instant, type Pause, type Reminder } from '../core';

/** One line of a day's list (Today's, History's day panel): a fired Reminder, or a Pause. */
export type TodayLine = { kind: 'reminder'; reminder: Reminder } | { kind: 'pause'; pause: Pause };

/**
 * A day's Reminders and Pauses in one list, newest first, for Today and
 * History's day panel: a Reminder by when it fired, a Pause by when it
 * started. A Pause started at the same instant a Reminder fired goes above it
 * (it can only have come after).
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
 * A Pause's line in a day's list (Today's, History's day panel): its span,
 * from its start to its end, the planned end while it runs (the hero's
 * "until"; a Resume or an extension moves it). A running Pause for the rest of today (its `until` a local
 * midnight in `timeZone`, the core's `endsAtMidnight`) ends at "end of day".
 * `timeOf` formats a time (`format`'s `timeOf`; tests pass a fixed one).
 */
export function pauseLine(pause: Pause, now: Instant, timeZone: string, timeOf: (at: Instant) => string): string {
  const end = isRunning(pause, now) && endsAtMidnight(pause.until, timeZone) ? 'end of day' : timeOf(pause.until);
  return `Paused ${timeOf(pause.from)}–${end}`;
}
