import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { navigationThemes, useScheme } from '../theme';

export default function RootLayout() {
  const scheme = useScheme();
  return (
    <ThemeProvider value={navigationThemes[scheme]}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
