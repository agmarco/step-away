/**
 * The Pause deep link (#45): `<scheme>://pause/<length>`, opened by the
 * launcher shortcuts (Pause 1 h, Pause 2 h, Pause rest of today; see
 * plugins/withPauseShortcuts.ts). A valid length (the core's `pauseLengthOf`)
 * pauses through the handler's `pause`, exactly once per opening (a ref, so a
 * re-render or a second effect run doesn't pause twice); then the screen goes
 * to Today, which shows the Pause through its usual path. A Pause the core
 * rejects (e.g. on a Day Off) is a no-op, and an unknown length only goes to
 * Today. Today is reached with `dismissTo`: back to it when it is already
 * under this screen, in its place on a cold start.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { pauseLengthOf } from '../../core';
import { pause } from '../../platform/handler';
import { useColors } from '../../theme';

export default function PauseLink() {
  const colors = useColors();
  const { length } = useLocalSearchParams<{ length: string }>();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const valid = pauseLengthOf(length);
    if (!valid) {
      router.dismissTo('/');
      return;
    }
    pause(valid)
      .catch((e: unknown) => console.warn(`[pause link] Pause ${valid} failed: ${e}`))
      .finally(() => router.dismissTo('/'));
  }, [length]);

  return <View style={{ flex: 1, backgroundColor: colors.background.screen }} />;
}
