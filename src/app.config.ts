import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * THE exact-alarm switch: the one place that picks the Android permission
 * behind the Reminders' exact, Doze-safe alarms (expo-notifications DATE
 * triggers use setExactAndAllowWhileIdle when exact alarms are allowed).
 *
 * USE_EXACT_ALARM is granted at install, which suits a sideloaded personal
 * app. Google Play restricts it to alarm/calendar apps, so for a store release
 * swap it for 'SCHEDULE_EXACT_ALARM' and add a grant prompt (the user enables
 * "Alarms & reminders" in system settings; check canScheduleExactAlarms()).
 */
export const EXACT_ALARM_PERMISSION: 'USE_EXACT_ALARM' | 'SCHEDULE_EXACT_ALARM' = 'USE_EXACT_ALARM';

const BASE_ADAPTIVE_ICON = {
  foregroundImage: './assets/android-icon-foreground.png',
  monochromeImage: './assets/android-icon-monochrome.png',
};

/**
 * Two apps side by side on the phone, chosen by APP_VARIANT (set per EAS
 * build profile in eas.json). Unset means preview.
 */
const VARIANTS = {
  preview: {
    name: 'Activity Reminder',
    package: 'com.agmarco.activityreminder',
    scheme: 'activityreminder',
    adaptiveIcon: {
      ...BASE_ADAPTIVE_ICON,
      backgroundColor: '#E6F4FE',
      backgroundImage: './assets/android-icon-background.png',
    },
  },
  development: {
    name: 'Activity Reminder (dev)',
    package: 'com.agmarco.activityreminder.dev',
    scheme: 'activityreminder-dev',
    // A plain amber background instead of the light-blue grid, so the dev app
    // is easy to tell apart from the daily app on the launcher.
    adaptiveIcon: { ...BASE_ADAPTIVE_ICON, backgroundColor: '#F59E0B' },
  },
} as const;

type Variant = keyof typeof VARIANTS;

function variant(): Variant {
  const value = process.env.APP_VARIANT ?? 'preview';
  if (value in VARIANTS) return value as Variant;
  throw new Error(`Unknown APP_VARIANT "${value}". Use one of: ${Object.keys(VARIANTS).join(', ')}.`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appVariant = variant();
  const v = VARIANTS[appVariant];
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
      adaptiveIcon: v.adaptiveIcon,
      permissions: [EXACT_ALARM_PERMISSION],
      predictiveBackGestureEnabled: false,
    },
    web: { favicon: './assets/favicon.png' },
    plugins: ['expo-router', 'expo-status-bar', 'expo-sqlite', 'expo-notifications', 'expo-task-manager'],
    owner: 'agmarco',
    extra: {
      ...config.extra,
      // Read at runtime with expo-constants; gates the dev-only test mode.
      appVariant,
      eas: { projectId: 'ad2beed2-abdc-4c1c-ad2b-f761b129a4da' },
    },
  };
};
