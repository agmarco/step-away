import { Link, Redirect, useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  dailyGoalFor,
  hasNewBadge,
  isDayOff,
  localDateOf,
  settle,
  streak,
  todayTally,
  type Reminder,
} from "../core";
import { pause, resume, setDayOff } from "../platform/handler";
import { useNotificationsOn } from "../platform/notificationPermission";
import { useOnboardingDone } from "../platform/onboarding";
import { useCoreState } from "../platform/useCoreState";
import { isDevelopment } from "../platform/variant";
import { CorrectionSheet } from "../screens/today/CorrectionSheet";
import { Hero, type HeroAction } from "../screens/today/Hero";
import { NotificationsBanner } from "../screens/today/NotificationsBanner";
import { PauseSheet } from "../screens/today/PauseSheet";
import { ReminderList } from "../screens/today/ReminderList";
import { Tiles } from "../screens/today/Tiles";
import { WeekPanel } from "../screens/today/WeekPanel";
import { useOneChange } from "../screens/useOneChange";
import { useColors, useScheme } from "../theme";

/**
 * Today, the hub (#25, variant B4 of prototypes/app-navigation): the hero
 * (date, Streak, Daily Goal dots, next Reminder), the History · Achievements ·
 * Settings tiles, the tally and today's Reminders and Pauses (Start on the
 * outstanding Reminder, the correction sheet on the others), the week panel
 * and "Take today off". The hero's action pauses (through the Pause sheet),
 * resumes or undoes the Day Off. The stored state is settled at `now` first,
 * so a Reminder shows Missed as soon as it is, even before the next write
 * persists it. One Pause or Day Off change at a time: the actions are
 * disabled while one is in flight, and a ref drops a second tap in the same
 * tick. While notifications are blocked (re-read whenever the app comes to
 * the front), the hero reads "Reminders are off" and a banner above the list
 * offers Turn on; scheduling carries on underneath. On a fresh install, Today
 * redirects to onboarding (#31) until it is done, showing nothing until the
 * flag is read.
 */
export default function Today() {
  const colors = useColors();
  const scheme = useScheme();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { state: stored, now } = useCoreState();
  const onboardingDone = useOnboardingDone();
  const notifications = useNotificationsOn();
  const [correcting, setCorrecting] = useState<Reminder | null>(null);
  const [pausing, setPausing] = useState(false);
  /** One Pause or Day Off call at a time; the screen redraws from the stored state when it lands. */
  const { busy, run } = useOneChange("today");
  const state = stored && settle(stored, now);

  if (onboardingDone === false) return <Redirect href="/onboarding" />;
  if (!state || onboardingDone === null)
    return (
      <View
        style={[styles.root, { backgroundColor: colors.background.screen }]}
      />
    );

  const tally = todayTally(state, now);
  const today = localDateOf(now, state.settings.timeZone);
  const goal = dailyGoalFor(state, today);
  const dayOff = isDayOff(state, today);
  const onHeroAction = (action: HeroAction) => {
    if (action === "pause") setPausing(true);
    else if (action === "resume") run("Resume", resume);
    else run("Undo Day Off", () => setDayOff(today, false));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background.screen }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* The hero runs under the status bar: its icons take text.onHero's tone while Today is in front. */}
        {focused && <StatusBar style={scheme === "dark" ? "dark" : "light"} />}
        <Hero
          state={state}
          now={now}
          // Not read yet counts as allowed, so the hero doesn't flash "off".
          notifications={notifications}
          streak={streak(state, now)}
          done={tally.done}
          goal={goal}
          topInset={insets.top}
          busy={busy}
          onAction={onHeroAction}
        />
        <Tiles newBadge={hasNewBadge(state)} />
        <View style={styles.body}>
          {notifications === "blocked" && <NotificationsBanner />}
          <ReminderList
            state={state}
            now={now}
            tally={tally}
            onCorrect={setCorrecting}
          />
          <WeekPanel state={state} now={now} />
          {/* While today is off, the hero's Undo is the one way back. */}
          {!dayOff && (
            <Pressable
              onPress={() => run("Take today off", () => setDayOff(today, true))}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              style={busy && styles.disabled}
            >
              <Text style={[styles.dayOff, { color: colors.accent.hero }]}>
                Take today off
              </Text>
            </Pressable>
          )}

          {/* TEMPORARY, development build only (#21): the device-check test mode. */}
          {isDevelopment && (
            <Link
              href="/debug/test-mode"
              style={[styles.debugLink, { color: colors.accent.hero }]}
            >
              Test mode (debug)
            </Link>
          )}
        </View>
      </ScrollView>
      {/* A hero-coloured strip behind the status bar, so its icons stay readable once the list scrolls under it. */}
      <View
        pointerEvents="none"
        style={[
          styles.statusBarStrip,
          { height: insets.top, backgroundColor: colors.accent.hero },
        ]}
      />
      <PauseSheet
        visible={pausing}
        onPick={(length) => run(`Pause ${length}`, () => pause(length))}
        onClose={() => setPausing(false)}
      />
      <CorrectionSheet
        reminder={correcting}
        onClose={() => setCorrecting(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  statusBarStrip: { position: "absolute", top: 0, left: 0, right: 0 },
  body: { padding: 16, gap: 16 },
  dayOff: { textAlign: "center", fontSize: 15, fontWeight: "600", padding: 8 },
  disabled: { opacity: 0.5 },
  debugLink: { fontSize: 14 },
});
