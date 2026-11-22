import { useOpenPage } from './useOpenPage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { weekMarks, type CoreState, type DayMark } from '../../core';
import { type Palette, useColors } from '../../theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const MARK_LABEL: Record<DayMark, string> = {
  goal: 'Goal Day',
  missed: 'goal missed',
  off: 'no Active Hours',
  today: 'today',
  future: 'still ahead',
  dayOff: 'Day Off',
};

/** A week cell's look by mark: Goal Day, missed and a Day Off are filled; today has a ring; the rest are empty. */
function cellStyle(mark: DayMark, colors: Palette) {
  switch (mark) {
    case 'goal':
      return { backgroundColor: colors.day.goalDay };
    case 'missed':
      return { backgroundColor: colors.outcome.missed };
    case 'off':
      return { backgroundColor: colors.line.divider };
    case 'dayOff':
      return { backgroundColor: colors.day.dayOff };
    case 'today':
      return { backgroundColor: colors.background.card, borderWidth: 2, borderColor: colors.accent.hero };
    case 'future':
      return { backgroundColor: colors.background.card, borderWidth: 1, borderColor: colors.line.divider };
  }
}

/**
 * The History panel (B4): this week's Mon-Fri by `weekMarks`, with a Day Off
 * legend entry only when one shows this week; tapping it opens History.
 */
export function WeekPanel({ state, now }: { state: CoreState; now: number }) {
  const colors = useColors();
  const marks = weekMarks(state, now);
  const open = useOpenPage();
  return (
    <Pressable
      onPress={() => open('/history')}
      accessibilityRole="button"
      accessibilityLabel={`History. This week: ${marks.map((m, i) => `${NAMES[i]} ${MARK_LABEL[m.mark]}`).join(', ')}`}
      style={[styles.card, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>History</Text>
        <Text style={[styles.chevron, { color: colors.text.secondary }]}>›</Text>
      </View>
      <View style={styles.cells}>
        {marks.map((m, i) => (
          <View key={i} style={styles.day}>
            <View style={[styles.cell, cellStyle(m.mark, colors)]} />
            <Text style={[styles.letter, { color: colors.text.secondary }]}>{LETTERS[i]}</Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Legend color={colors.day.goalDay} label="Goal Day" colors={colors} />
        <Legend color={colors.outcome.missed} label="Missed goal" colors={colors} />
        {marks.some((m) => m.mark === 'dayOff') && <Legend color={colors.day.dayOff} label="Day Off" colors={colors} />}
      </View>
    </Pressable>
  );
}

function Legend({ color, label, colors }: { color: string; label: string; colors: Palette }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.letter, { color: colors.text.secondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  chevron: { fontSize: 22 },
  cells: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 4 },
  cell: { height: 26, alignSelf: 'stretch', borderRadius: 6 },
  letter: { fontSize: 13 },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
