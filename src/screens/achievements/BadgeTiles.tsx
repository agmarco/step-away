import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../theme';
import type { BadgeSection } from './labels';

/**
 * One group's Badges on the Achievements page: an unlocked Badge on the card
 * with a `badge.earned` ring and a medal, a locked one on the screen
 * background with a dashed divider border, a lock and its label in the
 * secondary text colour; a New tag (`badge.new`) on those unlocked since the
 * previous visit.
 */
export function BadgeTiles({ section }: { section: BadgeSection }) {
  const colors = useColors();
  return (
    <View style={styles.grid}>
      {section.badges.map((b) => (
        <View
          key={b.id}
          accessible
          accessibilityLabel={`${section.label} ${b.label}: ${b.unlocked ? 'unlocked' : 'locked'}${b.isNew ? ', new' : ''}`}
          style={[
            styles.tile,
            b.unlocked
              ? { backgroundColor: colors.background.card, borderColor: colors.badge.earned, borderWidth: 2 }
              : { backgroundColor: colors.background.screen, borderColor: colors.line.divider, borderStyle: 'dashed' },
          ]}
        >
          <Text style={[styles.icon, !b.unlocked && styles.lockedIcon]}>{b.unlocked ? '🏅' : '🔒'}</Text>
          <Text
            style={[styles.label, { color: b.unlocked ? colors.text.primary : colors.text.secondary }]}
            numberOfLines={2}
          >
            {b.label}
          </Text>
          {b.isNew && <Text style={[styles.newTag, { color: colors.badge.new }]}>New</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '31.5%',
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
  },
  icon: { fontSize: 24 },
  lockedIcon: { opacity: 0.4 },
  label: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  newTag: { position: 'absolute', top: 4, right: 6, fontSize: 11, fontWeight: '800' },
});
