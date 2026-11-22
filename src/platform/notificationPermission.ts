/**
 * The notification permission, for Today, Settings and onboarding: whether
 * notifications are allowed, read with `getPermissionsAsync()` on mount and
 * again whenever the app comes to the front (the owner may have just changed
 * it in the system settings); the request (onboarding's Permissions step
 * only); and Turn on. Also the exact-alarm grant's slot.
 */
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { EXACT_ALARM_PERMISSION } from '../app.config';

/** True when notifications are allowed, false when not, null until the first read. */
export function useNotificationsOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => {
      Notifications.getPermissionsAsync()
        .then((p) => alive && setOn(p.granted))
        .catch((e) => console.warn(`[notifications] permission read failed: ${e}`));
    };
    check();
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => {
      alive = false;
      appState.remove();
    };
  }, []);
  return on;
}

/** Turn on: opens the app's page in the system settings. */
export function openSystemSettings() {
  Linking.openSettings().catch((e) => console.warn(`[notifications] open settings failed: ${e}`));
}

/**
 * Asks for notifications (Android 13+ shows the system prompt; once declined,
 * Android stops asking). Called only by onboarding's Permissions step, which
 * finishes whatever the answer. Never throws.
 */
export async function requestNotifications(): Promise<void> {
  try {
    await Notifications.requestPermissionsAsync();
  } catch (e) {
    console.warn(`[notifications] permission request failed: ${e}`);
  }
}

/**
 * Whether onboarding must prompt for the exact-alarm grant ("Alarms &
 * reminders" in the system settings). False while EXACT_ALARM_PERMISSION is
 * USE_EXACT_ALARM, which is granted at install; a SCHEDULE_EXACT_ALARM build
 * (app.config.ts) would need the prompt, behind the Permissions step.
 */
export function exactAlarmGrantNeeded(): boolean {
  return EXACT_ALARM_PERMISSION !== 'USE_EXACT_ALARM';
}
