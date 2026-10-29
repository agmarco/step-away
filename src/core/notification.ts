import { formatDose } from './dose';
import type { NotificationAction, Reminder, ScheduledNotification } from './types';

const TITLE = 'Time to move';
const ACTIONS: readonly NotificationAction[] = ['start', 'snooze', 'skip'];

/** The notification the adapter schedules for one Reminder. */
export function notificationFor(reminder: Reminder): ScheduledNotification {
  return {
    reminderId: reminder.id,
    at: reminder.firesAt,
    title: TITLE,
    body: reminder.suggestion.map((e) => `${e.name} · ${formatDose(e.dose)} · ${e.cue}`).join('\n'),
    actions: [...ACTIONS],
  };
}
