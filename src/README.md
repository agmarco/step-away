# src

The app. This folder is the Expo project root (SDK 58, TypeScript, Expo Router): its config, its tooling and all of its code live here. Node and npm are all you need on the Mac; native builds run on EAS. Run every command below from `src/`.

| Path | What lives there |
|---|---|
| `package.json`, `package-lock.json` | Dependencies and npm scripts. |
| `app.config.ts` | Expo app config; picks the app variant from `APP_VARIANT` (see below). |
| `eas.json` | EAS build profiles. |
| `tsconfig.json`, `eslint.config.js`, `vitest.config.ts` | TypeScript, ESLint and Vitest config. |
| `assets/` | App icon, Android adaptive-icon layers and web favicon. |
| `tools/` | Project tooling. `tools/eslint/no-literal-colors.js` is the local ESLint rule; `tools/library/` is the Exercise Library build step (see below). |
| `library/` | The Exercise Library: vendored source, curation files, photos and the generated output (see below). |
| `app/` | Expo Router screens (Expo Router's default `app/` directory under the project root). `_layout.tsx` is the root layout: it wraps the router in a `ThemeProvider` with the navigation theme for the current light/dark scheme. `index.tsx` is Today (a placeholder for now). Screens stay thin and aren't unit-tested. |
| `core/` | The domain core: pure TypeScript, no React, React Native or Expo imports (lint-enforced). One entry point, `reduce(state, event, { clock, random })`, returns `{ state, intents }`; adapters carry out the intents, the core never calls the platform. Time and randomness are injected (`Clock`, `Random`; `seededRandom(seed)` for tests). Tests (`*.test.ts`) run in Node with Vitest. Currently a skeleton handling one event, `AppOpened`. |
| `theme/` | The colour tokens: `light` and `dark` palettes of the same shape, grouped into backgrounds, text, lines, accent/hero, Reminder outcomes (Done / Skip / Missed, keyed by the core's `Outcome` type) and day states (Day Off / Goal Day). `useScheme()` reads `useColorScheme()` on every render (anything but `dark`, including `null`, means light); `useColors()` returns `palettes[useScheme()]`, and `navigationThemes` are built from the same `palettes` map. The only place allowed to hold literal colours. |

## Commands

```sh
npm install          # or npm ci
npm test             # Vitest: **/*.test.ts in Node (the domain core and the library build)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint: Expo rules, the core import rule, the no-literal-colours rule
npx expo start       # dev server (npm start); open it in the "Activity Reminder (dev)" app
npm run web          # the same app in a browser, for a quick look (light/dark follows the OS)
```

`npx expo start` serves JavaScript to the **development** build (a dev client), not to Expo Go, so the dev app must be installed on the phone first. `npx expo export --platform web` writes a static web build to `dist/` (gitignored).

## Exercise Library

The Exercise Library is bundled app data, built at dev time from a vendored source plus our curation files. Nothing in it runs in the app except the generated output.

| Path | What lives there |
|---|---|
| `library/source/exercises.json` | free-exercise-db's `dist/exercises.json`, pinned to one commit and never edited. [`SOURCE.md`](library/source/SOURCE.md) records the commit, date, licence and sha256. |
| `library/curation/<group>.yaml` | One file per group (`base`, `floor`, one per Equipment type), keyed by frozen Id. Only Exercises with an entry ship. Format: [`library/curation/README.md`](library/curation/README.md). |
| `library/photos/<id>/{0,1}.jpg` | The start/end photos of the curated source Exercises, fetched from the pinned commit. |
| `library/library.json`, `library/photos.ts` | **Generated** by `npm run library:build`: the `Exercise[]` and the static photo index (one `require` per photo, so photos ship with EAS Update). Committed; never edit by hand. |
| `tools/library/` | The build (`build.ts`) and draft (`draft.ts`) as pure functions with fixture tests, and the CLI (`cli.ts`, run with `tsx`). |

```sh
npm run library:build            # validate the curation, write library.json and photos.ts; fails on any curation error
npm run library:draft -- <group> # print the uncurated candidates for a group, with the script-filled fields, as YAML
npm run library:photos           # download missing photos of every curated source Exercise at the pinned commit
```

`tools/library/committed.test.ts` rebuilds the library from the files on disk and fails if the committed `library.json` or `photos.ts` is stale, so after changing curation run `npm run library:photos` and `npm run library:build` and commit everything together. It also checks the source file against `SOURCE.md`.

## Lint rules

Two rules guard the architecture, both run by `npm run lint`:

- `core/**` may not import `react`, `react-native`, `expo`, `expo-*` or `@expo/*` (`no-restricted-imports`), and that also covers `require()` and dynamic `import()` (`no-restricted-syntax`).
- Code outside `theme/` may not contain literal colours: hex, `rgb()`/`rgba()`/`hsl()`/`hsla()`, or any string or numeric value given to a `…color` style key or prop (`local/no-literal-colors`, in [`tools/eslint/no-literal-colors.js`](tools/eslint/no-literal-colors.js)). Use `useColors()` from `theme/`. `app.config.ts` is also exempt: it is native config, and the adaptive-icon background is a literal.

Identifiers use US "color" (`useColors`, `backgroundColor`, `no-literal-colors`), following React Native and ESLint convention; prose uses "colour".

## App variants and EAS builds

`app.config.ts` picks the app from `APP_VARIANT`; each [`eas.json`](eas.json) profile sets it.

| EAS profile | `APP_VARIANT` | App name | Android package | Build |
|---|---|---|---|---|
| `preview` | `preview` (also the default when unset) | Activity Reminder | `com.agmarco.activityreminder` | standalone APK, internal distribution |
| `development` | `development` | Activity Reminder (dev) | `com.agmarco.activityreminder.dev` | dev client APK, internal distribution |

The two packages differ, so both apps install side by side. Both set `android.allowBackup: true` and `runtimeVersion: { policy: "fingerprint" }`. Check a variant's resolved config with `APP_VARIANT=development npx expo config --type public`.

[`fingerprint.config.js`](fingerprint.config.js) keeps the default (balanced) fingerprint but skips every `package.json` script, so adding or editing a script doesn't change the runtime fingerprint or need a new EAS build.

The app is linked to the EAS project `@agmarco/activity-reminder`: `app.config.ts` sets `owner` and `extra.eas.projectId` (the owner ran `eas init`; a dynamic config can't be written by EAS, so the ID lives there). EAS commands run from `src/`, like everything else. Builds are **owner steps**: `eas build --profile development --platform android` and `eas build --profile preview --platform android` need the Expo account and are run by the owner, not by agents.
