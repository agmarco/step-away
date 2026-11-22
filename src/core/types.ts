/**
 * Domain-core types. Pure TypeScript: nothing here may import React, React
 * Native or Expo (enforced by ESLint on src/core/**: no-restricted-imports for
 * static imports, no-restricted-syntax for require() and dynamic import()).
 *
 * These are a skeleton. Later tickets grow each union with the events and
 * intents described in the v1 spec (#17, Modules -> Domain core).
 */

import type { BodyArea, Difficulty, Dose, Equipment, Exercise } from './exercise';
import type { LocalDate } from './localTime';

/** Epoch milliseconds. */
export type Instant = number;

/** The final outcome of a Reminder in the Activity Log. */
export type Outcome = 'Done' | 'Skip' | 'Missed';

/** Minutes after local midnight (0-1439), in the Settings' time zone. */
export type Minutes = number;

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** One day's Active Hours window, [start, end): nothing fires at or after `end`. */
export interface ActiveWindow {
  start: Minutes;
  end: Minutes;
}

/**
 * How a Suggestion's Body Areas are chosen across Suggestions: Weighted
 * favours (3:1) the areas with no Done Exercise on the Reminder's day; Random
 * weighs every area alike; Strict walks `BODY_AREAS` in order, advancing on
 * every Suggestion whatever the Response.
 */
export type BodyAreaMode = 'Weighted' | 'Random' | 'Strict';

/**
 * The app's colour scheme: follow the system, or force Light or Dark. Named
 * `AppearanceSetting` so screens can still import React Native's `Appearance`.
 */
export type AppearanceSetting = 'System' | 'Light' | 'Dark';

export interface Settings {
  /** `null` means no Active Hours that day. */
  activeHours: Record<Weekday, ActiveWindow | null>;
  intervalMinutes: number;
  /**
   * IANA time zone the Active Hours are read in (e.g. `Europe/Madrid`). The
   * core resolves local wall-clock times with Intl in this zone, never with the
   * machine's zone. The adapter sets it from the device.
   */
  timeZone: string;
  /** The Snooze delay: a Snooze re-fires the same Reminder this many minutes later. */
  snoozeMinutes: number;
  /**
   * How many Exercises a Suggestion has, 1-3, each from a different Body Area
   * where the pool allows. The real setting (#24); fewer only when the pool
   * runs short.
   */
  exercisesPerSuggestion: number;
  /** How a Suggestion's Body Areas are chosen across Suggestions. */
  bodyAreaMode: BodyAreaMode;
  /** The Difficulty ceiling: only Exercises at or below it (Beginner < Intermediate < Expert) are suggested. */
  difficulty: Difficulty;
  /** Whether Energetic Exercises are suggested. */
  energetic: boolean;
  /** Whether Floor Exercises (Position Floor) are suggested. */
  floor: boolean;
  /** The Equipment owned: an Exercise needing other Equipment is never suggested. */
  equipment: Equipment[];
  /** The Excluded Exercises, by Exercise Id: never suggested. */
  excluded: string[];
  /** The app's colour scheme. */
  appearance: AppearanceSetting;
}

/** A change on the Settings page: any subset of the settings but the time zone. */
export type SettingsChange = Partial<Omit<Settings, 'timeZone'>>;

/** One Exercise of a Suggestion: a text snapshot, not a link to the library entry. */
export interface SuggestedExercise {
  id: string;
  name: string;
  dose: Dose;
  cue: string;
  bodyArea: BodyArea;
}

/** One Exercise the user did in a Done Response: a text snapshot copied from the Suggestion. */
export type DoneExercise = Pick<SuggestedExercise, 'id' | 'name' | 'bodyArea'>;

/** What dropped a Reminder: see `Reminder.droppedBy`. */
export type DropReason = 'closing' | 'pause' | 'dayOff';

