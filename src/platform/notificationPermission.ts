/**
 * The notification permission, for Today, Settings and onboarding: whether
 * notifications are allowed, read with `getPermissionsAsync()` on mount and
 * again whenever the app comes to the front (the owner may have just changed
 * it in the system settings); the request (onboarding's Permissions step
 * only); and Turn on. Also the exact-alarm grant's slot.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import type { NotificationsState } from '../core';
import { exactAlarmGrantNeededFor } from './exactAlarm';

/**
 * The core's `NotificationsState`: 'blocked' only once a read says not
 * granted; 'allowed' before the first read and after a failed one, so
 * nothing flashes "off".
 */
export function useNotificationsOn(): NotificationsState {
  const [on, setOn] = useState<NotificationsState>('allowed');
  useEffect(() => {
    let alive = true;
    const check = () => {
      Notifications.getPermissionsAsync()
        .then((p) => alive && setOn(p.granted ? 'allowed' : 'blocked'))
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
 * reminders" in the system settings), from the app config's
 * `android.permissions` read at runtime (`Constants.expoConfig`, not
 * app.config.ts itself): true with SCHEDULE_EXACT_ALARM and no
 * USE_EXACT_ALARM (`exactAlarmGrantNeededFor`). False today: the config lists
 * USE_EXACT_ALARM, granted at install.
 */
export function exactAlarmGrantNeeded(): boolean {
  return exactAlarmGrantNeededFor(Constants.expoConfig?.android?.permissions);
}
