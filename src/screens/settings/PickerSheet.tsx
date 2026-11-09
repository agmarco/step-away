import { ScrollView, StyleSheet } from 'react-native';
import { OPTION_HEIGHT, Option, Sheet, SheetButtons } from './Sheet';

/**
 * A list picker in a sheet: the current value ticked and scrolled into view.
 * Picking an option calls `onPick` and closes; Cancel, the scrim and Android
 * back close with nothing changed.
 */
export function PickerSheet<T extends number>({
  visible,
  title,
  sub,
  options,
  value,
  label,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  sub?: string;
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onPick: (option: T) => void;
  onClose: () => void;
}) {
  const index = Math.max(0, options.indexOf(value));
  return (
    <Sheet visible={visible} title={title} sub={sub} onClose={onClose}>
      <ScrollView style={styles.list} contentOffset={{ x: 0, y: Math.max(0, (index - 2) * OPTION_HEIGHT) }}>
        {options.map((option) => (
          <Option
            key={option}
            label={label(option)}
            selected={option === value}
            onPress={() => {
              onClose();
              if (option !== value) onPick(option);
            }}
          />
        ))}
      </ScrollView>
      <SheetButtons secondary={{ label: 'Cancel', onPress: onClose }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, maxHeight: OPTION_HEIGHT * 6.5, marginTop: 8 },
});
