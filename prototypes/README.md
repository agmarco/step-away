# Prototypes

Throwaway code that answers one question. Each prototype is built in `prototypes/<name>/` on its own `prototype/<name>` branch and is **never merged**: `main` keeps only the validated decision, recorded on the ticket. Exception: `app-navigation` is also copied into `main` as the reference for the Today screen. `app-icon` has no branch: it was deleted unpushed, and #70 holds its record.

| Prototype | Question | Verdict |
|---|---|---|
| [response-flow](https://github.com/agmarco/activityReminder/tree/prototype/response-flow/prototypes/response-flow) | [How does the user respond to a Reminder?](https://github.com/agmarco/activityReminder/issues/9) | Guided one-by-one (variant C) |
| [app-navigation](app-navigation) | [How is the app navigated, and how is Today laid out?](https://github.com/agmarco/activityReminder/issues/14) | Today as hub, three tiles under the hero + History week panel (variant B4) |
| [background-responses](https://github.com/agmarco/activityReminder/tree/prototype/background-responses/prototypes/response-flow) | [Do background Responses hold on a development build?](https://github.com/agmarco/activityReminder/issues/12) | Yes: action taps count as app use; SQLite safe with guarded transitions + one connection |
| app-icon (deleted; artwork and verdict in [#70](https://github.com/agmarco/activityReminder/issues/70)) | [What should the app icon look like?](https://github.com/agmarco/activityReminder/issues/70) | Walker in the ring (variant H), dark with a lime goal ring |

To run one: `git switch prototype/<name> && cd prototypes/<name> && npm install && npx expo start`.
