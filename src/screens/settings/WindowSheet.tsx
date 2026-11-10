import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ActiveWindow } from '../../core';
import { useColors } from '../../theme';
import { endTimes, formatTime, startTimes } from './activeHours';
import { OPTION_HEIGHT, Option, Sheet, SheetButtons } from './Sheet';

/**
 * Picks an Active Hours window: a Start list and an End list in 15-minute
 * steps, the End always after the Start. Save calls `onSave`; with
 * `onUseMain` (a day's override) there is also "Use main hours".
 */
export function WindowSheet({
  title,
  window,
  onSave,
  onUseMain,
  onClose,
}: {
  title: string;
  window: ActiveWindow | null;
  onSave: (window: ActiveWindow) => void;
  onUseMain?: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={window !== null} title={title} sub="Reminders come from the start until the end." onClose={onClose}>
      {window && <Body key={`${window.start}-${window.end}`} initial={window} onSave={onSave} onUseMain={onUseMain} onClose={onClose} />}
    </Sheet>
  );
}

function Body({
  initial,
  onSave,
  onUseMain,
  onClose,
}: {
  initial: ActiveWindow;
  onSave: (window: ActiveWindow) => void;
  onUseMain?: () => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const starts = startTimes(24 * 60);
  const ends = endTimes(start);

  const pickStart = (t: number) => {
    setStart(t);
    // Keep the End after the Start.
    if (end <= t) setEnd(endTimes(t)[0]);
  };
  const offset = (list: number[], t: number) => ({ x: 0, y: Math.max(0, (list.indexOf(t) - 2) * OPTION_HEIGHT) });

  return (
    <>
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={[styles.columnTitle, { color: colors.text.secondary }]}>Start</Text>
          <ScrollView style={styles.list} contentOffset={offset(starts, initial.start)}>
            {starts.map((t) => (
              <Option key={t} label={formatTime(t)} selected={t === start} onPress={() => pickStart(t)} />
            ))}
          </ScrollView>
        </View>
        <View style={styles.column}>
          <Text style={[styles.columnTitle, { color: colors.text.secondary }]}>End</Text>
          <ScrollView style={styles.list} contentOffset={offset(endTimes(initial.start), initial.end)}>
            {ends.map((t) => (
              <Option key={t} label={formatTime(t)} selected={t === end} onPress={() => setEnd(t)} />
            ))}
          </ScrollView>
        </View>
      </View>
      {onUseMain && (
        <SheetButtons
          secondary={{
            label: 'Use main hours',
            onPress: () => {
              onClose();
              onUseMain();
            },
          }}
        />
      )}
      <SheetButtons
        secondary={{ label: 'Cancel', onPress: onClose }}
        primary={{
          label: 'Save',
          onPress: () => {
            onClose();
            if (start !== initial.start || end !== initial.end) onSave({ start, end });
          },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  column: { flex: 1, gap: 4 },
  columnTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 14 },
  list: { flexGrow: 0, maxHeight: OPTION_HEIGHT * 5.5 },
});
