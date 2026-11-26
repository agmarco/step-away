# Step Away

An Android app that nudges you to get up from your desk and move, on a schedule you set, and suggests a quick Exercise to do right there. It counts the Reminders you act on toward a Daily Goal and a Streak. Built with Expo (React Native / TypeScript), Android-first. It was called Activity Reminder until v1.0.0-rc.1.

## Install (Android)

There's no Play Store listing; the app is shared as an APK on this repo's [Releases](https://github.com/agmarco/step-away/releases).

**Recommended, with updates: [Obtainium](https://github.com/ImranR98/Obtainium).** Install Obtainium (from its Releases page or F-Droid), tap **Add App**, paste `https://github.com/agmarco/step-away`, and install. Obtainium tells you when a new APK is out.

**Or directly:** download the `.apk` from the [latest release](https://github.com/agmarco/step-away/releases/latest) on the phone and open it.

Either way, Android will ask you to allow installs from that app ("Install unknown apps"), and Play Protect may warn about an app from an unknown developer: both are normal outside the Play Store. Then:

- Go through the short setup and **allow notifications**: Reminders arrive as notifications.
- On Samsung, Xiaomi, OnePlus and similar phones, set the app's battery usage to **Unrestricted**, or Reminders may come late.
- Small fixes arrive by themselves: the app downloads them on one launch and uses them on the next. Bigger changes come as a new APK (Obtainium shows it).
- Everything stays on the phone: there's no account, sync or backup, so uninstalling or clearing the app's data erases its history.

## Project

v1 was planned as a wayfinder map ([#1](https://github.com/agmarco/step-away/issues/1), spec [#17](https://github.com/agmarco/step-away/issues/17)); every decision lives on its closed ticket, and the map indexes them.

## Layout

| Path | What lives there |
|---|---|
| [`CONTEXT.md`](CONTEXT.md) | Domain glossary: Reminder, Suggestion, Exercise, Response… Use these terms everywhere. |
| [`docs/`](docs/) | Index of decisions, research and ADRs. |
| [`prototypes/`](prototypes/) | Index of throwaway prototypes. The code itself lives on `prototype/<name>` branches. |
| [`src/`](src/) | The app: the Expo project (`package.json`, app/EAS config, tooling) and all code. |

## Development

All code and its config live in [`src/`](src/), which is the Expo project root. Run every command from there. [`src/README.md`](src/README.md) has the details: commands, lint rules, app variants and EAS builds.

### How the dev setup works

You need only Node and npm on the Mac. There's no Android SDK and no local native build: native code is compiled in the cloud by **EAS Build**, and the Mac only serves JavaScript.

| Piece | What it is |
|---|---|
| **Step Away (dev)** (amber icon) | A development build: a native shell with no app code of its own. It loads the JavaScript from your Mac's dev server. |
| **Step Away** | The standalone `preview` build for daily use. Its code is built in, so it needs no Mac. |
| Dev server (Metro) | Bundles `src/` and serves it to the dev app over Wi-Fi. Changes appear on the phone in about a second. |

**Daily loop**

```sh
cd src
npm ci                                   # once, and after pulling dependency changes
APP_VARIANT=development npx expo start   # then open the dev app on the phone and pick this server
npm test && npm run typecheck && npm run lint
```

Start the server with `APP_VARIANT=development`. Without it, the server resolves the `preview` config and the dev-only Test mode stays hidden. If the phone can't reach the Mac on the same Wi-Fi, add `--tunnel`.

**When you need a new build.** Only for native changes: a new native module, a permission, or `app.config.ts` values that affect the binary. Everything else (screens, the core, the Exercise Library) reaches the dev app through the dev server. The preview app is planned to get these changes through EAS Update, which isn't set up yet, so for now the preview app only changes when it's rebuilt. A build takes about 30 minutes on the free tier, so batch native changes. To build, run `eas build --profile development --platform android` (or `--profile preview`) from `src/`. Builds are owner steps.

**Test mode.** In the dev app, open Today → Test mode (debug). It sets a 2-minute Interval, all day, so you can check Reminders without waiting. Turn it off afterwards.

**Looking inside the app on the phone (optional).** Install `adb` with `brew install --cask android-platform-tools`. On the Pixel, open Developer options → Wireless debugging → Pair device with pairing code, then run:

```sh
adb pair <ip>:<pairing port>    # enter the 6-digit code
adb connect <ip>:<port>         # the port on the main Wireless debugging screen, not the pairing one
adb exec-out run-as com.agmarco.activityreminder.dev cat files/SQLite/activity-reminder.db > ar.db   # also copy the -wal file
adb logcat ReactNativeJS:V '*:S'    # the app's console output
```

If adb says "more than one device", the phone is listed twice. Run `adb disconnect <ip>:<port>` on one of the two entries.

## Licence

[MIT](LICENSE). The Exercise data and photos come from an open dataset released under The Unlicense (public domain); see [`src/library/source/SOURCE.md`](src/library/source/SOURCE.md).
