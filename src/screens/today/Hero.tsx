import { Pressable, StyleSheet, Text, View } from 'react-native';
import { canPause, endsAtMidnight, heroStatus, type CoreState, type HeroStatus } from '../../core';
import { useColors } from '../../theme';
import { dateOf, longDateOf, timeOf, weekdayOf } from './format';

/** What the status line's action does: Pause (opens the sheet), Resume, or Undo the Day Off. */
export type HeroAction = 'pause' | 'resume' | 'undoDayOff';

/**
 * Today's hero (B4): the date, the Streak, the Daily Goal dots ("N of G
 * today") and the status line from `heroStatus` with its action: the next
 * Reminder with Pause (only when `canPause`), a running Pause with Resume, a
 * Day Off with Undo, or nothing scheduled (with Pause when `canPause`: a
 * Reminder is outstanding). The action is disabled while `busy`.
 */
export function Hero({
  state,
  now,
  streak,
  done,
  goal,
  topInset,
  busy,
  onAction,
}: {
  state: CoreState;
  now: number;
  streak: number;
  done: number;
  goal: number;
  topInset: number;
  busy: boolean;
  onAction: (action: HeroAction) => void;
}) {
  const colors = useColors();
  const onHero = { color: colors.text.onHero };
  const { line, action } = statusView(heroStatus(state, now), state, now);
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
        <Text style={[styles.statusText, onHero]}>{line}</Text>
        {action && (
          <Pressable
            onPress={() => onAction(action.action)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            style={[styles.action, { borderColor: colors.text.onHero }, busy && styles.disabled]}
          >
            <Text style={[styles.actionText, onHero]}>{action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The hero's status line and its action, if any. */
type StatusView = { line: string; action?: { action: HeroAction; label: string } };

const PAUSE: StatusView['action'] = { action: 'pause', label: 'Pause' };

/**
 * What the hero shows for a `HeroStatus`: the status line and its action,
 * decided together in one case per kind. The next Reminder (a snoozed one at
 * its re-fire) shows its weekday when its calendar date (in the Settings' time
 * zone) is not today's; Pause, under `next` or `none`, only when the core's
 * `canPause` says a Pause would do something; a Pause ending at local midnight
 * is for the rest of today.
 */
function statusView(status: HeroStatus, state: CoreState, now: number): StatusView {
  const { timeZone } = state.settings;
  switch (status.kind) {
    case 'dayOff':
      return { line: 'Day Off today', action: { action: 'undoDayOff', label: 'Undo' } };
    case 'paused':
      return {
        line: endsAtMidnight(status.until, timeZone) ? 'Paused for the rest of today' : `Paused until ${timeOf(status.until)}`,
        action: { action: 'resume', label: 'Resume' },
      };
    case 'next': {
      const { at, snoozed } = status;
      const day = dateOf(at, timeZone) === dateOf(now, timeZone) ? '' : `${weekdayOf(at)} `;
      return {
        line: `Next Reminder ${day}${timeOf(at)}${snoozed ? ' (snoozed)' : ''}`,
        action: canPause(state, now, status) ? PAUSE : undefined,
      };
    }
    case 'none':
      return { line: 'No Reminders scheduled', action: canPause(state, now, status) ? PAUSE : undefined };
  }
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
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 12, borderRadius: 12 },
  statusText: { flex: 1, fontSize: 15, fontWeight: '600' },
  action: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  actionText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
