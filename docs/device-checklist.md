# Device checklist: the `preview` build

The run sheet for [#32 Reliability and delivery hardening](https://github.com/agmarco/activityReminder/issues/32), on the standalone **`preview`** build (Activity Reminder, `com.agmarco.activityreminder`) on the Pixel. It also carries the launcher checks batched from [#45](https://github.com/agmarco/activityReminder/issues/45), and the tap-lag re-time that [#39](https://github.com/agmarco/activityReminder/issues/39) asks for. Modelled on the background-responses probe's `PROBE.md` (branch `prototype/background-responses`).

Every check below has steps, what to record, and a pass criterion. Fill the **Result** lines and the table at the end; paste the logcat lines asked for. All commands run on the Mac; `eas` commands run from `src/` and need the Expo account (owner steps).

## Why these checks are on the phone

There is no JS code for re-arming: `expo-notifications` reschedules its stored Reminder chain (7 days ahead) natively on `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` and `MY_PACKAGE_REPLACED`. Opening the app also re-arms (`rearmOnOpen`). So in checks **D** and **E** the app must **not be opened** between the event and reading the alarms, otherwise the app's own re-arm hides whether the native one worked.

## Setup (once)

1. Build and install (owner):
   ```sh
   cd src
   npx eas-cli@latest build --profile preview --platform android
   ```
   The profile sets `APP_VARIANT=preview` and channel `preview`. Download the APK from the build page (or its QR code) to the Mac, e.g. `~/Downloads/activity-reminder-preview.apk`, then:
   ```sh
   adb install ~/Downloads/activity-reminder-preview.apk
   ```
   Keep this APK: check E installs it again over itself.
2. Record the build's **fingerprint** (the runtime version, shown on the EAS build page). It is recorded once for #32 and #45 (#45's shortcuts are a native change, so they need this build). The local value at CP1 is `ef522b8e9e08063e49547f1e368d953422adac36`; check it from `src/` with
   ```sh
   APP_VARIANT=preview npx expo-updates fingerprint:generate --platform android | node -p 'JSON.parse(require("fs").readFileSync(0)).hash'
   ```
   **Result:** EAS build fingerprint `________________`, same as the local one: yes / no
