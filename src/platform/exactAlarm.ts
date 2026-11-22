/**
 * The exact-alarm grant decision, pure (no expo module), so it is testable.
 * `permissions` is the app config's `android.permissions` as the app reads it
 * at runtime (`Constants.expoConfig`): the strings exactly as app.config.ts
 * lists them, bare ('USE_EXACT_ALARM') or prefixed
 * ('android.permission.USE_EXACT_ALARM'); prebuild adds the prefix only in the
 * manifest.
 */

const has = (permissions: readonly string[], name: string) =>
  permissions.some((p) => p === name || p === `android.permission.${name}`);

/**
 * Whether onboarding must prompt for the exact-alarm grant ("Alarms &
 * reminders"): with SCHEDULE_EXACT_ALARM and without USE_EXACT_ALARM (granted
 * at install). No list means no prompt.
 */
export function exactAlarmGrantNeededFor(permissions: readonly string[] | undefined): boolean {
  if (!permissions) return false;
  return has(permissions, 'SCHEDULE_EXACT_ALARM') && !has(permissions, 'USE_EXACT_ALARM');
}