/**
 * A Reminder of the current chain. One whose `firesAt <= now` and status is
 * still `scheduled` has fired; only the latest fired one is outstanding.
 *
 * Statuses: `scheduled` (ahead, or fired with no final Response yet), `done`
 * (a Done Response), `skipped` (a Skip Response), `missed` (no Response
 * before a later Reminder fired, or before its day's Active Hours ended) and
 * `dropped` (a pending Snooze re-fire that would land at or after its day's
 * window end, or the outstanding Reminder when a Pause starts or today is
 * taken off). Dropped is never counted; `droppedBy` records which of the
 * three dropped it.
 */
export interface Reminder {
  /** Deterministic from `firesAt`. A Snooze re-fire keeps it. */
  id: string;
  firesAt: Instant;
  suggestion: SuggestedExercise[];
  status: 'scheduled' | 'done' | 'skipped' | 'missed' | 'dropped';
  /** How many times it was snoozed (at most 2). Absent means 0. */
  snoozes?: number;
  /**
   * The pending or latest Snooze re-fire. Absent if never snoozed, or if a
   * Done or Skip, or opening the guided screen (GuidedStarted), cancelled it.
   */
  refiresAt?: Instant;
  /** The Exercises done, in Suggestion order. Present only when `status` is `done`. */
  done?: DoneExercise[];
  /**
   * What dropped it: a Snooze re-fire past closing, a Pause, or taking today
   * off. Set when it is dropped and never changed after; present only when
   * `status` is `dropped` (a Correct removes it). Absent on a dropped one
   * means `closing` (dropped before the reason was stored).
   */
  droppedBy?: DropReason;
  /**
   * Present (and true) only when nothing matched the settings: the Suggestion
   * is 1 fallback Exercise from the base set (no Equipment, Position not
   * Floor), chosen ignoring Exclusions, the Difficulty ceiling and Energetic.
   */
  fallback?: true;
  /**
   * The Exercise Ids swapped out of this Suggestion, in Swap order. They count
   * in the no-repeat window of the Suggestions after it.
   */
  swappedOut?: string[];
  /**
   * Only on a Reminder built in Strict mode: the `BODY_AREAS` index the next
   * Strict Suggestion starts from. The next Strict Suggestion starts from the
   * latest earlier Reminder that has it, else from 0.
   */
  rotation?: number;
}

/**
 * Why a dropped Reminder was dropped: `droppedBy`, the reason stored when it
 * was dropped. None stored means closing: every Reminder dropped before the
 * reason was stored was a Snooze re-fire past closing.
 */
export function dropReason(reminder: Reminder): DropReason {
  return reminder.droppedBy ?? 'closing';
}

/** Everything the core knows. Adapters persist it; the core never does. */
export interface CoreState {
  /** When the app was last opened, or null if never. */
  lastAppOpenAt: Instant | null;
  settings: Settings;
  /** Fired Reminders plus the scheduled chain ahead, oldest first. */
  reminders: Reminder[];
  /** When the user last gave a Response (Done or Skip), or null if never. */
  lastResponseAt: Instant | null;
  /**
   * Daily Goal changes, oldest first. The goal for a day is the last change
   * with `from` on or before it; with none it is 4.
   */
  goalChanges: GoalChange[];
  /**
   * The Pause history, oldest first. Resume shortens the running one's
   * `until` to the Resume time.
   */
  pauses: Pause[];
  /** The Days Off (local dates in the Settings' time zone): no Reminder fires on them. */
  daysOff: LocalDate[];
}

/** A Pause: no Reminder fires in [from, until), and nothing in it is Missed. */
export interface Pause {
  from: Instant;
  until: Instant;
}

/** How long a Pause runs from now: 1 hour, 2 hours, or until the next local midnight. */
export type PauseLength = 'hour' | 'twoHours' | 'restOfToday';

/** From `from` on (a local date in the Settings' time zone), the Daily Goal is `goal`. */
export interface GoalChange {
  from: LocalDate;
  goal: number;
}

/**
 * A Response the user can give: Done (from the guided flow), Skip and Snooze
 * (from the notification or the guided screen). Done and Skip are final;
 * Snooze is not (it re-fires the same Reminder later). Done is its own event
 * shape: only it carries what was done.
 */
