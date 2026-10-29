# Prototypes

Throwaway code that answers one question. Each prototype is built in `prototypes/<name>/` on its own `prototype/<name>` branch and is **never merged**: `main` keeps only the validated decision, recorded on the ticket.

| Prototype | Question | Verdict |
|---|---|---|
| [response-flow](https://github.com/agmarco/activityReminder/tree/prototype/response-flow/prototypes/response-flow) | [How does the user respond to a Reminder?](https://github.com/agmarco/activityReminder/issues/9) | Guided one-by-one (variant C) |
| [background-responses](https://github.com/agmarco/activityReminder/tree/prototype/background-responses/prototypes/response-flow) | [Do background Responses hold on a development build?](https://github.com/agmarco/activityReminder/issues/12) | Yes: action taps count as app use; SQLite safe with guarded transitions + one connection |

To run one: `git switch prototype/<name> && cd prototypes/<name> && npm install && npx expo start`.
