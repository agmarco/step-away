import { router } from 'expo-router';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme';

/** Back to Today: pop this page, or, opened with nothing under it, go to Today. */
const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * A page pushed from Today's tiles that isn't built yet: a back arrow, its
 * title and what lands later. Android back pops it like any Stack screen.
 */
export function StubPage({ title, body }: { title: string; body: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background.screen }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back to Today" hitSlop={12}>
          <Text style={[styles.back, { color: colors.text.primary }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
        <Text style={[styles.body, { color: colors.text.secondary }]}>{body}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 32, marginTop: -4 },
  title: { fontSize: 24, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  body: { fontSize: 15, lineHeight: 22 },
});
