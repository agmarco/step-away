import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme';

/** Today: placeholder until the real screen lands. */
export default function Today() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background.screen, paddingTop: insets.top + 24 }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>Today</Text>
      <Text style={[styles.date, { color: colors.text.secondary }]}>{date}</Text>
      {/* TEMPORARY (#19): link to the Exercise Library debug list; remove with app/debug/library.tsx. */}
      <Link href="/debug/library" style={[styles.debugLink, { color: colors.accent.hero }]}>
        Exercise Library (debug)
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '800' },
  date: { fontSize: 16, marginTop: 4 },
  debugLink: { fontSize: 14, marginTop: 24 },
});
