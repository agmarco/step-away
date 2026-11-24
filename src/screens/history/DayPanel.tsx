import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  dayTally,
  isDayOff,
  outstandingReminder,
  pausesOn,
  remindersOn,
  type CoreState,
  type LocalDate,
  type Reminder,
} from '../../core';
import { exercises, photoSource } from '../../library';
import { type Palette, useColors } from '../../theme';
import { timeOf } from '../today/format';
import { todayLines } from '../today/pauseDisplay';
import { PauseRow } from '../today/ReminderList';
import { statusOf } from '../today/reminderStatus';
import { exercisesShown, type ShownExercise } from './entries';
import { longDayOf } from './format';

/** Where the selected day sits: before today, today, or still ahead. */
export type DayKind = 'past' | 'today' | 'future';

/**
 * The selected day under History's calendar: its long date, then
 *  - a past day or today: the day's tally (`dayTally`) and its Reminders and
 *    Pauses, newest first (`todayLines` of `remindersOn` and `pausesOn`), read
 *    only. A Reminder row has its time, its outcome dot and label (Today's
 *    `statusOf`), "snoozed ×N", and its Exercises with thumbnails
 *    (`exercisesShown`: the Done list of a done Reminder, else the
 *    Suggestion). A day with nothing recorded says so;
 *  - a day still ahead: whether it is a Day Off.
 * Today and a day ahead also have Mark as Day Off / Undo Day Off, through
 * `onDayOff` (the page confirms it in a sheet).
 */
export function DayPanel({
  state,
  now,
  date,
  kind,
  busy,
  onDayOff,
}: {
  state: CoreState;
  now: number;
  date: LocalDate;
  kind: DayKind;
  busy: boolean;
  onDayOff: () => void;
}) {
  const colors = useColors();
  const off = isDayOff(state, date);
  const lines = kind === 'future' ? [] : todayLines(remindersOn(state, date, now), pausesOn(state, date));
  const tally = dayTally(state, date);
  const outstandingId = kind === 'today' ? outstandingReminder(state, now)?.id : undefined;

  return (
    <View style={styles.section}>
      <Text style={[styles.date, { color: colors.text.primary }]} accessibilityRole="header">
        {longDayOf(date)}
      </Text>
      {kind === 'future' ? (
        <Text style={[styles.note, { color: colors.text.secondary }]}>{off ? 'Day Off' : 'Still ahead'}</Text>
      ) : (
        <>
          <Text style={[styles.note, { color: colors.text.secondary }]}>
            {off ? 'Day Off · ' : ''}
            {tally.done} done · {tally.skipped} skipped · {tally.missed} missed · {tally.exercises} Exercises
          </Text>
          {lines.length === 0 ? (
            <Text style={[styles.note, { color: colors.text.secondary }]}>
              {kind === 'today' ? 'No Reminders yet today.' : 'Nothing recorded.'}
            </Text>
          ) : (
            <View style={[styles.list, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
              {lines.map((line, i) =>
                line.kind === 'pause' ? (
                  <PauseRow
                    key={`pause-${line.pause.from}`}
                    pause={line.pause}
                    now={now}
                    timeZone={state.settings.timeZone}
                    divided={i > 0}
                    colors={colors}
                  />
                ) : (
                  <ReminderRow
                    key={line.reminder.id}
                    reminder={line.reminder}
                    status={statusOf(line.reminder, state, outstandingId, now, colors)}
                    shown={exercisesShown(line.reminder, exercises)}
                    divided={i > 0}
                    colors={colors}
                  />
                ),
              )}
            </View>
          )}
        </>
      )}
      {kind !== 'past' && (
        <Pressable
          onPress={onDayOff}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          style={busy && styles.disabled}
        >
          <Text style={[styles.action, { color: colors.accent.hero }]}>{off ? 'Undo Day Off' : 'Mark as Day Off'}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** A Reminder's row, read only: time, outcome dot, status and "snoozed ×N", then its Exercises. */
function ReminderRow({
  reminder: r,
  status,
  shown,
  divided,
  colors,
}: {
  reminder: Reminder;
  status: { label: string; color: string };
  shown: ShownExercise[];
  divided: boolean;
  colors: Palette;
}) {
  const snoozes = r.snoozes ?? 0;
  return (
    <View style={[styles.row, divided && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line.divider }]}>
      <View style={styles.rowHead}>
        <Text style={[styles.time, { color: colors.text.primary }]}>{timeOf(r.firesAt)}</Text>
        <View style={[styles.dot, { backgroundColor: status.color }]} />
        <Text style={[styles.status, styles.shrink, { color: status.color }]} numberOfLines={1}>
          {status.label}
        </Text>
        {snoozes > 0 && (
          <Text style={[styles.tag, { color: colors.text.secondary, borderColor: colors.line.divider }]}>snoozed ×{snoozes}</Text>
        )}
      </View>
      {shown.map((e) => (
        <ExerciseLine key={e.id} exercise={e} colors={colors} />
      ))}
    </View>
  );
}

/** One Exercise of a row: its start photo (an empty box when it has none) and its name. */
function ExerciseLine({ exercise, colors }: { exercise: ShownExercise; colors: Palette }) {
  const source = exercise.photo ? photoSource(exercise.photo) : undefined;
  return (
    <View style={styles.exercise}>
      <View style={[styles.thumb, { backgroundColor: colors.line.divider }]}>
        {source !== undefined && <Image source={source} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />}
      </View>
      <Text style={[styles.exerciseName, styles.shrink, { color: colors.text.primary }]} numberOfLines={1}>
        {exercise.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  date: { fontSize: 18, fontWeight: '700' },
  note: { fontSize: 15 },
  list: { borderWidth: 1, borderRadius: 12 },
  row: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { fontSize: 14, fontWeight: '600' },
  shrink: { flexShrink: 1 },
  tag: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // The source photos are 850×567 (see app/library/[exerciseId].tsx).
  thumb: { width: 54, aspectRatio: 850 / 567, borderRadius: 6, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  exerciseName: { fontSize: 15 },
  action: { textAlign: 'center', fontSize: 15, fontWeight: '600', padding: 8 },
  disabled: { opacity: 0.5 },
});