export type ResponseKind = 'Done' | 'Skip' | 'Snooze';

/** Something that happened, fed into the core by an adapter or screen. */
export type CoreEvent =
  | { type: 'AppOpened' }
  /**
   * JS is running (launch, foreground): rebuild the chain ahead. `timeZone` is
   * the device's IANA zone; when present it replaces `settings.timeZone`.
   */
  | { type: 'Rearm'; timeZone?: string }
  | { type: 'Response'; reminderId: string; kind: Exclude<ResponseKind, 'Done'> }
  /**
   * The guided flow finished: `did` are the Exercise Ids marked Did it. Only
   * Ids in the Reminder's Suggestion count; none left counts as a Skip.
   */
  | { type: 'Response'; reminderId: string; kind: 'Done'; did: string[] }
  /**
   * The guided screen opened on this Reminder. Not a Response: if it is the
   * outstanding one with a Snooze re-fire pending, the re-fire is cancelled.
   */
  | { type: 'GuidedStarted'; reminderId: string }
  /**
   * Sets the Daily Goal from tomorrow (Settings' time zone): today's goal never
   * moves. Replaces any change dated tomorrow or later.
   */
  | { type: 'SetDailyGoal'; goal: number }
  /**
   * A correction from Today: changes the outcome of one of today's Reminders
   * already Done, skipped, Missed or dropped. To Done, `did` must keep at
   * least one Id of the Suggestion. History only: no Response, no intents.
   */
  | { type: 'Correct'; reminderId: string; to: Outcome; did?: string[] }
  /**
   * Swap on the guided card: replaces `exerciseId` in the Reminder's
   * Suggestion, in place, with another under the Suggestion rules. Not a
   * Response. Accepted on the Reminders the guided screen can open.
   */
  | { type: 'Swap'; reminderId: string; exerciseId: string }
  /**
   * A change on the Settings page: applies the validated change and rearms.
   * An invalid change returns the input state with no intents.
   */
  | { type: 'ChangeSettings'; change: SettingsChange }
  /**
   * Reset settings to defaults: every setting but `timeZone`, and the Daily
   * Goal from tomorrow. Never touches the Activity Log. Then rearms.
   */
  | { type: 'ResetSettings' }
  /**
   * Pause Reminders from now. A Pause already running has its `until`
   * replaced. Rejected on a Day Off. Drops the outstanding Reminder, then rearms.
   */
  | { type: 'Pause'; length: PauseLength }
  /** End the running Pause now, then rearm. Rejected with no Pause running. */
  | { type: 'Resume' }
  /**
   * Mark `date` (today or later) as a Day Off, or undo it. Taking today off
   * drops the outstanding Reminder. Rejected for a past date or a no-op.
   */
  | { type: 'SetDayOff'; date: LocalDate; off: boolean };

/** The notification actions, in order. */
export type NotificationAction = 'start' | 'snooze' | 'skip';

/** One notification the adapter schedules for one Reminder. */
export interface ScheduledNotification {
  reminderId: string;
  at: Instant;
  title: string;
  /** One line per suggested Exercise: `Name · Dose · Cue`. */
  body: string;
  actions: NotificationAction[];
}

/** Something the core wants the platform to do. Adapters carry these out. */
export type Intent =
  /** Replaces the whole previously scheduled chain: cancel all, schedule these. */
  | { type: 'ScheduleChain'; reminders: ScheduledNotification[] }
  /** Remove this Reminder's notification from the shade, if it is there. */
  | { type: 'DismissNotification'; reminderId: string };

/** Injected source of the current time. The core never reads the system clock. */
export interface Clock {
  now(): Instant;
}

/** Injected source of randomness. The core never calls Math.random. */
export interface Random {
  /** A number in [0, 1). */
  next(): number;
}

export interface CoreDeps {
  clock: Clock;
  random: Random;
  /** The bundled Exercise Library. Absent means empty: no Suggestion can be made. */
  library?: readonly Exercise[];
}

export interface CoreResult {
  state: CoreState;
  intents: Intent[];
}
