# Research: scheduled-notification reliability per Android stack

Ticket: [#2](https://github.com/agmarco/activityReminder/issues/2). Researched 2026-10-28.

**Question.** Which Android stack can reliably fire user-configured, recurring **Reminders** (e.g. every 30–90 min within working hours) with Done / Skip / Snooze action buttons on Android 14–16? Candidates: Kotlin/Jetpack Compose, React Native/Expo, Flutter, plus a short look at PWA and Capacitor. This file gives facts for each stack. It does not pick one; that choice belongs to the next ticket.

Assumptions: the app runs on the user's own phone, is installed by sideloading or adb, stores data on the device only, and has no server. Google Play publishing is out of scope.

---

## 1. Platform facts (these apply to every stack)

Every native-capable stack below ends up calling the same `AlarmManager` APIs. The platform rules therefore set the limit on reliability, whichever stack is chosen.

### 1.1 Exact-alarm permissions

| | `SCHEDULE_EXACT_ALARM` | `USE_EXACT_ALARM` |
|---|---|---|
| Grant | The user grants it in Settings > Special app access > Alarms & reminders | "Granted automatically" on install |
| Revocable | Yes, by the user or the system | "Cannot be revoked by the user" |
| Default on Android 14+ | **Denied** for fresh installs of apps targeting API 33+ (also denied after backup/restore) | Granted |
| Play policy | Broader set of use cases | Restricted to apps whose core function is an alarm, timer or calendar. Play blocks non-qualifying apps at publish time |

Sources: [Schedule alarms](https://developer.android.com/develop/background-work/services/alarms/schedule), [Android 14 exact-alarm change](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms), [Play: Permissions and APIs that Access Sensitive Information](https://support.google.com/googleplay/android-developer/answer/16558241).

- `setExact()`, `setExactAndAllowWhileIdle()` and `setAlarmClock()` throw `SecurityException` unless the app holds one of these permissions. The exception is the `setExact` overload that takes an `OnAlarmListener`, which only works while the process is alive. ([Android 14 change](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms))
- If the user revokes `SCHEDULE_EXACT_ALARM`, "your app stops, and all future exact alarms are canceled." When it is granted again, the system sends `ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED`, and the app must reschedule its alarms. ([Schedule alarms](https://developer.android.com/develop/background-work/services/alarms/schedule))
- **Decisive for this project:** Play policy is the only thing that gates `USE_EXACT_ALARM`. In the OS it is a normal permission that is granted on install. A sideloaded personal app can therefore declare it and get exact alarms with no prompt and no risk of revocation. Holding `USE_EXACT_ALARM` also exempts the app from entering the *Restricted* standby bucket ([App Standby Buckets](https://developer.android.com/topic/performance/appstandby)). The cost is that the app can never be published to Play unchanged.

### 1.2 Alarm APIs and their timing

| API | Fires during Doze? | Timing |
|---|---|---|
| `set()`, `setInexactRepeating()`, `setAndAllowWhileIdle()` | Only the `AllowWhileIdle` variant | "Within one hour of the supplied trigger time" on Android 12+ |
| `setWindow()` | No | Inside the window you give it. The minimum window is **10 minutes**, and smaller values are clipped to 600000 ms |
| `setExact()` | No, deferred | Nearly exact |
| `setExactAndAllowWhileIdle()` | Yes | Nearly exact. "Once per nine minutes, per app" while idle |
| `setAlarmClock()` | Yes. It exits low-power modes | Exact. "The system never adjusts their delivery time." Shows an alarm icon in the status bar, and has a battery cost |

Sources: [Schedule alarms](https://developer.android.com/develop/background-work/services/alarms/schedule), [Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby).

- `setInexactRepeating()` accepts only the interval constants (`INTERVAL_FIFTEEN_MINUTES`, `INTERVAL_HOUR`, ...), not custom intervals. Every repeating alarm has been inexact since Android 4.4. ([Schedule alarms](https://developer.android.com/develop/background-work/services/alarms/schedule))
- **Decisive:** an inexact alarm can arrive up to an hour late, which defeats a 30–90 min cadence. The workable options are (a) exact `AllowWhileIdle` or `setAlarmClock` one-shot alarms, each one rescheduling the next, or (b) `setWindow` with a window of 10 minutes or more if some jitter is acceptable. The 9-minute while-idle limit does not matter at 30-minute-plus intervals.

### 1.3 WorkManager

- The minimum `PeriodicWorkRequest` interval is 15 minutes. The interval is "the minimum time between repetitions", and a run "could be delayed, or even skipped" because of constraints or system optimizations. ([Define work](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work))
- Work is stored in WorkManager's own SQLite database and survives reboots. ([Persistent work](https://developer.android.com/develop/background-work/background-tasks/persistent))
- WorkManager does not run during Doze, because "WorkManager uses JobScheduler internally" ([Doze](https://developer.android.com/training/monitoring-device-state/doze-standby)). Android's own guidance reserves AlarmManager for "precise alarms or notifications such as calendar events" ([Persistent work](https://developer.android.com/develop/background-work/background-tasks/persistent)).
- Since Android 16, the runtime quota for jobs applies even in the Active standby bucket ([Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-all)).
- WorkManager is the wrong primitive for firing Reminders at a time the user expects. It works well for housekeeping tasks.

### 1.4 Doze and App Standby

- Doze starts when the device is unplugged, stationary and has its screen off. It defers standard alarms and jobs until maintenance windows, which come "less frequently" over time. `setAndAllowWhileIdle`, `setExactAndAllowWhileIdle` and `setAlarmClock` still fire. ([Doze](https://developer.android.com/training/monitoring-device-state/doze-standby))
- Alarm limits per standby bucket: Active has no limit, Working set allows 10 per hour, Frequent 2 per hour, Rare 1 per hour, and Restricted **one alarm per day** ([Power management limits](https://developer.android.com/topic/performance/power/power-details)). A Reminder every 30 min needs about 2 per hour, so the app has to stay in Active or Working set.
- Tapping one of the app's notifications moves the app to Active. Swiping a notification away does not count as an interaction ([App Standby Buckets](https://developer.android.com/topic/performance/appstandby)). It is not documented whether tapping an action button counts as an interaction; this should be tested.
- Exempting the app from battery optimization (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) lifts network and wakelock limits, but "its regular AlarmManager alarms don't fire" during Doze. Only the while-idle and alarm-clock variants do. ([Doze](https://developer.android.com/training/monitoring-device-state/doze-standby))
- Testing: `adb shell dumpsys deviceidle force-idle` simulates Doze, and `adb shell am set-standby-bucket <pkg> rare` forces a bucket.

### 1.5 Force-stop and OEM battery killers

- Force-stop: on Android 15+, entering the stopped state cancels **all** of the app's pending intents, alarms included. `BOOT_COMPLETED` is delivered again once the user brings the app out of that state. ([Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-all)) Alarms never fire for force-stopped apps ([android_alarm_manager_plus FAQ](https://pub.dev/packages/android_alarm_manager_plus)).
- [dontkillmyapp.com](https://dontkillmyapp.com/) gives Huawei, Xiaomi, OnePlus and Samsung its worst score (5/5). AOSP, Pixel and Android One score 0.
- On Samsung, apps can be put to sleep or deep sleep after some days unused, and Adaptive Battery is "much more eager than in stock Android." Samsung "may re-add them later after a firmware update." The user's workarounds are to add the app to "Never sleeping apps", turn off battery optimization for it, and allow background usage. ([dontkillmyapp.com/samsung](https://dontkillmyapp.com/samsung))
- **Decisive:** what kind of phone the user has (Pixel or Samsung/Xiaomi) matters more than which stack is chosen. Every stack suffers from OEM killers in the same way, because they all end up in AlarmManager. The app should include a short onboarding step that links to the battery settings. The `alarmClock` mode is the most robust against OEM deferral (Expo's source comments say so explicitly; see §2.2).

### 1.6 Notifications and action buttons

- A notification can have up to **3 action buttons**, which fits Done / Skip / Snooze exactly. An action's `PendingIntent` can target a `BroadcastReceiver` that "performs a job in the background", so the app does not open. ([Create a notification](https://developer.android.com/develop/ui/views/notifications/build-notification))
- Android 13+ requires the `POST_NOTIFICATIONS` runtime permission. A channel must be created before any notification is posted. The user can change channel importance, and sound and vibration are fixed when the channel is created. ([Create a notification](https://developer.android.com/develop/ui/views/notifications/build-notification))
- A "Done" **Response** that records *which* Exercises were done needs either several buttons or a UI. With only 3 buttons, choosing which Exercises were done probably means opening the app, or a later screen in the app. This is a domain question to settle when grilling the design.

### 1.7 Reboot

- "By default, all alarms are canceled when a device shuts down." The app must declare `RECEIVE_BOOT_COMPLETED` and reschedule in a receiver. The broadcast only arrives if the user has launched the app at least once. ([Schedule alarms](https://developer.android.com/develop/background-work/services/alarms/schedule))
- The app must also reschedule on `MY_PACKAGE_REPLACED` (app update) and after the exact-alarm permission is granted again (§1.1).

---

## 2. Per-stack facts

### 2.1 Kotlin + Jetpack Compose (native)

- **Alarms:** direct access to every AlarmManager API in §1.2, plus `canScheduleExactAlarms()` and the permission-state broadcast.
- **Actions without opening the app:** `addAction` with `PendingIntent.getBroadcast` to a `BroadcastReceiver`, the pattern shown in the official docs (§1.6). For DB writes, the receiver can use `goAsync()` or hand the work to WorkManager.
- **Reboot:** you write a `BOOT_COMPLETED` receiver yourself, enabled when the first Reminder is scheduled (official sample in [Schedule alarms](https://developer.android.com/develop/background-work/services/alarms/schedule)).
- **Storage:** Room (Jetpack's SQLite layer). The DB is reachable from receivers and workers in the same process.
- **Moving parts:** one runtime and no bridge. Every API in Android's documentation applies directly. Android docs, samples and Stack Overflow answers are written for this stack.
- **Cost for a React developer:** you learn Kotlin, Gradle and Android Studio. Compose is a declarative UI model with the same idea as React: composable functions, state hoisting, and recomposition on state change. Builds run locally in Android Studio, and `Run` or `./gradlew installDebug` installs over adb.

### 2.2 React Native + Expo (`expo-notifications`)

- **Alarms:** in Expo's Android source, each trigger is scheduled for its next fire date only ([`ExpoSchedulingDelegate.kt`](https://github.com/expo/expo/blob/main/packages/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoSchedulingDelegate.kt)):
  - Without the exact permission it uses `setAndAllowWhileIdle`, which can be up to an hour late.
  - With `delivery: 'alarmClock'` it uses `setAlarmClock`.
  - Otherwise it uses `setExactAndAllowWhileIdle`, which is the `bestEffort` default.
  - A comment in that source says: "OEM battery policies defer setExactAndAllowWhileIdle() alarms by minutes on some devices but leave [setAlarmClock] alone."
  - The JS API is `getExactAlarmPermissionsAsync` / `requestExactAlarmPermissionsAsync`, and Expo's docs say `USE_EXACT_ALARM` also works. ([Expo Notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/))
- **Triggers:** TimeInterval (with `repeats`), Daily, Weekly, Monthly, Yearly and Date. Calendar triggers are iOS-only. No trigger expresses "every 45 min between 09:00 and 17:00 on weekdays", so the app would have to compute the individual Date triggers and keep them topped up. That is equally true of the other stacks. ([Expo Notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/))
- **Actions without opening the app:** categories are set with `setNotificationCategoryAsync`, and each action can set `opensAppToForeground: false`. On Android, an action tap runs a task registered with `registerTaskAsync` (headless JS through expo-task-manager) "when the app is backgrounded or terminated." ([Expo Notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/))
- **Reboot:** Expo adds `RECEIVE_BOOT_COMPLETED` automatically and uses it to restore scheduled notifications after a restart. ([Expo Notifications docs](https://docs.expo.dev/versions/latest/sdk/notifications/))
- **Doze:** Expo's docs warn that Android may not deliver notifications in Doze, so delivery is not guaranteed.
- **Storage:** `expo-sqlite`. Whether the headless task can open the same DB should be confirmed in a prototype.
- **Notifee is archived.** The `invertase/notifee` repo is archived, and its README says "Notifee is no longer actively maintained" and recommends migrating to expo-notifications or the community fork `react-native-notify-kit`. Its last release was 9.1.8 (2024-12). Notifee limited Android to 50 active timestamp triggers. ([notifee repo](https://github.com/invertase/notifee), [Notifee triggers](https://notifee.app/react-native/docs/triggers))
- **Cost for a React developer:** you keep React and TypeScript. Styling is not Tailwind CSS; NativeWind is an option. Local notifications work in Expo Go, but alarm and permission behavior should be tested in a development build. You can build an APK on EAS (`"buildType": "apk"`, then `eas build -p android --profile preview`, then `adb install`), or locally with `npx expo run:android`, which needs the Android SDK. ([EAS APK](https://docs.expo.dev/build-reference/apk/))
- **Risk:** the JS ↔ native bridge sits on the path from an action tap to a DB write, so problems are harder to debug than in native code.

### 2.3 Flutter (`flutter_local_notifications`, `android_alarm_manager_plus`)

- **flutter_local_notifications** is actively maintained (v22.3.3, released 2026-10-25). ([pub.dev](https://pub.dev/packages/flutter_local_notifications))
  - `AndroidScheduleMode` has five values: `alarmClock`, `exact`, `exactAllowWhileIdle`, `inexact` and `inexactAllowWhileIdle`. These map one-to-one onto §1.2. ([API docs](https://pub.dev/documentation/flutter_local_notifications/latest/flutter_local_notifications/AndroidScheduleMode.html))
  - `zonedSchedule` handles one-shot Reminders. `periodicallyShowWithDuration` handles custom intervals, and its schedule mode defaults to `exact`.
  - It supports both `SCHEDULE_EXACT_ALARM` (request it with `requestExactAlarmsPermission()`) and `USE_EXACT_ALARM`.
  - **Reboot:** you declare `ScheduledNotificationBootReceiver` (for BOOT_COMPLETED and MY_PACKAGE_REPLACED), and the plugin "can reschedule notifications upon a reboot."
  - **Actions without opening the app:** set `showsUserInterface: false`, and the tap goes to `onDidReceiveBackgroundNotificationResponse`. That handler runs "in a separate isolate", must be a top-level function annotated `@pragma('vm:entry-point')`, and has no Activity context.
  - Samsung reportedly limits an app to 500 scheduled alarms.
- **android_alarm_manager_plus** runs any Dart callback in a background isolate when an alarm fires. That suits rescheduling logic, such as "compute the next Reminder inside working hours." Its `periodic`/`oneShot` take `exact`, `wakeup`, `allowWhileIdle` and `rescheduleOnReboot` flags, and `rescheduleOnReboot` defaults to **false**. The plugin does **not** request `SCHEDULE_EXACT_ALARM` at runtime, so you need `permission_handler` or similar. Its toolchain floor is Flutter ≥3.12, Java 17, AGP ≥8.12.1. ([pub.dev](https://pub.dev/packages/android_alarm_manager_plus), [source](https://github.com/fluttercommunity/plus_plugins/blob/main/packages/android_alarm_manager_plus/lib/android_alarm_manager_plus.dart))
- **Storage:** `sqflite` or `drift`. A background isolate does not share memory with the UI isolate, so state has to go through the DB.
- **Cost for a React developer:** you learn Dart and the widget tree, which is declarative but has its own layout model and is not CSS. The tooling is the Flutter SDK plus the Android SDK. `flutter build apk` and `flutter install` build and install locally.

### 2.4 PWA and Capacitor (short)

- **PWA: not viable for local, time-based Reminders.**
  - Chrome's Notification Triggers API was abandoned: "The development of Notification Triggers API ... has ended." ([Chrome docs](https://developer.chrome.com/docs/web-platform/notification-triggers))
  - Periodic Background Sync needs an installed PWA. Chrome decides frequency from the site engagement score (it does not fire at all at score 0), and it requires a network connection. Its intervals are on the order of a day, not minutes. ([Chrome docs](https://developer.chrome.com/docs/capabilities/periodic-background-sync))
  - The only way left is server-sent Web Push, which contradicts the local-only constraint.
- **Capacitor (`@capacitor/local-notifications`): viable for scheduling, weak for actions.**
  - Schedule options are `at`, `every`, `on` and `allowWhileIdle`. It has `checkExactNotificationSetting` and `changeExactNotificationSetting`, and falls back to inexact alarms unless `isExactMandatory` is set. ([Capacitor docs](https://capacitorjs.com/docs/apis/local-notifications))
  - In its Android source ([`LocalNotificationManager.java`](https://github.com/ionic-team/capacitor-plugins/blob/main/local-notifications/android/src/main/java/com/capacitorjs/plugins/localnotifications/LocalNotificationManager.java)):
    - `every`/repeat uses `setRepeating(AlarmManager.RTC, ...)`, which is inexact and does not wake the device.
    - Action buttons use `PendingIntent.getActivity`, so **tapping Done/Skip/Snooze opens the app**. Silent background handling would need a custom native plugin.
  - The big advantage is that the React/Vite/Tailwind code would carry over as it is.

---

## 3. Sideloading and installing (all stacks)

- **Android developer verification:** from **2026-09-30**, installs from participating stores in Brazil, Indonesia, Singapore and Thailand need a verified developer, and Google plans to roll this out globally in 2027. A "limited distribution" account (up to 20 devices, no ID or fee) and an "advanced flow" for power users were launched in August 2026. ([Developer verification](https://developer.android.com/developer-verification))
- "Apps installed using ADB won't require verification ... there are no changes to how ADB works." ([Verification FAQ](https://developer.android.com/developer-verification/guides/faq)) Installing over adb is therefore safe for a personal app on any stack. If the user later wants to install over the air without a cable, they will probably need the limited-distribution account from 2027.

---

## 4. Summary matrix

| Concern | Kotlin/Compose | RN/Expo | Flutter | Capacitor | PWA |
|---|---|---|---|---|---|
| Exact / alarm-clock alarms | Full API | `bestEffort` (exact while idle) or `alarmClock` | All 5 modes | Exact one-shot; repeats are inexact | No |
| `USE_EXACT_ALARM` usable when sideloaded | Yes | Yes | Yes | Yes | n/a |
| Silent action handling (no app open) | BroadcastReceiver | Headless JS task | Background isolate | No (opens the app) | n/a |
| Reboot rescheduling | You write it | Built in | Built in (with manifest receiver) | Not documented | n/a |
| Local SQLite | Room | expo-sqlite | sqflite / drift | Community SQLite plugins | IndexedDB |
| Library health | Platform | Maintained (notifee archived) | Maintained | Maintained | Triggers API dead |
| Reuses React skills | Low (concepts only) | High (React, not CSS) | Low | Very high | Very high |

## 5. Facts likely to decide the choice

1. **Inexact alarms can be up to 1 h late** on Android 12+. Reminders need exact `AllowWhileIdle` or `alarmClock` alarms. A sideloaded app can declare `USE_EXACT_ALARM` and get them with no prompt and no revocation. Every native-capable stack exposes these alarms, but Capacitor's repeats do not use them.
2. **Silent Done/Skip/Snooze handling** is native in Kotlin, works through headless JS in Expo and through a background isolate in Flutter, and is missing from stock Capacitor. A PWA cannot do it at all.
3. **The phone's OEM** (Pixel or Samsung/Xiaomi) affects reliability more than the stack does. `alarmClock` mode combined with telling the user how to exempt the app is the main defence.
4. **Notifee is archived.** On React Native, `expo-notifications` is the maintained path.
5. **Standby-bucket limits:** a 30-minute cadence needs the app in Working set or better. User interaction with Reminders keeps it there, and `USE_EXACT_ALARM` keeps it out of Restricted.

## Open questions to test on the real device

- Does tapping a notification *action button* (as opposed to tapping the notification itself) count as an interaction that promotes the app to the Active bucket?
- Can Expo's headless task and Flutter's background isolate open the same SQLite DB as the UI without locking problems?
- Which phone model and One UI / OEM skin the user has, and how its battery settings behave.
