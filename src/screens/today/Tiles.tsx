import { type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../theme';
import { useOpenPage } from './useOpenPage';

const TILES: { icon: string; label: string; href: Href }[] = [
  { icon: '📅', label: 'History', href: '/history' },
  { icon: '🏅', label: 'Achievements', href: '/achievements' },
  { icon: '⚙️', label: 'Settings', href: '/settings' },
];

/**
 * The three tiles under the hero (B4), each pushing its page on the Stack, so
 * the back arrow and Android back return to Today. One page opens at a time
 * (useOpenPage). The Achievements tile's
 * "new" dot comes with Badges (#28).
 */
export function Tiles() {
  const colors = useColors();
  const open = useOpenPage();
  return (
    <View style={styles.row}>
      {TILES.map((t) => (
        <Pressable
          key={t.label}
          onPress={() => open(t.href)}
          accessibilityRole="button"
          accessibilityLabel={t.label}
          style={[styles.tile, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}
        >
          <Text style={styles.icon}>{t.icon}</Text>
          <Text style={[styles.label, { color: colors.text.primary }]} numberOfLines={1}>
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Overlaps the hero's bottom edge, as in the prototype.
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: -18 },
  tile: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: 'center', gap: 4, elevation: 3 },
  icon: { fontSize: 24 },
  label: { fontSize: 13, fontWeight: '700' },
});
