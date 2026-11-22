import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  effectiveFire,
  outstandingReminder,
  refireScheduled,
  todaysPauses,
  todaysReminders,
  type CoreState,
  type DropReason,
  type Pause,
  type Reminder,
  type Tally,
} from '../../core';
import { openGuided } from '../../platform/useReminderRuntime';
import { type Palette, useColors } from '../../theme';
import { timeOf } from './format';
import { dropReason, todayLines } from './pauseDisplay';

/**
 * The tally line, then today's fired Reminders and today's Pauses, newest
 * first (`todayLines`). The outstanding Reminder has Start (the guided
 * screen); every answered one (done, skipped, Missed, dropped) opens the
 * correction sheet through `onCorrect`. A Pause is a line of its own,
 * "Paused 10:00–11:00", or "Paused 10:00–" while it runs.
 */
export function ReminderList({
  state,
  now,
  tally,
  onCorrect,
}: {
  state: CoreState;
  now: number;
  tally: Tally;
  onCorrect: (reminder: Reminder) => void;
}) {
  const colors = useColors();
  const outstandingId = outstandingReminder(state, now)?.id;
  const lines = todayLines(todaysReminders(state, now), todaysPauses(state, now));

  return (
    <View style={styles.section}>
      <Text style={[styles.tally, { color: colors.text.secondary }]}>
        {tally.done} done · {tally.skipped} skipped · {tally.missed} missed · {tally.exercises} Exercises
      </Text>
      {lines.length === 0 ? (
        <Text style={[styles.empty, { color: colors.text.secondary }]}>No Reminders yet today.</Text>
      ) : (
        <View style={[styles.list, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
          {lines.map((line, i) =>
            line.kind === 'pause' ? (
              <PauseRow key={`pause-${line.pause.from}`} pause={line.pause} now={now} divided={i > 0} colors={colors} />
            ) : (
              <Row
                key={line.reminder.id}
                reminder={line.reminder}
                status={statusOf(line.reminder, state, outstandingId, now, colors)}
                outstanding={line.reminder.id === outstandingId}
                onCorrect={line.reminder.status === 'scheduled' ? undefined : () => onCorrect(line.reminder)}
                divided={i > 0}
                colors={colors}
              />
            ),
          )}
        </View>
      )}
    </View>
  );
}

function Row({
  reminder: r,
  status,
  outstanding,
  onCorrect,
  divided,
  colors,
}: {
  reminder: Reminder;
  status: { label: string; color: string };
  outstanding: boolean;
  onCorrect: (() => void) | undefined;
  divided: boolean;
  colors: Palette;
}) {
  const snoozes = r.snoozes ?? 0;
  return (
    <Pressable
      onPress={onCorrect}
      disabled={!onCorrect}
      accessibilityRole={onCorrect ? 'button' : undefined}
      accessibilityHint={onCorrect ? 'Correct this Reminder' : undefined}
      style={[styles.row, divided && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line.divider }]}
    >
      <Text style={[styles.time, { color: colors.text.primary }]}>{timeOf(r.firesAt)}</Text>
      <View style={[styles.dot, { backgroundColor: status.color }]} />
      <View style={styles.body}>
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
      {outstanding ? (
        <Pressable
          onPress={() => openGuided(r.id)}
          accessibilityRole="button"
          style={[styles.start, { backgroundColor: colors.accent.hero }]}
        >
          <Text style={[styles.startText, { color: colors.text.onHero }]}>Start</Text>
        </Pressable>
      ) : (
        onCorrect && <Text style={[styles.edit, { color: colors.text.secondary }]}>✎</Text>
      )}
    </Pressable>
  );
}

/** A Pause's line: its span, open-ended while it runs. Not a Reminder: no dot colour of its own, no action. */
function PauseRow({ pause, now, divided, colors }: { pause: Pause; now: number; divided: boolean; colors: Palette }) {
  const running = pause.from <= now && now < pause.until;
  return (
    <View style={[styles.row, divided && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line.divider }]}>
      <View style={[styles.dot, { backgroundColor: colors.text.secondary }]} />
      <Text style={[styles.pause, { color: colors.text.secondary }]}>
        Paused {timeOf(pause.from)}–{running ? '' : timeOf(pause.until)}
      </Text>
    </View>
  );
}

/** A dropped Reminder's status, by what dropped it. */
const DROPPED_LABEL: Record<DropReason, string> = {
  pause: 'Ended by Pause',
  dayOff: 'Ended: Day Off',
  closing: 'Snoozed past closing',
};

/** One fired Reminder's line, from its settled status. */
function statusOf(r: Reminder, state: CoreState, outstandingId: string | undefined, now: number, colors: Palette) {
  switch (r.status) {
    case 'done':
      return { label: r.done?.length ? `Done: ${r.done.map((e) => e.name).join(', ')}` : 'Done', color: colors.outcome.done };
    case 'skipped':
      return { label: 'Skipped', color: colors.outcome.skip };
    case 'missed':
      return { label: 'Missed', color: colors.outcome.missed };
    // Dropped is not an Activity Log outcome (not Missed), so it takes no outcome colour.
    case 'dropped':
      return { label: DROPPED_LABEL[dropReason(r)], color: colors.text.secondary };
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

const styles = StyleSheet.create({
  section: { gap: 8 },
  tally: { fontSize: 14 },
  empty: { fontSize: 15 },
  list: { borderWidth: 1, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  time: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1, gap: 2 },
  exercise: { fontSize: 15 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontSize: 13, fontWeight: '600' },
  shrink: { flexShrink: 1 },
  start: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  startText: { fontSize: 15, fontWeight: '700' },
  edit: { fontSize: 16 },
  pause: { flex: 1, fontSize: 15, fontWeight: '600' },
  tag: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
});
