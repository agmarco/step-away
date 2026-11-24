import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Celebration } from '../../platform/handler';
import { useColors } from '../../theme';
import { StatusBarBackdrop } from '../StatusBarBackdrop';
import { celebrationLine } from './labels';

/**
 * The guided flow's celebration card (#28), after a finish that carried the
 * core's `CelebrationDue`: "Daily Goal reached" when it was reached, and each
 * Badge unlocked by label. One action, Back to Today (`onDismiss`).
 */
export function CelebrationCard({ celebration, onDismiss }: { celebration: Celebration; onDismiss: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { goalReached, badges } = celebration;
  const badgeHeading = badges.length === 1 ? 'New Badge' : 'New Badges';
  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background.screen }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={[styles.card, { backgroundColor: colors.accent.hero }]} accessibilityLiveRegion="polite">
          <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
            {goalReached ? '🎉' : '🏅'}
          </Text>
          <Text style={[styles.title, { color: colors.text.onHero }]} accessibilityRole="header">
            {goalReached ? 'Daily Goal reached' : badgeHeading}
          </Text>
          {goalReached && badges.length > 0 && (
            <Text style={[styles.subheading, { color: colors.text.onHero }]}>{badgeHeading}</Text>
          )}
          {badges.map((id) => (
            <Text key={id} style={[styles.badge, { color: colors.text.onHero }]}>
              🏅 {celebrationLine(id)}
            </Text>
          ))}
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: colors.text.onHero }]}
          >
            <Text style={[styles.buttonText, { color: colors.accent.hero }]}>Back to Today</Text>
          </Pressable>
        </View>
      </ScrollView>
      <StatusBarBackdrop />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: { borderRadius: 20, padding: 24, gap: 12, alignItems: 'center' },
  icon: { fontSize: 56 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subheading: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  badge: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  button: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  buttonText: { fontSize: 18, fontWeight: '700' },
});
