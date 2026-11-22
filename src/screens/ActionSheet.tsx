import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../theme';
import { OPTION_HEIGHT, Sheet, SheetButtons } from './settings/Sheet';

/** One action of an `ActionSheet`: its row's label and what it does. */
export type SheetAction = { key: string; label: string; onPress: () => void };

/**
 * A sheet of actions (on the Settings page's `Sheet`): a title, an optional
 * line under it, one button row per action (as tall as a sheet's `Option`), and Cancel. Picking an action
 * closes the sheet, then runs it; Cancel, a tap on the scrim and Android back
 * close it with nothing done.
 */
export function ActionSheet({
  visible,
  title,
  description,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  description?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Sheet visible={visible} title={title} sub={description} onClose={onClose}>
      <View style={styles.list}>
        {actions.map(({ key, label, onPress }) => (
          <Pressable
            key={key}
            onPress={() => {
              onClose();
              onPress();
            }}
            accessibilityRole="button"
            style={styles.action}
          >
            <Text style={[styles.actionText, { color: colors.text.primary }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <SheetButtons secondary={{ label: 'Cancel', onPress: onClose }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 8 },
  action: { justifyContent: 'center', height: OPTION_HEIGHT, paddingHorizontal: 14, borderRadius: 10 },
  actionText: { fontSize: 16 },
});
