// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const local = require('./tools/eslint/no-literal-colors');

const CORE_IMPORT_MESSAGE =
  'src/core is pure TypeScript: no React, React Native or Expo imports. Return an intent for an adapter to carry out instead.';
// Same set as the no-restricted-imports group below, for require() and import().
// An esquery regex can't contain "/", so \x2F stands for it.
const FORBIDDEN_SOURCE = String.raw`/^(react|react-native|expo)(\x2F|$)|^expo-|^@expo\x2F/`;

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**', 'android/**', 'ios/**'],
  },
  {
    // The domain core is pure TypeScript: no React, React Native or Expo.
    files: ['core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-native', 'react-native/*', 'expo', 'expo/*', 'expo-*', '@expo/*'],
              message: CORE_IMPORT_MESSAGE,
            },
          ],
        },
      ],
      // no-restricted-imports only sees static imports; cover require() and import() too.
      'no-restricted-syntax': [
        'error',
        {
          selector: `CallExpression[callee.name='require'] > Literal.arguments[value=${FORBIDDEN_SOURCE}]`,
          message: CORE_IMPORT_MESSAGE,
        },
        {
          selector: `ImportExpression > Literal.source[value=${FORBIDDEN_SOURCE}]`,
          message: CORE_IMPORT_MESSAGE,
        },
      ],
    },
  },
  {
    // Screens and other UI code read colours only through the theme/ tokens.
    // app.config.ts is native config, not UI: its adaptive-icon background is a literal.
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['theme/**', 'app.config.ts'],
    plugins: { local },
    rules: { 'local/no-literal-colors': 'error' },
  },
]);
