import { StyleSheet, Text, View } from 'react-native';
import type { Pause } from '../core';
import type { Palette } from '../theme';
import { timeOf } from './format';
import { pauseLine } from './pauseDisplay';

/**
 * A Pause's line (`pauseLine`), on Today's list and History's day panel. Not
 * a Reminder: no dot colour of its own, no action.
 */
export function PauseRow({
  pause,
  now,
  timeZone,
  divided,
  colors,
}: {
  pause: Pause;
  now: number;
  timeZone: string;
  divided: boolean;
  colors: Palette;
}) {
  return (
    <View style={[styles.row, divided && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line.divider }]}>
      <View style={[styles.dot, { backgroundColor: colors.text.secondary }]} />
      <Text style={[styles.pause, { color: colors.text.secondary }]}>
        {pauseLine(pause, now, timeZone, timeOf)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pause: { flex: 1, fontSize: 15, fontWeight: '600' },
});
