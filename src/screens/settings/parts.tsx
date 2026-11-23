import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useColors } from '../../theme';

/** Back to Today: pop this page, or, opened with nothing under it, go to Today. */
const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** The page header: a back arrow and the title, as on the other pages Today pushes. `backLabel` names where back goes. */
export function PageHeader({ title, backLabel = 'Back to Today' }: { title: string; backLabel?: string }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={12}>
        <Text style={[styles.back, { color: colors.text.primary }]}>‹</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text.primary }]} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

/** One section: its heading and a card holding its rows. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text.secondary }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
        {children}
      </View>
    </View>
  );
}

/** A thin line between two rows of a card. */
export function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.line.divider }]} />;
}

/** A row with its label and current value; with `onPress`, tapping it opens a picker. */
export function Row({
  label,
  value,
  note,
  onPress,
  disabled,
}: {
  label: string;
  value?: string;
  note?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const pressable = onPress !== undefined && !disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={!pressable}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { disabled: !pressable } : undefined}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
        {note !== undefined && <Text style={[styles.note, { color: colors.text.secondary }]}>{note}</Text>}
      </View>
      {value !== undefined && <Text style={[styles.value, { color: colors.text.secondary }]}>{value}</Text>}
      {onPress && <Text style={[styles.chevron, { color: colors.text.secondary }]}>›</Text>}
    </Pressable>
  );
}

/** A row with a switch: its label, an optional hint, and the current value as the switch. */
export function SwitchRow({
  label,
  note,
  value,
  onChange,
  disabled,
}: {
  label: string;
  note?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
        {note !== undefined && <Text style={[styles.note, { color: colors.text.secondary }]}>{note}</Text>}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.accent.hero, false: colors.line.divider }}
      />
    </View>
  );
}

/** A label, an optional hint, and its choices as chips under it. */
export function ChipsRow({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.chipsRow}>
      <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
      {note !== undefined && <Text style={[styles.note, { color: colors.text.secondary }]}>{note}</Text>}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

/** One chip: filled when selected (one of a set, or one owned of several). */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
  role = 'radio',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  role?: 'radio' | 'checkbox';
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.chip, { borderColor: colors.accent.hero }, selected && { backgroundColor: colors.accent.hero }]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.text.onHero : colors.accent.hero }]}>{label}</Text>
    </Pressable>
  );
}

/** One choice among several, as a radio row with a one-line hint. */
export function RadioRow({
  label,
  note,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  note: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.row, selected && { backgroundColor: colors.background.selected }]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
        <Text style={[styles.note, { color: colors.text.secondary }]}>{note}</Text>
      </View>
      {selected && <Text style={[styles.value, { color: colors.accent.hero }]}>✓</Text>}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 32, marginTop: -4 },
  title: { fontSize: 24, fontWeight: '800' },
  section: { gap: 8 },
  heading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 },
  disabled: { opacity: 0.5 },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 16 },
  note: { fontSize: 13, lineHeight: 18 },
  value: { fontSize: 15, fontWeight: '600' },
  chevron: { fontSize: 22, marginTop: -2 },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { borderWidth: 2, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, minWidth: 44, alignItems: 'center' },
  chipText: { fontSize: 14, fontWeight: '700' },
});
