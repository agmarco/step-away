/**
 * Domain-core types. Pure TypeScript: nothing here may import React, React
 * Native or Expo (enforced by ESLint on src/core/**: no-restricted-imports for
 * static imports, no-restricted-syntax for require() and dynamic import()).
 *
 * These are a skeleton. Later tickets grow each union with the events and
 * intents described in the v1 spec (#17, Modules -> Domain core).
 */

import type { Dose, Exercise } from './exercise';

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
  /**
   * The Snooze delay: a Snooze re-fires the same Reminder this many minutes
   * later. Optional so that settings stored before it existed (and literals
   * outside the core) stay valid; absent means 10.
   */
  snoozeMinutes?: number;
}

/** One Exercise of a Suggestion: a text snapshot, not a link to the library entry. */
export interface SuggestedExercise {
  id: string;
  name: string;
  dose: Dose;
  cue: string;
}

/**
 * A Reminder of the current chain. One whose `firesAt <= now` and status is
 * still `scheduled` has fired; only the latest fired one is outstanding.
 *
 * Statuses: `scheduled` (ahead, or fired with no final Response yet),
 * `skipped` (a Skip Response), `missed` (no Response before a later Reminder
 * fired, or before its day's Active Hours ended) and `dropped` (a pending
 * Snooze re-fire that would land at or after its day's window end).
 */
export interface Reminder {
  /** Deterministic from `firesAt`. A Snooze re-fire keeps it. */
  id: string;
  firesAt: Instant;
  suggestion: SuggestedExercise[];
  status: 'scheduled' | 'skipped' | 'missed' | 'dropped';
  /** How many times it was snoozed (at most 2). Absent means 0. */
  snoozes?: number;
  /** The pending or latest Snooze re-fire. Absent if never snoozed. */
  refiresAt?: Instant;
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
}

/**
 * A Response the user can give from the notification or the Today screen.
 * Skip is final; Snooze is not (it re-fires the same Reminder later).
 */
export type ResponseKind = 'Skip' | 'Snooze';

/** Something that happened, fed into the core by an adapter or screen. */
export type CoreEvent =
  | { type: 'AppOpened' }
  /**
   * JS is running (launch, foreground): rebuild the chain ahead. `timeZone` is
   * the device's IANA zone; when present it replaces `settings.timeZone`.
   */
  | { type: 'Rearm'; timeZone?: string }
  | { type: 'Response'; reminderId: string; kind: ResponseKind };

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
  /** How many times this Reminder was snoozed, on a Snooze re-fire. Absent means 0. */
  snoozes?: number;
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
