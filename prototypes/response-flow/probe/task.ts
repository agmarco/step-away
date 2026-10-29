// PROTOTYPE — throwaway (#12). Defined at module scope from index.ts, as the docs require,
// so it also runs when Android starts a headless JS context for an action tap.
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { logTaskCall } from './db';
import { handleAction } from './notify';

export const TASK = 'PROBE_NOTIFICATION_TASK';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) {
    await logTaskCall({ data, error: error && String(error) }, 'not a response');
    return;
  }
  const res = data as unknown as Notifications.NotificationResponse;
  // On the Pixel the task gets the notification's data as a JSON string, `content.dataString`.
  const content = res.notification?.request?.content as { data?: unknown; dataString?: string } | undefined;
  const payload = content?.data ?? (content?.dataString ? JSON.parse(content.dataString) : undefined);
  const result = await handleAction(res.actionIdentifier, payload, res.notification?.request?.identifier, 'bg-task')
    .catch((e) => `threw: ${e}`);
  await logTaskCall(data, result);
});

Notifications.registerTaskAsync(TASK).catch(() => {});
