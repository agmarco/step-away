// PROTOTYPE — throwaway (#12). Variant C's notification (Start / Snooze / Skip) and the one
// handler both delivery paths call: the background task and the foreground listener.
import * as Notifications from 'expo-notifications';
import { createReminder, recordResponse, Source } from './db';

export const CHANNEL = 'reminders';
export const CATEGORY = 'probe';
export const CATEGORY_NO_SNOOZE = 'probe_ns';
export const SNOOZE_SECONDS = 10;
// After Skip the next Reminder is scheduled from wherever the Skip was handled, so a
// chain keeps going without the app ever being opened.
export const NEXT_AFTER_SKIP_SECONDS = 20;

export async function setup() {
  await Notifications.requestPermissionsAsync();
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  const actions = (snooze: boolean) => [
    { identifier: 'start', buttonTitle: 'Start', options: { opensAppToForeground: true } },
    ...(snooze ? [{ identifier: 'snooze', buttonTitle: 'Snooze', options: { opensAppToForeground: false } }] : []),
    { identifier: 'skip', buttonTitle: 'Skip', options: { opensAppToForeground: false } },
  ];
  await Notifications.setNotificationCategoryAsync(CATEGORY, actions(true));
  await Notifications.setNotificationCategoryAsync(CATEGORY_NO_SNOOZE, actions(false));
}

export async function fireReminder(seconds: number) {
  const id = await createReminder();
  await show(id, 0, seconds);
  return id;
}

async function show(reminderId: number, snoozes: number, seconds: number) {
  await Notifications.scheduleNotificationAsync({
    identifier: `r${reminderId}s${snoozes}`,
    content: {
      title: snoozes ? `Probe Reminder #${reminderId} (snoozed ${snoozes}×)` : `Probe Reminder #${reminderId}`,
      body: 'Shoulder Circles · 10 reps',
      categoryIdentifier: snoozes >= 2 ? CATEGORY_NO_SNOOZE : CATEGORY,
      data: { reminderId, snoozes },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL },
  });
}

// Shared by both paths. Returns what happened, for the on-screen log.
export async function handleAction(actionId: string, data: unknown, notificationId: string | undefined, source: Source) {
  const { reminderId, snoozes } = (data ?? {}) as { reminderId?: number; snoozes?: number };
  if (typeof reminderId !== 'number') return `ignored ${actionId}: no reminderId`;
  if (actionId === 'skip') {
    const won = await recordResponse(reminderId, 'Skip', source);
    if (notificationId) await Notifications.dismissNotificationAsync(notificationId).catch(() => {});
    if (won) await fireReminder(NEXT_AFTER_SKIP_SECONDS);
    return `Skip #${reminderId} ${won ? 'won' : 'lost'}`;
  }
  if (actionId === 'snooze') {
    const won = await recordResponse(reminderId, 'Snooze', source, snoozes ?? 0);
    if (notificationId) await Notifications.dismissNotificationAsync(notificationId).catch(() => {});
    if (won) await show(reminderId, (snoozes ?? 0) + 1, SNOOZE_SECONDS);
    return `Snooze #${reminderId} ${won ? 'won' : 'lost'}`;
  }
  return `${actionId} #${reminderId}: opens the app`;
}
