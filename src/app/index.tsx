import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  effectiveFire,
  nextReminder,
  outstandingReminder,
  refireScheduled,
  settle,
  todaysReminders,
  type CoreState,
  type Reminder,
} from '../core';
import { useCoreState } from '../platform/useCoreState';
import { openGuided } from '../platform/useReminderRuntime';
import { isDevelopment } from '../platform/variant';
import { type Palette, useColors } from '../theme';

/**
 * Today, minimal (#21, #22, #23): the next Reminder and today's fired
 * Reminders with their status; the outstanding one has Start, which opens the
 * guided screen. The real design lands in #25. The stored state is
 * settled at `now` first, so a Reminder shows Missed as soon as it is, even
 * before the next write persists it.
 */
export default function Today() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state: stored, now } = useCoreState();
  const state = stored && settle(stored, now);
  const date = new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background.screen }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={[styles.title, { color: colors.text.primary }]}>Today</Text>
      <Text style={[styles.date, { color: colors.text.secondary }]}>{date}</Text>

      {state && <NextReminder state={state} now={now} colors={colors} />}
      {state && <TodaysReminders state={state} now={now} colors={colors} />}

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
    </ScrollView>
  );
}

function NextReminder({ state, now, colors }: { state: CoreState; now: number; colors: Palette }) {
  const next = nextReminder(state, now);
  // Display only: the weekday is shown when the next Reminder's calendar date
  // (as formatted in the Settings' time zone) is not today's. A snoozed
  // Reminder coming back is next at its re-fire.
  const { settings } = state;
  let label = 'No Reminders scheduled';
  if (next) {
    const at = effectiveFire(next);
    const day = dateOf(at, settings.timeZone) === dateOf(now, settings.timeZone) ? '' : `${weekdayOf(at)} `;
    label = `Next Reminder ${day}${timeOf(at)}${refireScheduled(next, settings, now) ? ' (snoozed)' : ''}`;
  }
  return (
    <View style={[styles.hero, { backgroundColor: colors.accent.hero }]}>
      <Text style={[styles.heroText, { color: colors.text.onHero }]}>{label}</Text>
    </View>
  );
}

function TodaysReminders({ state, now, colors }: { state: CoreState; now: number; colors: Palette }) {
  const outstandingId = outstandingReminder(state, now)?.id;
  const fired = todaysReminders(state, now);

  if (fired.length === 0) {
    return <Text style={[styles.empty, { color: colors.text.secondary }]}>No Reminders yet today.</Text>;
  }
  return (
    <View style={[styles.list, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
      {fired.map((r, i) => {
        const status = statusOf(r, state, outstandingId, now, colors);
        const snoozes = r.snoozes ?? 0;
        return (
          <View
            key={r.id}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line.divider }]}
          >
            <Text style={[styles.time, { color: colors.text.primary }]}>{timeOf(r.firesAt)}</Text>
            <View style={styles.rowBody}>
              <Text style={[styles.exercise, { color: colors.text.primary }]} numberOfLines={1}>
                {r.suggestion.map((e) => e.name).join(', ')}
              </Text>
              <View style={styles.statusLine}>
                <Text style={[styles.status, styles.shrink, { color: status.color }]} numberOfLines={1}>
                  {status.label}
                </Text>
                {snoozes > 0 && (
                  <Text style={[styles.tag, { color: colors.text.secondary, borderColor: colors.line.divider }]}>
                    snoozed ×{snoozes}
                  </Text>
                )}
              </View>
            </View>
            {r.id === outstandingId && (
              <Pressable
                onPress={() => openGuided(r.id)}
                accessibilityRole="button"
                style={[styles.start, { backgroundColor: colors.accent.hero }]}
              >
                <Text style={[styles.startText, { color: colors.text.onHero }]}>Start</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** One fired Reminder's line, from its settled status. */
function statusOf(r: Reminder, state: CoreState, outstandingId: string | undefined, now: number, colors: Palette) {
  switch (r.status) {
    case 'done':
      // Which Exercises were done, on one line (#25 does the real design).
      return { label: r.done?.length ? `Done: ${r.done.map((e) => e.name).join(', ')}` : 'Done', color: colors.outcome.done };
    case 'skipped':
      return { label: 'Skipped', color: colors.outcome.skip };
    case 'missed':
      return { label: 'Missed', color: colors.outcome.missed };
    // Dropped is not an Activity Log outcome (not Missed), so it takes no outcome colour.
    case 'dropped':
      return { label: 'Snoozed past closing', color: colors.text.secondary };
    case 'scheduled':
      if (refireScheduled(r, state.settings, now)) {
        return { label: `Snoozed, back at ${timeOf(effectiveFire(r))}`, color: colors.text.secondary };
      }
      // Its re-fire lands past closing: never scheduled, dropped once the window ends.
      if (r.refiresAt !== undefined && r.refiresAt > now) {
        return { label: 'Snoozed past closing', color: colors.text.secondary };
      }
      if (r.id === outstandingId) return { label: 'Waiting for you', color: colors.accent.hero };
      // Not reachable once settled; kept so the screen never shows nothing.
      return { label: 'No Response', color: colors.text.secondary };
  }
}

const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const weekdayOf = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: 'short' });
const dateOf = (at: number, timeZone: string) =>
  new Date(at).toLocaleDateString('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 4 },
  title: { fontSize: 32, fontWeight: '800' },
  date: { fontSize: 16 },
  hero: { borderRadius: 16, padding: 20, marginTop: 20 },
  heroText: { fontSize: 22, fontWeight: '700' },
  empty: { fontSize: 15, marginTop: 20 },
  list: { borderWidth: 1, borderRadius: 12, marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12 },
  time: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowBody: { flex: 1, gap: 2 },
  exercise: { fontSize: 15 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontSize: 13, fontWeight: '600' },
  shrink: { flexShrink: 1 },
  start: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  startText: { fontSize: 15, fontWeight: '700' },
  tag: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  debugLink: { fontSize: 14, marginTop: 24 },
});
