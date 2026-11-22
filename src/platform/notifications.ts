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
 * in the shade), so the core's Reminder Ids address notifications directly. A
 * Snooze re-fire keeps the Id: its earlier notification was dismissed by the
 * Snooze, so the re-fire replaces nothing stale. Titles come from the intent.
 */
import * as Notifications from 'expo-notifications';
import {
  isReminderId,
  outstandingReminder,
  type CoreState,
  type Instant,
  type Intent,
  type NotificationAction,
  type ScheduledNotification,
} from '../core';

export const CHANNEL = 'reminders';
/** Start, Snooze and Skip. */
export const CATEGORY = 'reminder';
/** Start and Skip only: a Reminder's re-fire after its last allowed Snooze. */
export const CATEGORY_NO_SNOOZE = 'reminder-no-snooze';
/** Android group key: stale Reminders left in the shade bundle into one group. */
const GROUP = 'reminders';

/**
 * The most notifications scheduled at once. The default chain is about 60
 * over 7 days; Android caps an app at 500 pending alarms. The dev test mode
 * (2-minute Interval, all day) yields ~5000, so only the first ones are armed;
 * the rest are armed by the next Rearm, which happens whenever JS runs.
 */
const MAX_SCHEDULED = 100;

/** The action identifiers, as the core names them: typed from NotificationAction, so the two can't drift. */
export const ACTION = { start: 'start', snooze: 'snooze', skip: 'skip' } as const satisfies {
  [A in NotificationAction]: A;
};

/**
 * UI context only: the channel, the two categories, and how to show a Reminder
 * while the app is in front. It doesn't ask for the permission: onboarding's
 * Permissions step does (notificationPermission.ts `requestNotifications`).
 */
export async function setup() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    // eslint-plugin-import can't follow this enum through the package's export *; TypeScript can.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.HIGH,
  });
  const start = { identifier: ACTION.start, buttonTitle: 'Start', options: { opensAppToForeground: true } };
  const snooze = { identifier: ACTION.snooze, buttonTitle: 'Snooze', options: { opensAppToForeground: false } };
  const skip = { identifier: ACTION.skip, buttonTitle: 'Skip', options: { opensAppToForeground: false } };
  await Notifications.setNotificationCategoryAsync(CATEGORY, [start, snooze, skip]);
  await Notifications.setNotificationCategoryAsync(CATEGORY_NO_SNOOZE, [start, skip]);
}

/**
 * The category carrying the entry's actions: the core offers Start/Skip only
 * once a Reminder has used its Snoozes; anything else gets the full set.
 */
function categoryOf(n: ScheduledNotification): string {
  return n.actions.includes(ACTION.snooze) ? CATEGORY : CATEGORY_NO_SNOOZE;
}

/**
 * Replaces the OS chain with `reminders`. Called inside the `write()`
 * transaction (handler.ts), so it must stay well under busy_timeout (15 s, db.ts):
 * at most MAX_SCHEDULED calls, made one after another (a few ms each on the
 * Pixel), not in parallel, so their order is plain and the bridge isn't flooded.
 * A failing cancel throws and rolls the transaction back; one Reminder that
 * can't be scheduled is only logged, so it can't cost the user a Skip.
 */
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
          categoryIdentifier: categoryOf(n),
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

/**
 * Carries out the `ScheduleChain` intents. Call it inside the same `write()`
 * that saved the state the chain came from: commit and schedule must be one
 * critical section, or two writers can commit in one order and arm their
 * chains in the other, leaving a stale chain in the OS.
 */
export async function scheduleChains(intents: Intent[]) {
  for (const intent of intents) {
    if (intent.type === 'ScheduleChain') await scheduleChain(intent.reminders);
  }
}

/**
 * Whether a notification response opens the guided screen: the Start action
 * (which brings the app to the front; Android asks to unlock a locked phone
 * first) or a tap on the notification body.
 */
export function opensGuided(actionId: string): boolean {
  return actionId === ACTION.start || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER;
}

/** Removes one Reminder's notification from the shade, if it is there. */
export async function dismissReminder(reminderId: string) {
  await Notifications.dismissNotificationAsync(reminderId).catch(() => {});
}

/** Carries out the `DismissNotification` intents. Idempotent, so it may run after the commit. */
export async function dismissNotifications(intents: Intent[]) {
  for (const intent of intents) {
    if (intent.type === 'DismissNotification') {
      await Notifications.dismissNotificationAsync(intent.reminderId).catch(() => {});
    }
  }
}

/** Removes every Reminder notification in the shade except the outstanding one. */
export async function dismissStale(state: CoreState, now: Instant) {
  const keep = outstandingReminder(state, now)?.id;
  const presented = await Notifications.getPresentedNotificationsAsync();
  for (const n of presented) {
    const id = n.request.identifier;
    if (isReminderId(id) && id !== keep) {
      await Notifications.dismissNotificationAsync(id).catch(() => {});
    }
  }
}
