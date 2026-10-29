import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme';

/** Today: placeholder until the real screen lands. */
export default function Today() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={[styles.root, { backgroundColor: c.background.screen, paddingTop: insets.top + 24 }]}>
      <Text style={[styles.title, { color: c.text.primary }]}>Today</Text>
      <Text style={[styles.date, { color: c.text.secondary }]}>{date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '800' },
  date: { fontSize: 16, marginTop: 4 },
});
