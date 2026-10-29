# src

App source. The Expo project sits at the repo root (`package.json`, `app.config.ts`, `eas.json`), with screens under `src/app/` (Expo Router) and the rest of the code alongside it in `src/`.

| Path | What lives there |
|---|---|
| `app/` | Expo Router screens. `_layout.tsx` is the root layout: it wraps the router in a `ThemeProvider` with the navigation theme for the current light/dark scheme. `index.tsx` is Today (a placeholder for now). Screens stay thin and aren't unit-tested. |
| `core/` | The domain core: pure TypeScript, no React, React Native or Expo imports (lint-enforced). One entry point, `reduce(state, event, { clock, random })`, returns `{ state, intents }`; adapters carry out the intents, the core never calls the platform. Time and randomness are injected (`Clock`, `Random`; `seededRandom(seed)` for tests). Tests (`*.test.ts`) run in Node with Vitest. Currently a skeleton handling one event, `AppOpened`. |
| `theme/` | The colour tokens: `light` and `dark` palettes of the same shape, grouped into backgrounds, text, lines, accent/hero, Reminder outcomes (Done / Skip / Missed, keyed by the core's `Outcome` type) and day states (Day Off / Goal Day). `useScheme()` reads `useColorScheme()` on every render (anything but `dark`, including `null`, means light); `useColors()` returns `palettes[useScheme()]`, and `navigationThemes` are built from the same `palettes` map. The only place in `src/` allowed to hold literal colours. |
