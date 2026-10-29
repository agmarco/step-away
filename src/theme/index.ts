import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './colors';

export { dark, light, type Palette } from './colors';

export type Scheme = 'light' | 'dark';

/** useColorScheme() can return null (or 'unspecified'); anything but 'dark' is light. */
export function useScheme(): Scheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** The one place that decides which palette belongs to which scheme. */
export const palettes: Record<Scheme, Palette> = { light, dark };

/** The palette for the current scheme. Read it on every render; don't cache it. */
export function useColors(): Palette {
  return palettes[useScheme()];
}

function navigationTheme(base: Theme, palette: Palette): Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.accent.hero,
      background: palette.background.screen,
      card: palette.background.card,
      text: palette.text.primary,
      border: palette.line.divider,
      notification: palette.accent.hero,
    },
  };
}

/** React Navigation themes matching the tokens, for Expo Router's ThemeProvider. */
export const navigationThemes: Record<Scheme, Theme> = {
  light: navigationTheme(DefaultTheme, palettes.light),
  dark: navigationTheme(DarkTheme, palettes.dark),
};
