/**
 * Whether notifications are allowed, for the Settings page: read with
 * `getPermissionsAsync()` on mount and again whenever the app comes to the
 * front (the owner may have just changed it in the system settings).
 */
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

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
