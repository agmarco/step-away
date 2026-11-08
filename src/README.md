# src

The app. This folder is the Expo project root (SDK 58, TypeScript, Expo Router): its config, its tooling and all of its code live here. Node and npm are all you need on the Mac; native builds run on EAS. Run every command below from `src/`.

| Path | What lives there |
|---|---|
| `package.json`, `package-lock.json` | Dependencies and npm scripts. `main` is `index.ts`. |
| `index.ts` | The app entry: imports `platform/task.ts` first (the background notification task must be defined at module scope before the app registers), then `expo-router/entry`. |
| `app.config.ts` | Expo app config; picks the app variant from `APP_VARIANT` (see below) and holds the exact-alarm switch. |
| `eas.json` | EAS build profiles. |
| `tsconfig.json`, `eslint.config.js`, `vitest.config.ts` | TypeScript, ESLint and Vitest config. |
| `assets/` | App icon, Android adaptive-icon layers and web favicon. |
| `tools/` | Project tooling. `tools/eslint/no-literal-colors.js` is the local ESLint rule; `tools/library/` is the Exercise Library build step (see below). |
| `library/` | The Exercise Library: vendored source, curation files, photos and the generated output (see below). |
| `app/` | Expo Router screens (Expo Router's default `app/` directory under the project root). `_layout.tsx` is the root layout: it wraps the router in a `ThemeProvider` with the navigation theme for the current light/dark scheme and mounts the Reminder runtime (`platform/useReminderRuntime.ts`). `index.tsx` is Today, minimal for now (the next Reminder time, including a pending Snooze re-fire, and today's fired Reminders with their settled status and a "snoozed ×N" tag; the real design is #25). `debug/` holds temporary screens (the Exercise Library list, the dev-only test mode). Screens stay thin and aren't unit-tested. |
| `core/` | The domain core: pure TypeScript, no React, React Native or Expo imports (lint-enforced). One entry point, `reduce(state, event, { clock, random, library })`, returns `{ state, intents }`; adapters carry out the intents, the core never calls the platform. Time and randomness are injected (`Clock`, `Random`; `seededRandom(seed)` for tests). Tests (`*.test.ts`) run in Node with Vitest. See [The domain core](#the-domain-core). |
| `platform/` | The adapters: SQLite, notifications/alarms, the shared action handler, the background task and the hooks screens use. Thin and not unit-tested; checked on the Pixel. See [Platform adapters](#platform-adapters). |
| `theme/` | The colour tokens: `light` and `dark` palettes of the same shape, grouped into backgrounds, text, lines, accent/hero, Reminder outcomes (Done / Skip / Missed, keyed by the core's `Outcome` type) and day states (Day Off / Goal Day). `useScheme()` reads `useColorScheme()` on every render (anything but `dark`, including `null`, means light); `useColors()` returns `palettes[useScheme()]`, and `navigationThemes` are built from the same `palettes` map. The only place allowed to hold literal colours. |

## Commands

```sh
npm install          # or npm ci
npm test             # Vitest: **/*.test.ts in Node (the domain core and the library build)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint: Expo rules, the core import rule, the no-literal-colours rule
APP_VARIANT=development npx expo start   # dev server; open it in the "Activity Reminder (dev)" app
npm run web          # web: currently does not bundle (see below)
```

`APP_VARIANT=development npx expo start` serves JavaScript to the **development** build (a dev client), not to Expo Go, so the dev app must be installed on the phone first. Set the variant: plain `npx expo start` (and `npm start`) resolves the `preview` config, so the dev-only Test mode stays hidden.

The web build no longer bundles since #21: expo-sqlite's web worker imports a `.wasm` file Metro isn't configured to resolve. The target is Android, so there are no web shims; `npx expo export --platform web` fails with `Unable to resolve "./wa-sqlite/wa-sqlite.wasm"`.

## The domain core

`reduce(state, event, deps)` is the only entry point. `CoreState` holds the settings (Active Hours per weekday, Interval, IANA time zone, `snoozeMinutes`: the Snooze delay, `exercisesPerSuggestion`: dev only, how many distinct Exercises a Suggestion has until #24), the Reminders (fired ones plus the scheduled chain ahead, each with an Id deterministic from its fire time, a Suggestion snapshot of `{ id, name, dose, cue, bodyArea }` per Exercise, a status, and optionally `snoozes`, `refiresAt` and `done`), `lastResponseAt` and `lastAppOpenAt`.

Reminder statuses: `scheduled` (ahead, or fired with no final Response yet), `done` (with `done: [{ id, name, bodyArea }]`, the Exercises done in Suggestion order, copied from the Suggestion, not the library), `skipped`, `missed` (no Response before a later Reminder fired, or before its day's Active Hours ended) and `dropped` (snoozed, with its re-fire landing at or after its day's window end, so it never re-fires).

**Settling.** No JavaScript runs when a scheduled notification fires, so Missed and dropped can't be recorded at fire time. Every event first runs `settle(state, now)`, which derives them from the clock, comparing each Reminder's effective fire (`refiresAt ?? firesAt`): dropped at closing, Missed on replacement, Missed at closing. The window end is exclusive.

| Event | What it does |
|---|---|
| `AppOpened` | Records `lastAppOpenAt`. |
| `Rearm { timeZone? }` | JS is running: rebuilds the chain of upcoming Reminders over the next 7 days of Active Hours (no-Response fallbacks one Interval apart) and, when given, adopts the device time zone. Fired Reminders stay as they are. |
| `Response { reminderId, kind: 'Done', did }` | The guided flow's result, a final Response. Same guard as Skip. Keeps only the Ids in `did` that are in the Reminder's Suggestion, once each, in Suggestion order: with at least one the Reminder becomes `done` with their snapshots; with none (every card was Not this one) it is exactly a Skip. Either way `lastResponseAt` is now and the chain is rebuilt from now. |
| `Response { reminderId, kind: 'Skip' }` | A guarded Skip: accepted only for the outstanding Reminder (the latest fired one by effective fire, still `scheduled`, whether or not a Snooze re-fire is pending); the chain is rebuilt from the Skip time. A Done or Skip before a pending re-fire cancels it: `refiresAt` is cleared, `snoozes` kept, and the re-fire is not scheduled. A Reminder whose re-fire lands past closing stays outstanding until its day's window end. Anything else (duplicate, not fired, superseded, unknown, Missed, dropped) is a no-op that only dismisses the notification and returns the input state. |
| `Response { reminderId, kind: 'Snooze' }` | Not a final Response (`lastResponseAt` unchanged). Same guard, plus no re-fire pending and fewer than 2 Snoozes so far. Re-fires the **same** Reminder (same Id and Suggestion) at now + `snoozeMinutes` and counts the Snooze; the next fallback Reminder comes one Interval after the re-fire. The re-fire's notification says it was snoozed and, after the 2nd Snooze, offers only Start and Skip. A re-fire at or after window end is never scheduled; it settles as dropped. |

| Intent | Carried out by |
|---|---|
| `ScheduleChain { reminders }` | Replaces the whole scheduled chain: cancel every scheduled notification, schedule these (including any pending Snooze re-fire, whose entry has Start / Skip only after the 2nd Snooze). |
| `DismissNotification { reminderId }` | Removes that Reminder's notification from the shade. |

Also exported: `outstandingReminder(state, now)` (the rule the Response guard uses; the adapter uses it to accept a Skip or Snooze and to dismiss stale notifications), `todaysReminders(state, now)` (today's fired Reminders in the Settings' time zone, newest first) and `nextReminder(state, now)` (the earliest of the first scheduled Reminder after `now` and any pending Snooze re-fire), both for Today, `settle`, `effectiveFire` and `refireScheduled(reminder, settings, now)` (whether a snoozed Reminder is coming back: its re-fire is ahead and before its day's window end; so Today shows settled statuses and re-fire times, and a re-fire past closing as "Snoozed past closing" straight away), `isReminderId(id)` (tells Reminder notifications from others), `formatDose`, `defaultSettings` (Mon–Fri 09:00–18:00, 45 min, 10-min Snooze, 1 Exercise per Suggestion) and `initialState`.

The chain is scheduled ahead because expo-notifications runs no JavaScript when a scheduled notification fires (see #21, "Owner decision: schedule the chain ahead"). Fired Reminders with no Response stay in the shade, bundled in one group, until JS next runs and dismisses the stale ones.

## Platform adapters

`platform/` follows the rules the background-responses probe proved on the Pixel (#12):

| File | What it does |
|---|---|
| `migrations.ts` | The schema, versioned by `PRAGMA user_version`, run once by `db()` right after opening (after `busy_timeout`). v0 → v1 creates the #21 schema if absent (a #21 DB is at version 0 with the tables already there); v1 → v2 (#22) adds `reminders.snoozes INTEGER NOT NULL DEFAULT 0` and `refires_at INTEGER NULL`, each only if missing. Each step runs in one `BEGIN IMMEDIATE` transaction with its version bump and re-reads the version inside it, so a step is all or nothing and two JS contexts opening together can't apply it twice. Never drop or recreate a table; the file's header says how to add the next step. |
| `db.ts` | One SQLite connection per JS context (`activity-reminder.db`; on Android `files/SQLite/activity-reminder.db`), `journal_mode = WAL`, `busy_timeout = 15000` (15 s: the chain, up to 100 notifications, is scheduled while `BEGIN IMMEDIATE` is held, and a cold-start headless Skip must outwait that rather than fail with `database is locked`). `write(fn)` serializes writes per JS context with a promise-chain mutex and runs each as `BEGIN IMMEDIATE … COMMIT`, `ROLLBACK` on error. **Never `withExclusiveTransactionAsync`**: it opens a second connection without `busy_timeout` and lost Skips to `database is locked` on the Pixel. |
| `store.ts` | `CoreState` in tables `reminders (id, fires_at, suggestion, status, snoozes, refires_at)` and `meta` (`settings` JSON, read over `defaultSettings` so settings stored before a field existed, e.g. #21's without `snoozeMinutes`, get its default; `last_response_at`, `last_app_open_at`). `snoozes` 0 ↔ absent, `refires_at` NULL ↔ absent. `saveState` replaces future Reminders and upserts fired ones, including their settled status (Missed, dropped). The guarded updates share one WHERE clause matching the core's guard and are accepted only when exactly one row changed: `guardedSkip` is `UPDATE reminders SET status='skipped' WHERE id=? AND status='scheduled' AND fires_at<=? AND (refires_at IS NULL OR refires_at<=?)`; `guardedSnooze` is `UPDATE reminders SET snoozes=snoozes+1, refires_at=? WHERE id=? AND status='scheduled' AND fires_at<=? AND (refires_at IS NULL OR refires_at<=?) AND snoozes<2`. `responses (reminder_id, kind, source, at)` gets a row (kind `Skip` or `Snooze`) only when that update wins. |
| `notifications.ts` | `setup()`: permission, the high-importance `reminders` channel, two categories, `reminder` (Start, Snooze, Skip) and `reminder-no-snooze` (Start, Skip), where Start opens the app and the others don't, and the foreground handler. `scheduleChains`: `ScheduleChain` cancels **scheduled** notifications only (presented ones stay) and schedules each Reminder with a `DATE` trigger, identifier = Reminder Id (a Snooze re-fire keeps it), the title from the intent, the category from the entry's `actions` (no `snooze` → `reminder-no-snooze`), `data: { reminderId }`, one Android group (`threadIdentifier`); at most 100 at once, one after another. `handler.ts` calls it **inside** the `write()` transaction, after the state is saved and before COMMIT, so the last chain committed is the last chain armed; a throw rolls the transaction back. `dismissNotifications` (`DismissNotification`) runs after the commit. `dismissStale` removes every presented Reminder except the outstanding one. |
| `handler.ts` | `handleAction(actionId, payload, source)`, the one handler both delivery paths call. Skip and Snooze take one path: dismiss the notification first, then in one `write()` load the state, accept only if `outstandingReminder(state, now)` is this Reminder (checked before `reduce`), `reduce` the Response (a reduce that returns its input state, e.g. a third Snooze, is a no-op), run the guarded update, log the Response, save the settled state and schedule the chain; after the commit, apply the dismissals. When the app is alive in the background both paths fire in one JS context and the guard makes the second a no-op. Start and a body tap just open the app. `rearmOnOpen()` runs `AppOpened` + `Rearm` (device time zone) the same way. Only adapters touch `Date.now` and `Math.random`. |
| `task.ts` | The background notification task (`TaskManager.defineTask` at module scope, `Notifications.registerTaskAsync`), loaded from `index.ts`. It reads the Reminder Id from `content.dataString` (a JSON string, what the task gets on the Pixel), falling back to `content.data`. |
| `useReminderRuntime.ts` | Mounted by the root layout: `setup()`, `rearmOnOpen()` on launch and whenever `AppState` becomes `active`, and the foreground response listener. |
| `useCoreState.ts`, `variant.ts` | Read-only helpers for screens: the stored state (re-read after each write and once a minute) and the app variant from `extra.appVariant`. |

### Exact alarms: the one switch

`EXACT_ALARM_PERMISSION` in `app.config.ts` is the only place the exact-alarm permission is chosen; `android.permissions` is built from it. It is `USE_EXACT_ALARM` (granted at install; fine for a sideloaded app). For a Play Store release, switch it to `SCHEDULE_EXACT_ALARM` and add a grant prompt. With either permission, expo-notifications 58 arms `DATE` triggers with `setExactAndAllowWhileIdle` (Doze-safe); it re-arms them after a reboot itself.

### Test mode (development build only)

`app/debug/test-mode.tsx`, linked from Today only when `APP_VARIANT` is `development` (`extra.appVariant`, read with `expo-constants`). On: Interval 2 min, Snooze delay 1 min, Active Hours 00:00–24:00 every day, then a Rearm, so a Reminder arrives within 2 minutes (a snoozed one is back within 1) through the real core path. With the window all day, Missed at closing and dropped can't be seen in test mode; Missed on replacement can. Off: `defaultSettings`. It writes settings straight into storage because the core has no settings event yet. Temporary: remove it once Settings can set the schedule.

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

The dev app's launcher icon has a plain amber background (the daily app keeps the light-blue grid), so the two are easy to tell apart. Each variant has its own package, so each has its own database.

The two packages differ, so both apps install side by side. Both set `android.allowBackup: true` and `runtimeVersion: { policy: "fingerprint" }`. Check a variant's resolved config with `APP_VARIANT=development npx expo config --type public`.

[`fingerprint.config.js`](fingerprint.config.js) keeps the default (balanced) fingerprint but skips every `package.json` script, so adding or editing a script doesn't change the runtime fingerprint or need a new EAS build.

The app is linked to the EAS project `@agmarco/activity-reminder`: `app.config.ts` sets `owner` and `extra.eas.projectId` (the owner ran `eas init`; a dynamic config can't be written by EAS, so the ID lives there). EAS commands run from `src/`, like everything else. Builds are **owner steps**: `eas build --profile development --platform android` and `eas build --profile preview --platform android` need the Expo account and are run by the owner, not by agents.
