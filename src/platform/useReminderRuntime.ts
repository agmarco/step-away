/**
 * The app's side of the Reminder runtime, mounted once by the root layout:
 * notification setup, a Rearm on launch and every time the app comes to the
 * front, the foreground response listener, and opening the guided screen for
 * Start or a tap on the notification body, also when that tap launched the app.
 */
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { handleAction, rearmOnOpen, reminderIdOf } from './handler';
import { opensGuided, setup } from './notifications';

function rearm() {
  rearmOnOpen().catch((e) => console.warn(`[runtime] rearm failed: ${e}`));
}

/**
 * Responses already routed in this JS context, by notification and action. A
 * cold-start tap can reach both the listener and getLastNotificationResponse;
 * each opens the guided screen once.
 */
const routed = new Set<string>();

/** Start or a body tap: opens the guided screen for its Reminder. Anything else is left to handleAction. */
function route(response: Notifications.NotificationResponse) {
  if (!opensGuided(response.actionIdentifier)) return;
  const reminderId = reminderIdOf(response.notification.request.content);
  if (!reminderId) return;
  const key = `${response.notification.request.identifier}|${response.notification.date}|${response.actionIdentifier}`;
  if (routed.has(key)) return;
  routed.add(key);
  // So a later launch from the app icon in a new JS context doesn't reopen it.
  try {
    Notifications.clearLastNotificationResponse();
  } catch (e) {
    console.warn(`[runtime] clear last response failed: ${e}`);
  }
  router.push({ pathname: '/guided/[reminderId]', params: { reminderId } });
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
      route(response);
      handleAction(response.actionIdentifier, { reminderId }, 'fg-listener').catch((e) =>
        console.warn(`[runtime] ${response.actionIdentifier} on ${reminderId} failed: ${e}`),
      );
    });
    // Cold start: the tap that launched the app came before the listener existed.
    try {
      const last = Notifications.getLastNotificationResponse();
      if (last) route(last);
    } catch (e) {
      console.warn(`[runtime] last notification response failed: ${e}`);
    }
    return () => {
      appState.remove();
      responses.remove();
    };
  }, []);
}
