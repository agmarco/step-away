import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SettingsChange } from '../core';
import { changeSettings } from '../platform/handler';
import { exactAlarmGrantNeeded, requestNotifications } from '../platform/notificationPermission';
import { finishOnboarding } from '../platform/store';
import { useCoreState } from '../platform/useCoreState';
import { Section } from '../screens/settings/parts';
import { ScheduleRows } from '../screens/settings/ScheduleRows';
import { WhatICanDoRows } from '../screens/settings/WhatICanDoRows';
import { StatusBarBackdrop } from '../screens/StatusBarBackdrop';
import { useColors } from '../theme';

const STEPS = ['Your day', 'What do you have nearby?', 'Permissions'] as const;
const LAST = STEPS.length - 1;

/**
 * Onboarding (#31), on a fresh install only (Today redirects here while the
 * store's onboarding flag is not done): Your day (Active Hours, Interval), What
 * do you have nearby? (Energetic, Floor, Equipment) and Permissions. The first
 * two reuse the Settings rows, pre-filled from the stored state; every change
 * goes through the handler's `changeSettings` at once, as in Settings. The
 * Permissions step asks for notifications (or "Not now") and finishes either
 * way: declining still finishes setup. Finishing marks onboarding done and
 * replaces this screen with Today. Android back goes to the previous step; on
 * the first one it leaves the app (nothing is under this screen). If the
 * stored state can't be read, a short message and "Go to Today" finish
 * onboarding instead (the defaults stay; Settings can change them later).
 */
export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, failed } = useCoreState();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (step === 0) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep(step - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  /** Runs one call at a time, as Settings does; a second tap in the same tick is dropped. */
  const run = (label: string, call: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    call()
      .catch((e: unknown) => console.warn(`[onboarding] ${label} failed: ${e}`))
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  };
  const change = (c: SettingsChange) => run(Object.keys(c).join(', '), () => changeSettings(c));

  /** Both answers on the Permissions step end here, after the exact-alarm grant prompt's slot. */
  const finish = async () => {
    if (exactAlarmGrantNeeded()) {
      // The exact-alarm grant prompt's slot: with SCHEDULE_EXACT_ALARM in the app config, ask the user to
      // allow "Alarms & reminders" here, before finishing. Unused while USE_EXACT_ALARM is granted at install.
    }
    await finishOnboarding();
    router.replace('/');
  };

  const allow = async () => {
    await requestNotifications();
    await finish();
  };

  if (!state && failed) {
    return (
      <View style={[styles.root, styles.fallback, { backgroundColor: colors.background.screen }]}>
        <Text style={[styles.title, { color: colors.text.primary }]} accessibilityRole="header">
          {"Setup can't start"}
        </Text>
        <Text style={[styles.body, { color: colors.text.secondary }]}>
          {"Your settings couldn't be read. You can set things up later in Settings."}
        </Text>
        <Pressable
          onPress={() => run('Go to Today', finish)}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: colors.accent.hero }, busy && styles.disabled]}
        >
          <Text style={[styles.primaryText, { color: colors.text.onHero }]}>Go to Today</Text>
        </Pressable>
      </View>
    );
  }
  if (!state) return <View style={[styles.root, { backgroundColor: colors.background.screen }]} />;
  const s = state.settings;

  return (
    <View style={[styles.root, { backgroundColor: colors.background.screen }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
        <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((name, i) => (
            <View
              key={name}
              style={[styles.dot, { borderColor: colors.accent.hero }, i <= step && { backgroundColor: colors.accent.hero }]}
            />
          ))}
        </View>
        <Text style={[styles.title, { color: colors.text.primary }]} accessibilityRole="header">
          {STEPS[step]}
        </Text>

        {step === 0 && (
          <>
            <Text style={[styles.body, { color: colors.text.secondary }]}>
              When should Reminders come? You can change this any time in Settings.
            </Text>
            <Section title="Schedule">
              <ScheduleRows settings={s} disabled={busy} onChange={change} />
            </Section>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[styles.body, { color: colors.text.secondary }]}>
              Suggestions only use what you have. You can change this any time in Settings.
            </Text>
            <Section title="What I can do">
              <WhatICanDoRows settings={s} disabled={busy} onChange={change} />
            </Section>
          </>
        )}

        {step === LAST && (
          <Text style={[styles.body, { color: colors.text.secondary }]}>
            Reminders arrive as notifications, with Start, Snooze and Skip on them. Allow notifications so they reach
            you. If you say no, the app still works, and you can turn them on later.
          </Text>
        )}
      </ScrollView>
      <StatusBarBackdrop />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {step === LAST ? (
          <>
            <Pressable
              onPress={() => run('Not now', finish)}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.secondary, busy && styles.disabled]}
            >
              <Text style={[styles.secondaryText, { color: colors.accent.hero }]}>Not now</Text>
            </Pressable>
            <Pressable
              onPress={() => run('Allow notifications', allow)}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.primary, { backgroundColor: colors.accent.hero }, busy && styles.disabled]}
            >
              <Text style={[styles.primaryText, { color: colors.text.onHero }]}>Allow notifications</Text>
            </Pressable>
          </>
        ) : (
          <>
            {step > 0 ? (
              <Pressable onPress={() => setStep(step - 1)} accessibilityRole="button" style={styles.secondary}>
                <Text style={[styles.secondaryText, { color: colors.accent.hero }]}>Back</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable
              onPress={() => setStep(step + 1)}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.primary, { backgroundColor: colors.accent.hero }, busy && styles.disabled]}
            >
              <Text style={[styles.primaryText, { color: colors.text.onHero }]}>Next</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fallback: { justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 16, gap: 16 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  title: { fontSize: 26, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 21 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  primary: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  primaryText: { fontSize: 16, fontWeight: '700' },
  secondary: { paddingHorizontal: 12, paddingVertical: 12 },
  secondaryText: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
