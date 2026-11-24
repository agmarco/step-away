import { Pressable, StyleSheet, Text, View } from 'react-native';
import { sameDate, type LocalDate, type MarkedDay, type YearMonth } from '../../core';
import { type Palette, useColors } from '../../theme';
import { MARK_LABEL, markStyle } from '../dayMarks';
import { longDayOf, monthTitleOf } from './format';
import { weeksOf } from './month';

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * History's month calendar: the month with ‹ › (each disabled at the end of
 * `historyRange`), a Monday-first grid of the month's days by `monthMarks`
 * (each cell drawn as in the week panel, `markStyle`, with its number under
 * it), and the legend. Tapping a day selects it; a day before any data
 * (`none`) can't be selected. The selected day, if any, has a ring around
 * its cell and number. Each cell is keyed by its mark, so a mark change mounts
 * a fresh view (see `markStyle`).
 */
export function Calendar({
  month,
  marks,
  selected,
  canGoBack,
  canGoForward,
  onStep,
  onSelect,
}: {
  month: YearMonth;
  marks: MarkedDay[];
  selected: LocalDate | null;
  canGoBack: boolean;
  canGoForward: boolean;
  onStep: (by: -1 | 1) => void;
  onSelect: (date: LocalDate) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
      <View style={styles.header}>
        <Arrow label="Previous month" glyph="‹" enabled={canGoBack} onPress={() => onStep(-1)} colors={colors} />
        <Text style={[styles.title, { color: colors.text.primary }]} accessibilityRole="header">
          {monthTitleOf(month)}
        </Text>
        <Arrow label="Next month" glyph="›" enabled={canGoForward} onPress={() => onStep(1)} colors={colors} />
      </View>
      <View>
        <View style={styles.row} importantForAccessibility="no-hide-descendants">
          {WEEKDAY_LETTERS.map((letter, i) => (
            <View key={`w${i}`} style={styles.slot}>
              <Text style={[styles.weekday, { color: colors.text.secondary }]}>{letter}</Text>
            </View>
          ))}
        </View>
        {weeksOf(month, marks).map((week, w) => (
          <View key={`r${w}`} style={styles.row}>
            {week.map((entry, i) => {
              if (!entry) return <View key={`b${i}`} style={styles.slot} />;
              const { date, mark } = entry;
              const isSelected = selected !== null && sameDate(date, selected);
              const blank = mark === 'none';
              return (
                <View key={date.day} style={styles.slot}>
                  <Pressable
                    onPress={() => onSelect(date)}
                    disabled={blank}
                    accessibilityRole={blank ? undefined : 'button'}
                    accessibilityLabel={`${longDayOf(date)}, ${MARK_LABEL[mark]}`}
                    accessibilityState={blank ? undefined : { selected: isSelected }}
                    style={[styles.day, { borderColor: isSelected ? colors.text.primary : 'transparent' }]}
                  >
                    <View key={mark} style={[styles.cell, markStyle(mark, colors)]} />
                    <Text
                      style={[
                        styles.number,
                        { color: blank ? colors.text.secondary : colors.text.primary },
                        isSelected && styles.numberSelected,
                      ]}
                    >
                      {date.day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Legend color={colors.day.goalDay} label="Goal Day" colors={colors} />
        <Legend color={colors.outcome.missed} label="Missed goal" colors={colors} />
        <Legend color={colors.day.dayOff} label="Day Off" colors={colors} />
        <Legend color={colors.line.divider} label="No Active Hours" colors={colors} />
      </View>
    </View>
  );
}

function Arrow({
  label,
  glyph,
  enabled,
  onPress,
  colors,
}: {
  label: string;
  glyph: string;
  enabled: boolean;
  onPress: () => void;
  colors: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      hitSlop={12}
      style={[styles.arrow, !enabled && styles.disabled]}
    >
      <Text style={[styles.arrowText, { color: colors.text.primary }]}>{glyph}</Text>
    </Pressable>
  );
}

function Legend({ color, label, colors }: { color: string; label: string; colors: Palette }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: colors.text.secondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  arrow: { paddingHorizontal: 12 },
  arrowText: { fontSize: 26 },
  disabled: { opacity: 0.3 },
  // Each week (and the weekday letters) is its own row of exactly seven
  // equal slots: `flex: 1` shares the row's width, so nothing can wrap.
  row: { flexDirection: 'row' },
  slot: { flex: 1, padding: 2, alignItems: 'stretch' },
  weekday: { textAlign: 'center', fontSize: 12, fontWeight: '600' },
  day: { borderWidth: 2, borderRadius: 10, padding: 3, gap: 2, alignItems: 'center' },
  cell: { height: 22, alignSelf: 'stretch', borderRadius: 6 },
  number: { fontSize: 13, fontVariant: ['tabular-nums'] },
  numberSelected: { fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13 },
});
