import { StyleSheet, View } from 'react-native';
import type { PauseLength } from '../../core';
import { Option, Sheet, SheetButtons } from '../settings/Sheet';

const LENGTHS: { length: PauseLength; label: string }[] = [
  { length: 'hour', label: '1 hour' },
  { length: 'twoHours', label: '2 hours' },
  { length: 'restOfToday', label: 'Rest of today' },
];

/**
 * The Pause sheet (on the Settings page's `Sheet`): 1 hour, 2 hours or Rest
 * of today. Picking one closes the sheet and calls `onPick`; Cancel, the scrim
 * and Android back close it with nothing changed.
 */
export function PauseSheet({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (length: PauseLength) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title="Pause Reminders" sub="No Reminders until the Pause ends." onClose={onClose}>
      <View style={styles.list}>
        {LENGTHS.map(({ length, label }) => (
          <Option
            key={length}
            label={label}
            selected={false}
            onPress={() => {
              onClose();
              onPick(length);
            }}
          />
        ))}
      </View>
      <SheetButtons secondary={{ label: 'Cancel', onPress: onClose }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 8 },
});
