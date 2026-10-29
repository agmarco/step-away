# Prototypes

Throwaway code that answers one question. Each prototype is built in `prototypes/<name>/` on its own `prototype/<name>` branch and is **never merged**: `main` keeps only the validated decision, recorded on the ticket.

| Prototype | Question | Verdict |
|---|---|---|
| [response-flow](https://github.com/agmarco/activityReminder/tree/prototype/response-flow/prototypes/response-flow) | [How does the user respond to a Reminder?](https://github.com/agmarco/activityReminder/issues/9) | Guided one-by-one (variant C) |

To run one: `git switch prototype/<name> && cd prototypes/<name> && npm install && npx expo start`.
