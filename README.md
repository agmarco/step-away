# Activity Reminder

A personal Android app that nudges a desk worker to move on a configurable schedule and suggests quick Exercises to do at the desk. Built with Expo (React Native / TypeScript), Android-first.

The v1 spec is being charted as a wayfinder map: [Map: Activity Reminder v1 spec](https://github.com/agmarco/activityReminder/issues/1). Decisions live on its tickets; the map indexes them.

## Layout

| Path | What lives there |
|---|---|
| [`CONTEXT.md`](CONTEXT.md) | Domain glossary: Reminder, Suggestion, Exercise, Response… Use these terms everywhere. |
| [`docs/`](docs/) | Index of decisions, research and ADRs. |
| [`prototypes/`](prototypes/) | Index of throwaway prototypes. The code itself lives on `prototype/<name>` branches. |
| [`src/`](src/) | The app: the Expo project (`package.json`, app/EAS config, tooling) and all code. |

## Development

All code and its config live in [`src/`](src/), which is the Expo project root. Run every command from there:

```sh
cd src
```

Then see [`src/README.md`](src/README.md) for setup, commands, lint rules, app variants and EAS builds.