3. Open **Activity Reminder** (not "(dev)") and go through onboarding; **Allow notifications** on the Permissions step.
4. Settings: Active Hours covering the whole test session (today on, e.g. 00:00–24:00 or a window spanning it), **Interval 15 min** (the shortest outside the dev build's Test mode), **Snooze delay 5 min**, Appearance **System**.
5. Keep the dev app quiet so its Reminders don't mix in: in **Activity Reminder (dev)**, take today off (or Pause for the rest of today).
6. Allow **Activity Reminder** in any launcher or app that filters notifications (e.g. the notification filter of the `com.beforesoft.launcher` launcher). Symptom when it isn't allowed: the Reminder is posted and removed within a second, and the app logs nothing about it.
7. adb over Wi-Fi: Developer options › Wireless debugging › Pair with code, then `adb pair <ip:port> <code>` and `adb connect <ip:port>`. After a reboot (check D) wireless debugging needs reconnecting; a USB cable avoids that.
8. Leave a log running for the whole session (Metro isn't connected to this build, so `console.log` goes to logcat):
   ```sh
   adb logcat -c
   adb logcat -v time ReactNativeJS:V TaskService:V ActivityManager:I dev.expo.updates:V '*:S' | tee ~/Desktop/preview-run.log
   ```
   The handler logs one line per Response: `[handler] Skip <reminderId> from bg-task: accepted as Skip`, or `… : no-op` for a repeat it refused.

Useful commands:

```sh
adb shell pidof com.agmarco.activityreminder                                   # empty = the process is not running
adb shell dumpsys alarm | grep -A3 "com.agmarco.activityreminder}" | grep -c origWhen=   # the app's alarms (0 = nothing armed; the } leaves out the .dev app)
adb shell dumpsys alarm | grep -A3 "com.agmarco.activityreminder}" | grep -m1 -o 'origWhen=[0-9-]* [0-9:.]*'   # the first alarm's time
adb shell dumpsys notification --noredact | grep -A2 "pkg=com.agmarco.activityreminder " | head
grep -i "database is locked" ~/Desktop/preview-run.log                        # must print nothing
```

## Checks

### A. Shade taps, recorded once (app killed / in the background / in front)

For each app state, wait for a Reminder (Snooze one to get the next back in 5 min), then tap **Skip** or **Snooze** in the shade **once**.

1. **Killed.** Open the app, then swipe it away in Recents (not Force stop: that cancels alarms). Confirm `adb shell pidof com.agmarco.activityreminder` prints nothing. When the Reminder arrives, tap **Skip**. Don't open the app for a minute.
2. **In the background.** Open the app, press Home. When the Reminder arrives, tap **Snooze**.
3. **In front.** Keep Today open. When the Reminder arrives (heads-up banner), pull down the shade and tap **Skip**.

After each tap, open Today and check the Reminder's line.

Record per state: the `[handler]` lines for that Reminder (source `bg-task` / `fg-listener`), and Today's line and tally.

Pass: for each tap exactly **one** `accepted as …` line; any other line for the same tap says `no-op`. Today shows the Reminder once with that outcome and the tally counts it once. The notification goes away at once. `grep -i "database is locked"` prints nothing.

**Result:** killed ____ · background ____ · in front ____ · `database is locked`: none / found

### B. Cold-start action-tap lag (re-time for #39)

Same as A.1 (app killed, `pidof` empty), tap **Skip**. From the log, note:

- the tap: `ActivityManager: Start proc … com.agmarco.activityreminder` (the process start the tap causes);
- `TaskService: Started headless task`;
- `[handler] Skip <reminderId> from bg-task: accepted as Skip` (the commit).

Repeat with the process warm (app in the background, A.2) for comparison. #39 measured ~8 s from headless task start to commit on the dev build with a warm process.

Record: the three timestamps and the two differences, cold and warm. Post them on #39 as well.

Pass: recorded (no fixed threshold; #39 decides what's acceptable).

**Result:** cold: start proc → task ____ s, task → commit ____ s · warm: task → commit ____ s

### C. Doze-time delivery

1. Note Today's "Next Reminder HH:MM" (pick one at least 5 min away).
2. Turn the screen off, then force Doze:
   ```sh
   adb shell dumpsys battery unplug
   adb shell dumpsys deviceidle force-idle
   adb shell dumpsys deviceidle get deep        # expect IDLE
   ```
3. Leave the phone alone until past the Reminder's time; note when it arrives (the shade's time, and `ReactNativeJS`/notification log lines if any).
4. Undo:
   ```sh
   adb shell dumpsys deviceidle unforce
   adb shell dumpsys battery reset
   ```

Record: scheduled time, arrival time, the `deviceidle get deep` output.

Pass: the Reminder arrives within a minute of its time while the device is IDLE (exact alarms use `setExactAndAllowWhileIdle`).

**Result:** scheduled ____ · arrived ____ · deep state ____

### D. Re-arm after reboot

1. Note the app's alarm count and its first (earliest) alarm's time (Useful commands above):
   ```sh
   adb shell dumpsys alarm | grep -A3 "com.agmarco.activityreminder}" | grep -c origWhen=
   adb shell dumpsys alarm | grep -A3 "com.agmarco.activityreminder}" | grep -m1 -o 'origWhen=[0-9-]* [0-9:.]*'
   ```
2. `adb reboot`. Unlock the phone once (boot broadcasts arrive after the first unlock). **Don't open the app.**
3. Reconnect adb, restart the logcat from Setup step 8, and read the alarm count and first alarm time again.

Record: alarm count and first alarm time, before / after the reboot.

Pass: judged from `dumpsys alarm`, without opening the app (no need to wait for a Reminder): the app's alarms are back after the reboot, the same count, the first one at the same time. A reboot clears every alarm, so this is the proof that the native re-arm works.

**Result:** alarms before ____ / after ____ · first alarm before ____ / after ____

### E. Alarms after installing over the old build (`MY_PACKAGE_REPLACED`)

1. Note the app's alarm count and first alarm time (as in D).
2. Install the APK over itself (or a newer `preview` APK over this one), keeping the data:
   ```sh
   adb install -r ~/Downloads/activity-reminder-preview.apk
   ```
   **Don't open the app.**
3. Read the alarm count and first alarm time again.

Record: alarm count and first alarm time, before / after; then open the app and check Today's history is intact.

Pass: judged from `dumpsys alarm`, without opening the app: the app's alarms are still there, the same count, the first one at the same time; the data (Today's lines, Settings) survives. Android doesn't cancel an app's alarms when the package is updated, so this check shows the alarms **survive** an install over the old build; it doesn't prove `MY_PACKAGE_REPLACED` re-arms them. D is the re-arm proof.

**Result:** alarms before ____ / after ____ · first alarm before ____ / after ____ · data kept: yes / no

### F. EAS Update: check on launch, apply on next launch, wrong runtime ignored

How the `preview` build checks for and applies updates, and the runtime guard, are in [`src/README.md` › EAS Update and when to rebuild](../src/README.md#eas-update-and-when-to-rebuild): an update downloads at one launch and runs from the **next**, and only on a build with the same runtime version (the fingerprint).

Use a visible marker: a throwaway, uncommitted edit to the Settings Version row in `src/app/settings.tsx` (`value={…}` on the `Version` row), e.g. append `" · update A"`.

1. **Wrong runtime (ignored).** Marker `" · update B (wrong runtime)"`. Also make a throwaway native change so the fingerprint differs, e.g. add `'VIBRATE'` to `android.permissions` in `src/app.config.ts`. Publish (owner):
   ```sh
   cd src
   APP_VARIANT=preview npx eas-cli@latest update --channel preview --environment preview --message "checklist F: wrong runtime"
   ```
   Close and reopen the app twice. Settings › Version must **not** show the B marker. Revert both edits (`git checkout -- app/settings.tsx app.config.ts`).
2. **Matching runtime (applied).** Marker `" · update A"` only, no native change; `npx expo-updates fingerprint:generate` (Setup step 2) must print the build's fingerprint. Publish:
   ```sh
   APP_VARIANT=preview npx eas-cli@latest update --channel preview --environment preview --message "checklist F: update A"
   ```
   Open the app: Settings › Version still shows the plain version (the check runs, the update downloads). Wait ~30 s, swipe the app away, open it again: Version shows `1.0.0 · update A`.
3. Revert the marker and publish the committed JS again, so the phone runs `main`:
   ```sh
   git checkout -- app/settings.tsx
   APP_VARIANT=preview npx eas-cli@latest update --channel preview --environment preview --message "checklist F: back to main"
   ```
   Two launches later the marker is gone.

`--environment preview` is required: without it, `eas update` stops with "The `--environment` flag must be set when running in `--non-interactive` mode". `npx eas-cli@latest update:list --branch preview` shows each update's runtime version.

Record: the runtime version of each update (B differs from the build's, A matches), what Version showed on each launch, the `dev.expo.updates` log lines.

Pass: B never shows; A shows on the second launch, not the first; the final publish removes the marker.

**Result:** B ignored: yes / no · A on launch 1 ____ / launch 2 ____ · back to main: yes / no

### G. Light/dark while the app is open

Settings › Appearance **System**. With Today open, switch the system theme:

```sh
adb shell cmd uimode night yes
adb shell cmd uimode night no
```

(or the Quick Settings Dark theme tile). Repeat on Settings.

Record: does each screen re-theme at once (background, text, status bar)? On the dev build, after a JS reload, the app stayed dark until restarted (2026-11-08).

Pass: both directions re-theme without a restart.

**Result:** Today ____ · Settings ____

### H. Launcher shortcuts (#45)

1. Long-press the Activity Reminder icon.
   Pass: three shortcuts, **Pause 1 h**, **Pause 2 h**, **Pause today** (long labels "Pause for 1 hour", "Pause for 2 hours", "Pause for the rest of today").
2. **Warm.** With the app in the background, tap each shortcut in turn; tap **Resume** on Today between them.
   Pass: each opens Today showing "Paused until HH:MM" (1 h / 2 h from now), or "Paused for the rest of today"; log `[handler] Pause …: accepted`.
3. **Cold start.** Swipe the app away, check `adb shell pidof com.agmarco.activityreminder` is empty, then tap **Pause 1 h**. (The dev client couldn't show this: its launcher screen drops a cold deep link.) Same pass as step 2. Equivalent by adb, with the shortcut's own intent flags (`0x1000c000` = `NEW_TASK | CLEAR_TASK | TASK_ON_HOME`; `adb shell dumpsys shortcut` shows them on the real shortcuts):
   ```sh
   adb shell am start -f 0x1000c000 -a android.intent.action.VIEW -d "activityreminder://pause/hour" -n com.agmarco.activityreminder/.MainActivity
   ```
   Without the flags, a task left in Recents swallows the link: `am start` only brings the old task to the front.
4. **No Reminder during the Pause.** Take **Pause 1 h** (shortcut) while a Reminder is due inside that hour; note the hero time. Leave the Pause running.
   Pass: no Reminder notification until the Pause ends; the Reminder that was waiting shows "Ended by Pause"; Reminders resume one Interval after the Pause ends. Then Resume or let it run out.

**Result:** shortcuts shown ____ · warm 1 h / 2 h / today ____ · cold ____ · none during the Pause: yes / no

## Report back

| Check | Pass / fail | Notes |
|---|---|---|
| Setup: fingerprint recorded | | |
| A. Taps recorded once (killed / background / front), no `database is locked` | | |
| B. Cold-start tap lag (#39) | | |
| C. Doze delivery | | |
| D. Re-arm after reboot | | |
| E. Alarms after installing over the old build (`MY_PACKAGE_REPLACED`) | | |
| F. EAS Update (check on launch, apply next launch, wrong runtime ignored) | | |
| G. Light/dark without restart | | |
| H. #45 shortcuts: shown, warm, cold, no Reminder during the Pause | | |

Attach `~/Desktop/preview-run.log` (or the lines quoted above) to #32.
