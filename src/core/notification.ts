import { formatDose } from './dose';
import type { NotificationAction, Reminder, ScheduledNotification } from './types';

const TITLE = 'Time to move';
const SNOOZED_TITLE = 'Time to move (snoozed)';
const ACTIONS: readonly NotificationAction[] = ['start', 'snooze', 'skip'];
/** After this many Snoozes the notification offers only Start and Skip. */
export const MAX_SNOOZES = 2;

/** The notification the adapter schedules for one upcoming Reminder. */
export function notificationFor(reminder: Reminder): ScheduledNotification {
  return {
    reminderId: reminder.id,
    at: reminder.firesAt,
    title: TITLE,
    body: bodyOf(reminder),
    actions: [...ACTIONS],
  };
}

/**
 * The notification for a snoozed Reminder's re-fire: same Id and body, at
 * `refiresAt`, with a title that says it was snoozed. Once snoozed
 * `MAX_SNOOZES` times it offers only Start and Skip.
 */
export function refireNotificationFor(reminder: Reminder & { refiresAt: number }): ScheduledNotification {
  const snoozes = reminder.snoozes ?? 0;
  return {
    reminderId: reminder.id,
    at: reminder.refiresAt,
    title: SNOOZED_TITLE,
    body: bodyOf(reminder),
    actions: snoozes >= MAX_SNOOZES ? ACTIONS.filter((a) => a !== 'snooze') : [...ACTIONS],
    snoozes,
  };
}

function bodyOf(reminder: Reminder): string {
  return reminder.suggestion.map((e) => `${e.name} · ${formatDose(e.dose)} · ${e.cue}`).join('\n');
}
