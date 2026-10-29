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
  // The payload shape for local notifications isn't documented, so read both likely spots.
  const content = res.notification?.request?.content as { data?: unknown } | undefined;
  const result = await handleAction(res.actionIdentifier, content?.data ?? (data as { data?: unknown }).data, res.notification?.request?.identifier, 'bg-task')
    .catch((e) => `threw: ${e}`);
  await logTaskCall(data, result);
});

Notifications.registerTaskAsync(TASK).catch(() => {});
