import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Two apps side by side on the phone, chosen by APP_VARIANT (set per EAS
 * build profile in eas.json). Unset means preview.
 */
const VARIANTS = {
  preview: {
    name: 'Activity Reminder',
    package: 'com.agmarco.activityreminder',
    scheme: 'activityreminder',
  },
  development: {
    name: 'Activity Reminder (dev)',
    package: 'com.agmarco.activityreminder.dev',
    scheme: 'activityreminder-dev',
  },
} as const;

type Variant = keyof typeof VARIANTS;

function variant(): Variant {
  const value = process.env.APP_VARIANT ?? 'preview';
  if (value in VARIANTS) return value as Variant;
  throw new Error(`Unknown APP_VARIANT "${value}". Use one of: ${Object.keys(VARIANTS).join(', ')}.`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const v = VARIANTS[variant()];
  return {
    ...config,
    name: v.name,
    slug: 'activity-reminder',
    scheme: v.scheme,
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    runtimeVersion: { policy: 'fingerprint' },
    android: {
      package: v.package,
      allowBackup: true,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: { favicon: './assets/favicon.png' },
    plugins: ['expo-router', 'expo-status-bar'],
    owner: 'agmarco',
    extra: { ...config.extra, eas: { projectId: 'ad2beed2-abdc-4c1c-ad2b-f761b129a4da' } },
  };
};
