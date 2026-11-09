import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../theme';

/**
 * A bottom sheet on React Native's `Modal`, like Today's correction sheet:
 * a title, an optional line under it, and its content. Android back and a tap
 * on the scrim close it.
 */
export function Sheet({
  visible,
  title,
  sub,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  sub?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.background.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.background.card, paddingBottom: insets.bottom + 20 }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
        {sub !== undefined && <Text style={[styles.sub, { color: colors.text.secondary }]}>{sub}</Text>}
        {children}
      </View>
    </Modal>
  );
}

/** A sheet's buttons: an outlined one and, optionally, a filled one. */
export function SheetButtons({
  secondary,
  primary,
}: {
  secondary: { label: string; onPress: () => void };
  primary?: { label: string; onPress: () => void };
}) {
  const colors = useColors();
  return (
    <View style={styles.actions}>
      <Pressable
        onPress={secondary.onPress}
        accessibilityRole="button"
        style={[styles.button, styles.outline, { borderColor: colors.line.divider }]}
      >
        <Text style={[styles.buttonText, { color: colors.text.primary }]}>{secondary.label}</Text>
      </Pressable>
      {primary && (
        <Pressable onPress={primary.onPress} accessibilityRole="button" style={[styles.button, { backgroundColor: colors.accent.hero }]}>
          <Text style={[styles.buttonText, { color: colors.text.onHero }]}>{primary.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** One option of a sheet's list: highlighted with a tick when it is the current value. */
export function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.option, selected && { backgroundColor: colors.background.selected }]}
    >
      <Text style={[styles.optionText, { color: colors.text.primary }]}>{label}</Text>
      {selected && <Text style={[styles.optionText, { color: colors.accent.hero }]}>✓</Text>}
    </Pressable>
  );
}

/** Each option's height, so a list can open scrolled to the current value. */
export const OPTION_HEIGHT = 48;

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 20, paddingHorizontal: 20, gap: 6 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 14 },
  option: { flexDirection: 'row', alignItems: 'center', height: OPTION_HEIGHT, paddingHorizontal: 14, borderRadius: 10 },
  optionText: { fontSize: 16, flexGrow: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  button: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  outline: { borderWidth: 2 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
