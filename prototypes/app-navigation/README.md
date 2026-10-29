# PROTOTYPE: app navigation + Today screen (throwaway)

Answers [Prototype app navigation and the Today screen](https://github.com/agmarco/activityReminder/issues/14). Verdict: **B4**. Copied into `main` as the reference for the Today screen; the full history lives on the `prototype/app-navigation` branch.

```
npm install && npx expo start   # scan with Expo Go on the Pixel (or press w for web)
```

- Floating bar (‹ ›): switch variant. **A** 4 bottom tabs, Today as a card stack. **B** Today is the hub, other screens pushed with back. **B1–B4** the hub with Settings reached via a labelled pill, a link card, tiles under the hero, or tiles + History panel (the pick). **C** 3 tabs + header gear, Today as an hour-by-hour timeline with a sticky status bar.
- Yellow panel: load a canned day (morning, mid-day, Reminder outstanding, Paused, Goal reached + new Badge, Day Off) or show the raw state.
- Tap a Today entry to correct it; Pause / Resume / Day Off work; "Start" stands in for the guided flow.
