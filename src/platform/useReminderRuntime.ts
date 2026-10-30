/**
 * The app's side of the Reminder runtime, mounted once by the root layout:
 * notification setup, a Rearm on launch and every time the app comes to the
 * front, and the foreground response listener.
 */
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { handleAction, rearmOnOpen, reminderIdOf } from './handler';
import { setup } from './notifications';

function rearm() {
  rearmOnOpen().catch((e) => console.warn(`[runtime] rearm failed: ${e}`));
}

export function useReminderRuntime() {
  useEffect(() => {
    setup()
      .catch((e) => console.warn(`[runtime] notification setup failed: ${e}`))
      .then(rearm);

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') rearm();
    });
    const responses = Notifications.addNotificationResponseReceivedListener((response) => {
      const reminderId = reminderIdOf(response.notification.request.content);
      handleAction(response.actionIdentifier, { reminderId }, 'fg-listener').catch((e) =>
        console.warn(`[runtime] ${response.actionIdentifier} on ${reminderId} failed: ${e}`),
      );
    });
    return () => {
      appState.remove();
      responses.remove();
    };
  }, []);
}
