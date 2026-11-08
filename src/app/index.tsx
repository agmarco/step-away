import { Link, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dailyGoalFor, settle, streak, todayTally, type Reminder } from '../core';
import { useCoreState } from '../platform/useCoreState';
import { isDevelopment } from '../platform/variant';
import { CorrectionSheet } from '../screens/today/CorrectionSheet';
import { localDateIn } from '../screens/today/format';
import { Hero } from '../screens/today/Hero';
import { ReminderList } from '../screens/today/ReminderList';
import { Tiles } from '../screens/today/Tiles';
import { WeekPanel } from '../screens/today/WeekPanel';
import { useColors, useScheme } from '../theme';

/**
 * Today, the hub (#25, variant B4 of prototypes/app-navigation): the hero
 * (date, Streak, Daily Goal dots, next Reminder), the History · Achievements ·
 * Settings tiles, the tally and today's Reminders (Start on the outstanding
 * one, the correction sheet on the others), the week panel and "Take today
 * off" (a placeholder until #26). The stored state is settled at `now` first,
 * so a Reminder shows Missed as soon as it is, even before the next write
 * persists it.
 */
export default function Today() {
  const colors = useColors();
  const scheme = useScheme();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { state: stored, now } = useCoreState();
  const [correcting, setCorrecting] = useState<Reminder | null>(null);
  const state = stored && settle(stored, now);

  if (!state) return <View style={[styles.root, { backgroundColor: colors.background.screen }]} />;

  const tally = todayTally(state, now);
  const goal = dailyGoalFor(state, localDateIn(now, state.settings.timeZone));

  return (
    <ScrollView
      style={{ backgroundColor: colors.background.screen }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* The hero runs under the status bar: its icons take text.onHero's tone while Today is in front. */}
      {focused && <StatusBar style={scheme === 'dark' ? 'dark' : 'light'} />}
      <Hero state={state} now={now} streak={streak(state, now)} done={tally.done} goal={goal} topInset={insets.top} />
      <Tiles />
      <View style={styles.body}>
        <ReminderList state={state} now={now} tally={tally} onCorrect={setCorrecting} />
        <WeekPanel state={state} now={now} />
        {/* Placeholder until Pause and Day Off (#26). */}
        <Text
          style={[styles.dayOff, { color: colors.text.secondary }]}
          accessibilityRole="link"
          accessibilityState={{ disabled: true }}
        >
          Take today off (coming soon)
        </Text>

        {/* TEMPORARY (#19): link to the Exercise Library debug list; remove with app/debug/library.tsx. */}
        <Link href="/debug/library" style={[styles.debugLink, { color: colors.accent.hero }]}>
          Exercise Library (debug)
        </Link>
        {/* TEMPORARY, development build only (#21): the device-check test mode. */}
        {isDevelopment && (
          <Link href="/debug/test-mode" style={[styles.debugLink, { color: colors.accent.hero }]}>
            Test mode (debug)
          </Link>
        )}
      </View>
      <CorrectionSheet reminder={correcting} onClose={() => setCorrecting(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, gap: 16 },
  dayOff: { textAlign: 'center', fontSize: 15, fontWeight: '600', padding: 8 },
  debugLink: { fontSize: 14 },
});
