/**
 * Applies the stored Appearance setting to the app, mounted once by the root
 * layout: on launch, as soon as the stored state is read, and again whenever
 * a write in this JS context changes it. System is `'auto'` (follow the
 * device), never the deprecated `'unspecified'`.
 *
 * On Android `Appearance.setColorScheme` sets AppCompat's night mode; the
 * activity's configuration change then emits `appearanceChanged`, which
 * `useColorScheme()` (and so the theme's `useScheme()`) re-renders on.
 */
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import type { AppearanceSetting } from '../core';
import { onStateChanged, readState } from './store';

const SCHEME: Record<AppearanceSetting, 'auto' | 'light' | 'dark'> = { System: 'auto', Light: 'light', Dark: 'dark' };

export function useAppearance() {
  useEffect(() => {
    let alive = true;
    let applied: AppearanceSetting | undefined;
    const apply = () => {
      readState()
        .then(({ settings }) => {
          if (!alive || settings.appearance === applied) return;
          applied = settings.appearance;
          Appearance.setColorScheme(SCHEME[settings.appearance]);
        })
        .catch((e) => console.warn(`[appearance] read failed: ${e}`));
    };
    apply();
    const unsubscribe = onStateChanged(apply);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
}
