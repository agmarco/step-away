/**
 * TEMPORARY, development build only (#21): a test mode for the owner's device
 * check. On, it stores Interval 2 min, Snooze delay 1 min and Active Hours
 * 00:00-24:00 every day, and Rearms, so a Reminder arrives within 2 minutes
 * (and a snoozed one is back within 1) through the real core path. Off
 * restores the default settings. With the window all day, Missed at closing
 * and dropped can't happen here; Missed on replacement can. Remove it once
 * Settings (#2x) can set the schedule.
 *
 * It writes settings straight into the stored state, because the core has no
 * settings event yet; the Rearm that follows goes through the core as usual.
 */
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { defaultSettings, type ActiveWindow, type CoreState, type Settings } from '../../core';
import { rearmOnOpen } from '../../platform/handler';
import { useCoreState } from '../../platform/useCoreState';
import { isDevelopment } from '../../platform/variant';
import { useColors } from '../../theme';

const ALL_DAY: ActiveWindow = { start: 0, end: 24 * 60 };
const TEST_SETTINGS: Omit<Settings, 'timeZone'> = {
  activeHours: { mon: ALL_DAY, tue: ALL_DAY, wed: ALL_DAY, thu: ALL_DAY, fri: ALL_DAY, sat: ALL_DAY, sun: ALL_DAY },
  intervalMinutes: 2,
  snoozeMinutes: 1,
};

const isTestMode = (s: Settings) =>
  s.intervalMinutes === TEST_SETTINGS.intervalMinutes &&
  s.snoozeMinutes === TEST_SETTINGS.snoozeMinutes &&
  JSON.stringify(s.activeHours) === JSON.stringify(TEST_SETTINGS.activeHours);

/** Keeps the stored time zone; Rearm replaces it with the device's anyway. */
const withSettings = (settings: Omit<Settings, 'timeZone'>) => (state: CoreState): CoreState => ({
  ...state,
  settings: { ...settings, timeZone: state.settings.timeZone },
});

export default function TestMode() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useCoreState();
  const [busy, setBusy] = useState(false);
  const on = state ? isTestMode(state.settings) : false;

  const toggle = (value: boolean) => {
    setBusy(true);
    rearmOnOpen(withSettings(value ? TEST_SETTINGS : defaultSettings))
      .catch((e) => console.warn(`[test-mode] ${e}`))
      .finally(() => setBusy(false));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background.screen, paddingTop: insets.top + 24 }]}>
      <Link href="/" style={[styles.small, { color: colors.accent.hero }]}>
        ‹ Today
      </Link>
      <Text style={[styles.title, { color: colors.text.primary }]}>Test mode (debug)</Text>
      {isDevelopment ? (
        <>
          <View style={[styles.row, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
            <Text style={[styles.label, { color: colors.text.primary }]}>Reminder every 2 min, all day, 1-min Snooze</Text>
            <Switch
              value={on}
              disabled={busy || !state}
              onValueChange={toggle}
              trackColor={{ true: colors.accent.hero, false: colors.line.divider }}
            />
          </View>
          <Text style={[styles.body, { color: colors.text.secondary }]}>
            On: Interval 2 min, Snooze delay 1 min, Active Hours 00:00–24:00 every day, then a Rearm. Off: the
            default settings (Mon–Fri 09:00–18:00, 45 min, 10-min Snooze). Development build only.
          </Text>
        </>
      ) : (
        <Text style={[styles.body, { color: colors.text.secondary }]}>Only available in the development build.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  small: { fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  label: { fontSize: 16, flex: 1 },
  body: { fontSize: 14, lineHeight: 20 },
});
