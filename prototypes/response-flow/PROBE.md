# Background Responses probe

Throwaway, for [Verify background Responses on a development build](https://github.com/agmarco/activityReminder/issues/12). Branch `prototype/background-responses`; never merged.

`index.ts` runs `probe/Probe.tsx` instead of the Response flow. Snooze and Skip are handled by one function (`probe/notify.ts`), which both the background notification task (`probe/task.ts`) and the foreground listener call. Each call goes through a guarded state transition in SQLite (`probe/db.ts`). Every call is logged in `attempts`, a Response is written only by the call that wins, and `task_calls` keeps the raw payload the background task received.

The green/red banner shows **duplicates · lost · write errors**. All three must stay 0.

## Setup (once)

```sh
cd prototypes/response-flow
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # say yes to creating the project and keystore
brew install android-platform-tools
```

1. Install the APK on the Pixel from the build link or QR code.
2. On the Mac, run `npx expo start --dev-client`.
3. Open **Probe (dev)** and allow notifications.
4. Pair adb. On the Pixel, open Developer options › Wireless debugging › Pair with code, then on the Mac run `adb pair <ip:port> <code>` and `adb connect <ip:port>`.

Package: `com.agmarco.activityreminder.probe`.

## Tests

**A. Action buttons register (app in background).**
1. Tap **Reset**, then **Fire 1 in 5 s**, then press Home.
2. Tap **Snooze** on the notification. It should come back after 10 s as "snoozed 1×".
3. Tap **Skip**. A new Reminder should appear after 20 s.
4. Open the app. Note which `source` wrote each attempt (`bg-task` / `fg-listener`), and check that `taskCalls` holds a payload.

**B. App killed.**
1. **Fire 1 in 5 s**, then swipe the app away in Recents. Don't use Force stop: that blocks alarms entirely.
2. Tap **Skip** on the notification.
3. Reopen the app. The Skip should be recorded by `bg-task` with a different context id from the one in the title bar. Keep the dev server running, because the headless task loads JS from it.

**C. Standby bucket.** Bucket numbers: 10 active · 20 working_set · 30 frequent · 40 rare · 45 restricted.
1. **Fire 1 in 5 s**, press Home, then run:
   ```sh
   adb shell am set-standby-bucket com.agmarco.activityreminder.probe rare
   adb shell am get-standby-bucket com.agmarco.activityreminder.probe    # expect 40
   ```
2. Tap **Skip** on the notification without opening the app. Then run:
   ```sh
   adb shell am get-standby-bucket com.agmarco.activityreminder.probe
   ```
3. Repeat with **Snooze**.
4. Control run: set the bucket to rare again, then open the app with a plain tap on its icon, and read the bucket.

**D. Concurrent writes.**
1. **Reset**, turn **Hammer DB** on, then **Fire 5 in 5 s**.
2. Pull down the shade and tap Snooze or Skip on all five as fast as you can.
3. Repeat with the app sent Home while hammering.
4. Repeat once more: kill the app, tap an action, and reopen the app immediately.
5. After each run, the banner must read duplicates 0 · lost 0 · write errors 0.

## Report back

For each test, send a screenshot of the probe screen (or the JSON scrolled into view) and the bucket numbers from test C.
