/**
 * The background notification task. Defined at module scope and imported from
 * the app entry (index.ts) before Expo Router registers the app, so it also
 * exists when Android starts a headless JS context for an action tap while
 * the app is killed.
 */
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { handleAction, reminderIdOf } from './handler';
import { clockTime, describeNotification, trace } from './trace';

// #39: this module loads first in every JS context (the app's and a headless
// task's), so this line marks a JS start, to line up with ActivityManager's
// process start, freeze and unfreeze lines.
trace.line(`js start at ${clockTime(Date.now())} (${new Date().toISOString()})`);

export const NOTIFICATION_TASK = 'ACTIVITY_REMINDER_NOTIFICATION_TASK';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn(`[task] ${error.message}`);
    return;
  }
  // Only action taps carry an actionIdentifier; anything else isn't ours to handle.
  if (!data || !('actionIdentifier' in data)) return;
  const response = data as Notifications.NotificationResponse;
  // Reads content.dataString first (what the task receives on the Pixel), then content.data.
  const reminderId = reminderIdOf(response.notification?.request?.content);
  trace.line(
    describeNotification({
      what: 'bg-task response',
      actionId: response.actionIdentifier,
      identifier: response.notification?.request?.identifier,
      reminderId,
      date: response.notification?.date,
      now: Date.now(),
    }),
  );
  try {
    await handleAction(response.actionIdentifier, { reminderId }, 'bg-task');
  } catch (e) {
    console.warn(`[task] ${response.actionIdentifier} on ${reminderId} failed: ${e}`);
  }
});

Notifications.registerTaskAsync(NOTIFICATION_TASK).catch((e) => console.warn(`[task] register failed: ${e}`));
