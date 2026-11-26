# Development

How the code is organised, and how to run and change it. For what the app is, see the [README](../README.md).

## Repository layout

| Path | What lives there |
|---|---|
| [`CONTEXT.md`](../CONTEXT.md) | Domain glossary: Reminder, Suggestion, Exercise, Response… Use these terms everywhere. |
| [`docs/`](./) | Index of decisions, research and ADRs. |
| [`prototypes/`](../prototypes/) | Index of throwaway prototypes. The code itself lives on `prototype/<name>` branches. |
| [`src/`](../src/) | The app: the Expo project (`package.json`, app/EAS config, tooling) and all code. |

## Working on the app

All code and its config live in [`src/`](../src/), which is the Expo project root. Run every command from there. [`src/README.md`](../src/README.md) has the details: commands, lint rules, app variants and EAS builds.

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

**When you need a new build.** Only for native changes: a new native module, a permission, or `app.config.ts` values that affect the binary. Everything else (screens, the core, the Exercise Library) reaches the dev app through the dev server. The preview app gets them through **EAS Update** (`eas update --channel preview --environment preview`, an owner step): it downloads the update on one launch and runs it on the next. See the update rules in [`src/README.md`](../src/README.md). A build takes about 30 minutes on the free tier, so batch native changes. To build, run `eas build --profile development --platform android` (or `--profile preview`) from `src/`. Builds are owner steps.

**Test mode.** In the dev app, open Today → Test mode (debug). It sets a 2-minute Interval, all day, so you can check Reminders without waiting. Turn it off afterwards.

**Looking inside the app on the phone (optional).** Install `adb` with `brew install --cask android-platform-tools`. On the Pixel, open Developer options → Wireless debugging → Pair device with pairing code, then run:

```sh
adb pair <ip>:<pairing port>    # enter the 6-digit code
adb connect <ip>:<port>         # the port on the main Wireless debugging screen, not the pairing one
adb exec-out run-as com.agmarco.activityreminder.dev cat files/SQLite/activity-reminder.db > ar.db   # also copy the -wal file
adb logcat ReactNativeJS:V '*:S'    # the app's console output
```

If adb says "more than one device", the phone is listed twice. Run `adb disconnect <ip>:<port>` on one of the two entries.
