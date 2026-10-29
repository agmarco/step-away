import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './colors';

export { dark, light, type Palette } from './colors';

export type Scheme = 'light' | 'dark';

/** useColorScheme() can return null (or 'unspecified'); anything but 'dark' is light. */
export function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** The palette for the current scheme. Read it on every render; don't cache it. */
export function useColors(): Palette {
  return useScheme() === 'dark' ? dark : light;
}

function navigationTheme(base: Theme, p: Palette): Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: p.accent.hero,
      background: p.background.screen,
      card: p.background.card,
      text: p.text.primary,
      border: p.line.divider,
      notification: p.accent.hero,
    },
  };
}

/** React Navigation themes matching the tokens, for Expo Router's ThemeProvider. */
export const navigationThemes: Record<Scheme, Theme> = {
  light: navigationTheme(DefaultTheme, light),
  dark: navigationTheme(DarkTheme, dark),
};
