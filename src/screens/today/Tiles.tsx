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
 * (useOpenPage). The Achievements tile shows the new-Badge dot (`badge.new`)
 * while `newBadge` (the core's `hasNewBadge`, #28): opening Achievements
 * records the visit, and the dot is gone once Today re-reads the state.
 */
export function Tiles({ newBadge }: { newBadge: boolean }) {
  const colors = useColors();
  const open = useOpenPage();
  return (
    <View style={styles.row}>
      {TILES.map((t) => (
        <Pressable
          key={t.label}
          onPress={() => open(t.href)}
          accessibilityRole="button"
          accessibilityLabel={t.href === '/achievements' && newBadge ? `${t.label}, new Badge` : t.label}
          style={[styles.tile, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}
        >
          <View>
            <Text style={styles.icon}>{t.icon}</Text>
            {t.href === '/achievements' && newBadge && (
              <View style={[styles.dot, { backgroundColor: colors.badge.new, borderColor: colors.background.card }]} />
            )}
          </View>
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
  // The new-Badge dot at the icon's top right, as in the prototype's tile (variant B).
  dot: { position: 'absolute', top: -2, right: -8, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  label: { fontSize: 13, fontWeight: '700' },
});
