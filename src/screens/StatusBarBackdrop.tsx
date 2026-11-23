import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme';

/**
 * A screen-coloured strip behind the transparent status bar, so a page's
 * content doesn't show under the clock once it scrolls. Render it after the
 * page's ScrollView, so it draws on top.
 */
export function StatusBarBackdrop() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={[styles.strip, { height: insets.top, backgroundColor: colors.background.screen }]}
    />
  );
}

const styles = StyleSheet.create({
  strip: { position: 'absolute', top: 0, left: 0, right: 0 },
});
