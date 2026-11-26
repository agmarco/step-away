# Step Away

A small Android app with one job: **remind you to get up and move during the workday.**

Sitting at a desk for hours is easy to do without noticing. Step Away nudges you every so often while you work, suggests a quick exercise you can do right there (a stretch, a few squats, some shoulder rolls), and keeps a simple tally of the times you actually moved.

## What it does

- **Reminders on your schedule.** Pick your working days and hours, and how often (every 45 minutes by default). The timer restarts from when you answer, so a late break doesn't bring the next one sooner.
- **A quick exercise with each Reminder.** Two by default (one to three, your choice), chosen to fit what you can do: no floor work or equipment unless you say so. Tap **Start** for a guided card with photos and a timer, or answer straight from the notification.
- **Snooze, Pause or take the day off.** Meetings happen. None of these count against you.
- **A Daily Goal and a Streak.** See how many times you moved today, your week at a glance, a History calendar, and a few Badges along the way.
- **Private by design.** Everything stays on your phone: no account, no tracking, no ads.

## How it was made

Step Away is a personal project, built with [Claude Code](https://claude.com/claude-code), Anthropic's AI coding assistant. Its owner decided what the app should do and how it should feel, and Claude Code did the building. Every decision was first talked through and written down as a GitHub issue, then implemented in small, reviewed steps, with tests at every step and checks on a real phone. The [closed issues](https://github.com/agmarco/step-away/issues?q=is%3Aissue+is%3Aclosed) are the full story, starting with the [v1 spec](https://github.com/agmarco/step-away/issues/17).

It's built with Expo (React Native and TypeScript), Android-first.

## Install (Android)

There's no Play Store listing; the app is shared as an APK on this repo's [Releases](https://github.com/agmarco/step-away/releases).

**Recommended, with updates: [Obtainium](https://github.com/ImranR98/Obtainium).** Install Obtainium (from its Releases page or F-Droid), tap **Add App**, paste `https://github.com/agmarco/step-away`, and install. Obtainium tells you when a new APK is out.

**Or directly:** download the `.apk` from the [latest release](https://github.com/agmarco/step-away/releases/latest) on the phone and open it.

Either way, Android will ask you to allow installs from that app ("Install unknown apps"), and Play Protect may warn about an app from an unknown developer: both are normal outside the Play Store. Then:

- Go through the short setup and **allow notifications**: Reminders arrive as notifications.
- On Samsung, Xiaomi, OnePlus and similar phones, set the app's battery usage to **Unrestricted**, or Reminders may come late.
- Small fixes arrive by themselves: the app downloads them on one launch and uses them on the next. Bigger changes come as a new APK (Obtainium shows it).
- Everything stays on the phone: there's no account, sync or backup, so uninstalling or clearing the app's data erases its history.

## For developers

How the code is laid out, how to run it and how builds and updates work: [`docs/development.md`](docs/development.md), with the details in [`src/README.md`](src/README.md). The words the app uses (Reminder, Suggestion, Response, Streak…) are defined in [`CONTEXT.md`](CONTEXT.md).

## Licence

[MIT](LICENSE). The Exercise data and photos come from an open dataset released under The Unlicense (public domain); see [`src/library/source/SOURCE.md`](src/library/source/SOURCE.md).
