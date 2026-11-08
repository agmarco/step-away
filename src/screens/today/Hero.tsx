import { StyleSheet, Text, View } from 'react-native';
import { effectiveFire, nextReminder, refireScheduled, type CoreState } from '../../core';
import { useColors } from '../../theme';
import { dateOf, longDateOf, timeOf, weekdayOf } from './format';

/**
 * Today's hero (B4): the date, the Streak, the Daily Goal dots ("N of G
 * today") and the status line with the next Reminder. Pause and Day Off join
 * the status line in #26.
 */
export function Hero({
  state,
  now,
  streak,
  done,
  goal,
  topInset,
}: {
  state: CoreState;
  now: number;
  streak: number;
  done: number;
  goal: number;
  topInset: number;
}) {
  const colors = useColors();
  const onHero = { color: colors.text.onHero };
  return (
    <View style={[styles.hero, { backgroundColor: colors.accent.hero, paddingTop: topInset + 16 }]}>
      <Text style={[styles.date, onHero]}>{longDateOf(now)}</Text>
      <Text style={[styles.streak, onHero]} accessibilityLabel={`${streak}-day Streak`}>
        🔥 {streak}
      </Text>
      <Text style={[styles.streakLabel, onHero]}>day Streak</Text>

      <View style={styles.goalRow} accessibilityLabel={`${done} of ${goal} Done today`}>
        {Array.from({ length: goal }, (_, i) => (
          <View
            key={i}
            style={[styles.goalDot, { borderColor: colors.text.onHero }, i < done && { backgroundColor: colors.text.onHero }]}
          />
        ))}
        <Text style={[styles.goalText, onHero]}>
          {done} of {goal} today
        </Text>
      </View>

      <View style={[styles.status, { backgroundColor: colors.accent.heroPanel }]}>
        <Text style={[styles.statusText, onHero]}>{statusLine(state, now)}</Text>
      </View>
    </View>
  );
}

/**
 * The next Reminder, a snoozed one coming back at its re-fire. The weekday is
 * shown when its calendar date (in the Settings' time zone) is not today's.
 */
function statusLine(state: CoreState, now: number): string {
  const next = nextReminder(state, now);
  if (!next) return 'No Reminders scheduled';
  const { settings } = state;
  const at = effectiveFire(next);
  const day = dateOf(at, settings.timeZone) === dateOf(now, settings.timeZone) ? '' : `${weekdayOf(at)} `;
  return `Next Reminder ${day}${timeOf(at)}${refireScheduled(next, settings, now) ? ' (snoozed)' : ''}`;
}

const styles = StyleSheet.create({
  // The bottom padding leaves room for the tiles, which overlap the hero.
  hero: { paddingHorizontal: 20, paddingBottom: 36 },
  date: { fontSize: 15 },
  streak: { fontSize: 56, fontWeight: '900', marginTop: 8 },
  streakLabel: { fontSize: 15 },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 },
  goalDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  goalText: { fontSize: 15, fontWeight: '700', marginLeft: 4 },
  status: { marginTop: 18, padding: 12, borderRadius: 12 },
  statusText: { fontSize: 15, fontWeight: '600' },
});
