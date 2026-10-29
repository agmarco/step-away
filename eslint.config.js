// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const local = require('./eslint/no-literal-colors');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**', 'android/**', 'ios/**', 'prototypes/**'],
  },
  {
    // The domain core is pure TypeScript: no React, React Native or Expo.
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-native', 'react-native/*', 'expo', 'expo/*', 'expo-*', '@expo/*'],
              message: 'src/core is pure TypeScript: no React, React Native or Expo imports. Return an intent for an adapter to carry out instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Screens and other UI code read colours only through src/theme tokens.
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: ['src/theme/**'],
    plugins: { local },
    rules: { 'local/no-literal-colors': 'error' },
  },
]);
