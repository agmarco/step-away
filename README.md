# Activity Reminder

A personal Android app that nudges a desk worker to move on a configurable schedule and suggests quick Exercises to do at the desk. Built with Expo (React Native / TypeScript), Android-first.

The v1 spec is being charted as a wayfinder map: [Map: Activity Reminder v1 spec](https://github.com/agmarco/activityReminder/issues/1). Decisions live on its tickets; the map indexes them.

## Layout

| Path | What lives there |
|---|---|
| [`CONTEXT.md`](CONTEXT.md) | Domain glossary: Reminder, Suggestion, Exercise, Response… Use these terms everywhere. |
| [`docs/`](docs/) | Index of decisions, research and ADRs. |
| [`prototypes/`](prototypes/) | Index of throwaway prototypes. The code itself lives on `prototype/<name>` branches. |
| [`src/`](src/) | App source (once building starts). |

## Development

The Expo project (SDK 58, TypeScript, Expo Router) sits at the repo root. Node and npm are all you need on the Mac; native builds run on EAS.

```sh
npm install          # or npm ci
npm test             # Vitest: src/**/*.test.ts in Node (the domain core)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint: Expo rules, the core import rule, the no-literal-colours rule
npx expo start       # dev server (npm start); open it in the "Activity Reminder (dev)" app
npm run web          # the same app in a browser, for a quick look (light/dark follows the OS)
```

`npx expo start` serves JavaScript to the **development** build (a dev client), not to Expo Go, so the dev app must be installed on the phone first. `npx expo export --platform web` writes a static web build to `dist/`.

Two rules guard the architecture, both run by `npm run lint`:

- `src/core/**` may not import `react`, `react-native`, `expo`, `expo-*` or `@expo/*` (`no-restricted-imports`).
- Code under `src/` outside `src/theme/` may not contain literal colours: hex, `rgb()`/`rgba()`/`hsl()`/`hsla()`, or any string given to a `…color` style key or prop (`local/no-literal-colors`, in [`eslint/no-literal-colors.js`](eslint/no-literal-colors.js)). Use `useColors()` from `src/theme`.

### App variants and EAS builds

`app.config.ts` picks the app from `APP_VARIANT`; each [`eas.json`](eas.json) profile sets it.

| EAS profile | `APP_VARIANT` | App name | Android package | Build |
|---|---|---|---|---|
| `preview` | `preview` (also the default when unset) | Activity Reminder | `com.agmarco.activityreminder` | standalone APK, internal distribution |
| `development` | `development` | Activity Reminder (dev) | `com.agmarco.activityreminder.dev` | dev client APK, internal distribution |

The two packages differ, so both apps install side by side. Both set `android.allowBackup: true` and `runtimeVersion: { policy: "fingerprint" }`. Check a variant's resolved config with `APP_VARIANT=development npx expo config --type public`.

Builds are **owner steps**: `eas init` (links the project and adds its `projectId`), `eas build --profile development --platform android` and `eas build --profile preview --platform android` need the Expo account and are run by the owner, not by agents.
