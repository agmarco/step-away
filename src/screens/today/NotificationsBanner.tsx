import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openSystemSettings } from '../../platform/notificationPermission';
import { useColors } from '../../theme';

/**
 * Today's banner while notifications are blocked (#31): why no Reminder will
 * arrive, and Turn on (the app's page in the system settings). Today shows it
 * only while the permission reads blocked; it is re-read when the app comes
 * back to the front, so it goes once allowed.
 */
export function NotificationsBanner() {
  const colors = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: colors.background.banner }]}>
      <Text style={[styles.text, { color: colors.text.primary }]}>Reminders are off: notifications are blocked</Text>
      <Pressable
        onPress={openSystemSettings}
        accessibilityRole="button"
        style={[styles.turnOn, { backgroundColor: colors.accent.hero }]}
      >
        <Text style={[styles.turnOnText, { color: colors.text.onHero }]}>Turn on</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14 },
  text: { flex: 1, fontSize: 15, lineHeight: 20 },
  turnOn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  turnOnText: { fontSize: 14, fontWeight: '700' },
});
