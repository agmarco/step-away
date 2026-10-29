import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { outstandingReminder, type CoreState, type Reminder } from '../core';
import { useCoreState } from '../platform/useCoreState';
import { isDevelopment } from '../platform/variant';
import { type Palette, useColors } from '../theme';

/** Today, minimal (#21): the next Reminder and today's fired Reminders. The real design lands in #25. */
export default function Today() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, now } = useCoreState();
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
  const next = state.reminders.find((r) => r.firesAt > now && r.status === 'scheduled');
  const label = next
    ? `Next Reminder ${isSameDay(next.firesAt, now) ? '' : `${weekdayOf(next.firesAt)} `}${timeOf(next.firesAt)}`
    : 'No Reminders scheduled';
  return (
    <View style={[styles.hero, { backgroundColor: colors.accent.hero }]}>
      <Text style={[styles.heroText, { color: colors.text.onHero }]}>{label}</Text>
    </View>
  );
}

function TodaysReminders({ state, now, colors }: { state: CoreState; now: number; colors: Palette }) {
  const outstandingId = outstandingReminder(state, now)?.id;
  const fired = state.reminders.filter((r) => r.firesAt <= now && isSameDay(r.firesAt, now)).reverse();

  if (fired.length === 0) {
    return <Text style={[styles.empty, { color: colors.text.secondary }]}>No Reminders yet today.</Text>;
  }
  return (
    <View style={[styles.list, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
      {fired.map((r, i) => {
        const status = statusOf(r, outstandingId, colors);
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
              <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function statusOf(r: Reminder, outstandingId: string | undefined, colors: Palette) {
  if (r.status === 'skipped') return { label: 'Skipped', color: colors.outcome.skip };
  if (r.id === outstandingId) return { label: 'Waiting for you', color: colors.accent.hero };
  // Fired, superseded by a later Reminder, no Response. It becomes Missed in #22.
  return { label: 'No Response', color: colors.text.secondary };
}

const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const weekdayOf = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: 'short' });
const isSameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

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
  status: { fontSize: 13, fontWeight: '600' },
  debugLink: { fontSize: 14, marginTop: 24 },
});
