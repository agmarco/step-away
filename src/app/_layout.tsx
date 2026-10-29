import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useReminderRuntime } from '../platform/useReminderRuntime';
import { navigationThemes, useScheme } from '../theme';

export default function RootLayout() {
  const scheme = useScheme();
  useReminderRuntime();
  return (
    <ThemeProvider value={navigationThemes[scheme]}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
