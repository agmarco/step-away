# PROTOTYPE: app navigation + Today screen (throwaway)

Answers [Prototype app navigation and the Today screen](https://github.com/agmarco/activityReminder/issues/14). Never merged.

```
npm install && npx expo start   # scan with Expo Go on the Pixel (or press w for web)
```

- Floating bar (‹ ›): switch variant. **A** 4 bottom tabs, Today as a card stack. **B** Today is the hub, other screens pushed with back. **C** 3 tabs + header gear, Today as an hour-by-hour timeline with a sticky status bar.
- Yellow panel: load a canned day (morning, mid-day, Reminder outstanding, Paused, Goal reached + new Badge, Day Off) or show the raw state.
- Tap a Today entry to correct it; Pause / Resume / Day Off work; "Start" stands in for the guided flow.
