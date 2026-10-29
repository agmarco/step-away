/**
 * Carries out the core's notification intents with expo-notifications.
 *
 * Exact, Doze-safe delivery: DATE triggers. With the exact-alarm permission
 * (EXACT_ALARM_PERMISSION in app.config.ts) expo-notifications 58 schedules
 * them with AlarmManager.setExactAndAllowWhileIdle (ExpoSchedulingDelegate
 * .setupAlarm, `bestEffort` delivery). Expo re-arms scheduled notifications
 * after a reboot itself (its BOOT_COMPLETED receiver).
 *
 * A notification's identifier is the Reminder Id (it is also the Android tag
 * in the shade), so the core's Reminder Ids address notifications directly.
 */
import * as Notifications from 'expo-notifications';
import { outstandingReminder, type CoreState, type Instant, type Intent, type ScheduledNotification } from '../core';

export const CHANNEL = 'reminders';
export const CATEGORY = 'reminder';
/** Android group key: stale Reminders left in the shade bundle into one group. */
const GROUP = 'reminders';
/** Reminder Ids start with this (core/schedule.ts reminderId); other notifications are left alone. */
const REMINDER_PREFIX = 'reminder-';

/**
 * The most notifications scheduled at once. The default chain is about 60
 * over 7 days; Android caps an app at 500 pending alarms. The dev test mode
 * (2-minute Interval, all day) yields ~5000, so only the first ones are armed;
 * the rest are armed by the next Rearm, which happens whenever JS runs.
 */
const MAX_SCHEDULED = 100;

/** The action identifiers, as the core names them (NotificationAction). */
export const ACTION = { start: 'start', snooze: 'snooze', skip: 'skip' } as const;

/** UI context only: permission, channel, category, and how to show a Reminder while the app is in front. */
export async function setup() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.requestPermissionsAsync();
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    // eslint-plugin-import can't follow this enum through the package's export *; TypeScript can.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: ACTION.start, buttonTitle: 'Start', options: { opensAppToForeground: true } },
    { identifier: ACTION.snooze, buttonTitle: 'Snooze', options: { opensAppToForeground: false } },
    { identifier: ACTION.skip, buttonTitle: 'Skip', options: { opensAppToForeground: false } },
  ]);
}

async function scheduleChain(reminders: ScheduledNotification[]) {
  // Cancels scheduled (future) notifications only; presented ones stay in the shade.
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  // A DATE trigger in the past is never armed, so skip any that slipped behind now.
  for (const n of reminders.filter((r) => r.at > now).slice(0, MAX_SCHEDULED)) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: n.reminderId,
        content: {
          title: n.title,
          body: n.body,
          categoryIdentifier: CATEGORY,
          threadIdentifier: GROUP,
          data: { reminderId: n.reminderId },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: CHANNEL },
      });
    } catch (e) {
      console.warn(`[notifications] could not schedule ${n.reminderId}: ${e}`);
    }
  }
}

export async function applyIntents(intents: Intent[]) {
  for (const intent of intents) {
    switch (intent.type) {
      case 'ScheduleChain':
        await scheduleChain(intent.reminders);
        break;
      case 'DismissNotification':
        await Notifications.dismissNotificationAsync(intent.reminderId).catch(() => {});
        break;
    }
  }
}

/** Removes every Reminder notification in the shade except the outstanding one. */
export async function dismissStale(state: CoreState, now: Instant) {
  const keep = outstandingReminder(state, now)?.id;
  const presented = await Notifications.getPresentedNotificationsAsync();
  for (const n of presented) {
    const id = n.request.identifier;
    if (id.startsWith(REMINDER_PREFIX) && id !== keep) {
      await Notifications.dismissNotificationAsync(id).catch(() => {});
    }
  }
}
